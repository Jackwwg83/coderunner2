import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { Socket as ClientSocket, io as Client } from 'socket.io-client';
import { Express } from 'express';
import { DatabaseService } from '../../src/services/database';
import { AuthService } from '../../src/services/auth';
import { createTestApp } from '../helpers/test-app';
import { createTestServer } from '../helpers/test-server';

describe('WebSocket Integration', () => {
  let app: Express;
  let server: HttpServer;
  let io: SocketIOServer;
  let clientSocket: ClientSocket;
  let authToken: string;
  let testUserId: string;
  let testDeploymentId: string;
  let db: DatabaseService;

  beforeAll(async () => {
    // Create test app and server
    app = createTestApp();
    const testServer = createTestServer(app);
    server = testServer.server;
    io = testServer.io;

    // Initialize database
    db = DatabaseService.getInstance();
    await db.connect();

    // Create test user
    const authService = new AuthService();
    const user = await authService.register(
      'websocket-test@coderunner.io',
      'TestPassword123!',
      'WebSocket Test User'
    );
    testUserId = user.id;
    authToken = user.token;

    // Create test deployment
    const deployment = await db.query(
      `INSERT INTO deployments (name, user_id, status, manifest) 
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [
        'WebSocket Test Deployment',
        testUserId,
        'running',
        JSON.stringify({
          version: '1.0',
          name: 'websocket-test-app',
          type: 'nodejs',
          start: { command: 'npm start', port: 8080 }
        })
      ]
    );
    testDeploymentId = deployment.rows[0].id;

    // Start server
    await new Promise<void>((resolve) => {
      server.listen(0, resolve);
    });
  });

  beforeEach(async () => {
    // Create client connection
    const port = (server.address() as any)?.port;
    clientSocket = Client(`http://localhost:${port}`, {
      auth: { token: authToken },
      transports: ['websocket']
    });

    await new Promise<void>((resolve) => {
      clientSocket.on('connect', resolve);
    });
  });

  afterEach(() => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  afterAll(async () => {
    // Clean up test data
    if (testDeploymentId) {
      await db.query('DELETE FROM deployments WHERE id = $1', [testDeploymentId]);
    }
    if (testUserId) {
      await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
    }

    await db.disconnect();
    
    if (server) {
      server.close();
    }
  });

  describe('Connection and Authentication', () => {
    it('should connect with valid auth token', async () => {
      expect(clientSocket.connected).toBe(true);
    });

    it('should reject connection with invalid auth token', async () => {
      clientSocket.disconnect();

      const unauthorizedSocket = Client(`http://localhost:${(server.address() as any)?.port}`, {
        auth: { token: 'invalid-token' },
        transports: ['websocket']
      });

      await new Promise<void>((resolve) => {
        unauthorizedSocket.on('connect_error', (error) => {
          expect(error.message).toContain('Authentication failed');
          unauthorizedSocket.close();
          resolve();
        });
      });
    });

    it('should handle connection without auth token', async () => {
      clientSocket.disconnect();

      const noAuthSocket = Client(`http://localhost:${(server.address() as any)?.port}`, {
        transports: ['websocket']
      });

      await new Promise<void>((resolve) => {
        noAuthSocket.on('connect_error', (error) => {
          expect(error.message).toContain('Authentication required');
          noAuthSocket.close();
          resolve();
        });
      });
    });
  });

  describe('Log Streaming', () => {
    it('should subscribe to deployment logs', async () => {
      const logPromise = new Promise<any>((resolve) => {
        clientSocket.on('deployment:log', resolve);
      });

      // Subscribe to logs
      clientSocket.emit('subscribe:logs', { deploymentId: testDeploymentId });

      // Simulate log emission from server
      io.to(`deployment:${testDeploymentId}`).emit('deployment:log', {
        deploymentId: testDeploymentId,
        level: 'info',
        message: 'Test log message',
        timestamp: new Date().toISOString(),
        source: 'application'
      });

      const logData = await logPromise;
      expect(logData).toHaveProperty('deploymentId', testDeploymentId);
      expect(logData).toHaveProperty('level', 'info');
      expect(logData).toHaveProperty('message', 'Test log message');
      expect(logData).toHaveProperty('timestamp');
    });

    it('should unsubscribe from deployment logs', async () => {
      let logReceived = false;

      clientSocket.on('deployment:log', () => {
        logReceived = true;
      });

      // Subscribe then unsubscribe
      clientSocket.emit('subscribe:logs', { deploymentId: testDeploymentId });
      clientSocket.emit('unsubscribe:logs', { deploymentId: testDeploymentId });

      // Wait a bit to ensure unsubscribe processed
      await new Promise(resolve => setTimeout(resolve, 100));

      // Emit log - should not be received
      io.to(`deployment:${testDeploymentId}`).emit('deployment:log', {
        deploymentId: testDeploymentId,
        level: 'info',
        message: 'Should not receive this',
        timestamp: new Date().toISOString()
      });

      // Wait and verify log wasn't received
      await new Promise(resolve => setTimeout(resolve, 200));
      expect(logReceived).toBe(false);
    });

    it('should handle multiple log subscriptions', async () => {
      const logs: any[] = [];

      clientSocket.on('deployment:log', (data) => {
        logs.push(data);
      });

      // Subscribe to logs
      clientSocket.emit('subscribe:logs', { deploymentId: testDeploymentId });

      // Emit multiple logs rapidly
      for (let i = 0; i < 5; i++) {
        io.to(`deployment:${testDeploymentId}`).emit('deployment:log', {
          deploymentId: testDeploymentId,
          level: 'info',
          message: `Log message ${i}`,
          timestamp: new Date().toISOString(),
          sequence: i
        });
      }

      // Wait for all logs to arrive
      await new Promise(resolve => setTimeout(resolve, 500));

      expect(logs).toHaveLength(5);
      logs.forEach((log, index) => {
        expect(log.message).toBe(`Log message ${index}`);
        expect(log.sequence).toBe(index);
      });
    });

    it('should filter logs by level', async () => {
      const filteredLogs: any[] = [];

      clientSocket.on('deployment:log', (data) => {
        filteredLogs.push(data);
      });

      // Subscribe with error level filter
      clientSocket.emit('subscribe:logs', { 
        deploymentId: testDeploymentId,
        filters: { level: 'error' }
      });

      // Emit logs of different levels
      const logLevels = ['info', 'warn', 'error', 'debug'];
      for (const level of logLevels) {
        io.to(`deployment:${testDeploymentId}`).emit('deployment:log', {
          deploymentId: testDeploymentId,
          level,
          message: `${level} message`,
          timestamp: new Date().toISOString()
        });
      }

      // Wait for logs to arrive
      await new Promise(resolve => setTimeout(resolve, 300));

      // Should only receive error logs
      expect(filteredLogs).toHaveLength(1);
      expect(filteredLogs[0].level).toBe('error');
    });
  });

  describe('Real-time Status Updates', () => {
    it('should receive deployment status changes', async () => {
      const statusPromise = new Promise<any>((resolve) => {
        clientSocket.on('deployment:status', resolve);
      });

      // Subscribe to status updates
      clientSocket.emit('subscribe:status', { deploymentId: testDeploymentId });

      // Simulate status change
      io.to(`deployment:${testDeploymentId}`).emit('deployment:status', {
        deploymentId: testDeploymentId,
        status: 'restarting',
        timestamp: new Date().toISOString(),
        reason: 'Manual restart requested'
      });

      const statusData = await statusPromise;
      expect(statusData).toHaveProperty('deploymentId', testDeploymentId);
      expect(statusData).toHaveProperty('status', 'restarting');
      expect(statusData).toHaveProperty('reason', 'Manual restart requested');
    });

    it('should receive scaling events', async () => {
      const scalingPromise = new Promise<any>((resolve) => {
        clientSocket.on('deployment:scaling', resolve);
      });

      // Subscribe to scaling events
      clientSocket.emit('subscribe:scaling', { deploymentId: testDeploymentId });

      // Simulate scaling event
      io.to(`deployment:${testDeploymentId}`).emit('deployment:scaling', {
        deploymentId: testDeploymentId,
        event: 'scale_out',
        from: 2,
        to: 4,
        reason: 'CPU threshold exceeded',
        timestamp: new Date().toISOString()
      });

      const scalingData = await scalingPromise;
      expect(scalingData).toHaveProperty('event', 'scale_out');
      expect(scalingData).toHaveProperty('from', 2);
      expect(scalingData).toHaveProperty('to', 4);
    });

    it('should receive metrics updates', async () => {
      const metricsPromise = new Promise<any>((resolve) => {
        clientSocket.on('deployment:metrics', resolve);
      });

      // Subscribe to metrics
      clientSocket.emit('subscribe:metrics', { deploymentId: testDeploymentId });

      // Simulate metrics update
      io.to(`deployment:${testDeploymentId}`).emit('deployment:metrics', {
        deploymentId: testDeploymentId,
        cpu: 45.2,
        memory: 67.8,
        requests: 120,
        timestamp: new Date().toISOString()
      });

      const metricsData = await metricsPromise;
      expect(metricsData).toHaveProperty('cpu', 45.2);
      expect(metricsData).toHaveProperty('memory', 67.8);
      expect(metricsData).toHaveProperty('requests', 120);
    });
  });

  describe('Client Actions', () => {
    it('should handle deployment restart request', async () => {
      const responsePromise = new Promise<any>((resolve) => {
        clientSocket.on('deployment:action:response', resolve);
      });

      // Request deployment restart
      clientSocket.emit('deployment:action', {
        deploymentId: testDeploymentId,
        action: 'restart'
      });

      const response = await responsePromise;
      expect(response).toHaveProperty('success', true);
      expect(response).toHaveProperty('action', 'restart');
      expect(response).toHaveProperty('message');
    });

    it('should handle deployment stop request', async () => {
      const responsePromise = new Promise<any>((resolve) => {
        clientSocket.on('deployment:action:response', resolve);
      });

      clientSocket.emit('deployment:action', {
        deploymentId: testDeploymentId,
        action: 'stop'
      });

      const response = await responsePromise;
      expect(response).toHaveProperty('success', true);
      expect(response).toHaveProperty('action', 'stop');
    });

    it('should validate deployment ownership for actions', async () => {
      // Create another user's deployment
      const otherUser = await db.query(
        `INSERT INTO users (name, email, password_hash) 
         VALUES ($1, $2, $3) RETURNING id`,
        ['Other User', 'other@example.com', 'hashedpassword']
      );
      
      const otherDeployment = await db.query(
        `INSERT INTO deployments (name, user_id, status, manifest) 
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [
          'Other User Deployment',
          otherUser.rows[0].id,
          'running',
          JSON.stringify({ version: '1.0', name: 'other-app' })
        ]
      );

      const responsePromise = new Promise<any>((resolve) => {
        clientSocket.on('deployment:action:response', resolve);
      });

      // Try to restart other user's deployment
      clientSocket.emit('deployment:action', {
        deploymentId: otherDeployment.rows[0].id,
        action: 'restart'
      });

      const response = await responsePromise;
      expect(response).toHaveProperty('success', false);
      expect(response).toHaveProperty('error');
      expect(response.error).toContain('not found');

      // Clean up
      await db.query('DELETE FROM deployments WHERE id = $1', [otherDeployment.rows[0].id]);
      await db.query('DELETE FROM users WHERE id = $1', [otherUser.rows[0].id]);
    });
  });

  describe('Connection Resilience', () => {
    it('should handle client disconnection gracefully', async () => {
      // Subscribe to logs
      clientSocket.emit('subscribe:logs', { deploymentId: testDeploymentId });
      
      // Verify subscription worked
      const logPromise = new Promise<any>((resolve) => {
        clientSocket.on('deployment:log', resolve);
      });

      io.to(`deployment:${testDeploymentId}`).emit('deployment:log', {
        deploymentId: testDeploymentId,
        level: 'info',
        message: 'Before disconnect',
        timestamp: new Date().toISOString()
      });

      await logPromise;

      // Disconnect client
      clientSocket.disconnect();

      // Verify client is disconnected
      expect(clientSocket.connected).toBe(false);

      // Server should handle this gracefully (no errors thrown)
      io.to(`deployment:${testDeploymentId}`).emit('deployment:log', {
        deploymentId: testDeploymentId,
        level: 'info',
        message: 'After disconnect',
        timestamp: new Date().toISOString()
      });
    });

    it('should handle rapid connect/disconnect cycles', async () => {
      const connections: ClientSocket[] = [];

      // Create multiple rapid connections
      for (let i = 0; i < 5; i++) {
        const socket = Client(`http://localhost:${(server.address() as any)?.port}`, {
          auth: { token: authToken },
          transports: ['websocket']
        });

        connections.push(socket);

        // Immediate disconnect
        setTimeout(() => socket.disconnect(), 10);
      }

      // Wait for all connections to settle
      await new Promise(resolve => setTimeout(resolve, 500));

      // All should be disconnected
      connections.forEach(socket => {
        expect(socket.connected).toBe(false);
      });
    });

    it('should limit concurrent connections per user', async () => {
      const maxConnections = 10;
      const connections: ClientSocket[] = [];

      // Create many connections
      for (let i = 0; i < maxConnections + 2; i++) {
        const socket = Client(`http://localhost:${(server.address() as any)?.port}`, {
          auth: { token: authToken },
          transports: ['websocket']
        });

        connections.push(socket);
      }

      // Wait for connections to establish
      await new Promise(resolve => setTimeout(resolve, 500));

      // Should have connection limit enforcement
      const connectedCount = connections.filter(s => s.connected).length;
      expect(connectedCount).toBeLessThanOrEqual(maxConnections);

      // Clean up
      connections.forEach(socket => socket.disconnect());
    });
  });

  describe('Performance and Load', () => {
    it('should handle high-frequency log messages', async () => {
      const receivedLogs: any[] = [];
      let startTime: number;

      clientSocket.on('deployment:log', (data) => {
        receivedLogs.push(data);
      });

      clientSocket.emit('subscribe:logs', { deploymentId: testDeploymentId });

      startTime = Date.now();

      // Send 100 log messages rapidly
      for (let i = 0; i < 100; i++) {
        io.to(`deployment:${testDeploymentId}`).emit('deployment:log', {
          deploymentId: testDeploymentId,
          level: 'info',
          message: `High frequency log ${i}`,
          timestamp: new Date().toISOString(),
          sequence: i
        });
      }

      // Wait for all logs to arrive
      await new Promise(resolve => setTimeout(resolve, 1000));

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should receive all logs within reasonable time
      expect(receivedLogs).toHaveLength(100);
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should handle large log messages', async () => {
      const largeMessage = 'A'.repeat(10000); // 10KB message
      let receivedLarge = false;

      clientSocket.on('deployment:log', (data) => {
        if (data.message === largeMessage) {
          receivedLarge = true;
        }
      });

      clientSocket.emit('subscribe:logs', { deploymentId: testDeploymentId });

      io.to(`deployment:${testDeploymentId}`).emit('deployment:log', {
        deploymentId: testDeploymentId,
        level: 'info',
        message: largeMessage,
        timestamp: new Date().toISOString()
      });

      // Wait for message
      await new Promise(resolve => setTimeout(resolve, 500));

      expect(receivedLarge).toBe(true);
    });
  });
});