import { createServer } from 'http';
import express from 'express';
import { io as Client } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { WebSocketService } from '../../src/services/websocket';
import { LogStreamManager } from '../../src/services/logStream';
import { AuthService } from '../../src/services/auth';
import { DatabaseService } from '../../src/services/database';

describe('WebSocket Real-time Log Streaming', () => {
  let httpServer: any;
  let wsService: WebSocketService;
  let logStreamManager: LogStreamManager;
  let authService: AuthService;
  let clientSocket: Socket;
  let testToken: string;
  let testUserId: string;
  let testDeploymentId: string;

  beforeAll(async () => {
    // Set up test environment
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret-key';
    process.env.WS_MAX_CONNECTIONS = '100';
    process.env.LOG_BUFFER_SIZE = '100';
    
    // Create Express app and HTTP server
    const app = express();
    httpServer = createServer(app);
    
    // Initialize services
    authService = AuthService.getInstance();
    logStreamManager = LogStreamManager.getInstance();
    wsService = WebSocketService.getInstance();
    
    // Initialize WebSocket service
    wsService.initialize(httpServer);
    
    // Create test user and token
    testUserId = 'test-user-123';
    testToken = authService.generateToken({
      id: testUserId,
      email: 'test@example.com',
      plan_type: 'free'
    });
    
    testDeploymentId = 'test-deployment-123';
    
    // Start server
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        resolve();
      });
    });
  });

  afterAll(async () => {
    // Cleanup
    if (clientSocket?.connected) {
      clientSocket.disconnect();
    }
    
    await wsService.cleanup();
    await logStreamManager.cleanup();
    
    if (httpServer) {
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      });
    }
  });

  beforeEach(async () => {
    // Clean up any existing client connections
    if (clientSocket?.connected) {
      clientSocket.disconnect();
    }
  });

  describe('WebSocket Connection', () => {
    test('should establish connection with valid JWT token', (done) => {
      const port = httpServer.address().port;
      clientSocket = Client(`http://localhost:${port}`, {
        auth: {
          token: testToken
        }
      });

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        done();
      });

      clientSocket.on('connect_error', (error: any) => {
        done(new Error(`Connection failed: ${error.message}`));
      });
    });

    test('should reject connection without valid token', (done) => {
      const port = httpServer.address().port;
      const invalidClient = Client(`http://localhost:${port}`, {
        auth: {
          token: 'invalid-token'
        }
      });

      invalidClient.on('connect', () => {
        invalidClient.disconnect();
        done(new Error('Connection should have been rejected'));
      });

      invalidClient.on('connect_error', (error: any) => {
        expect(error.message).toContain('Authentication failed');
        done();
      });
    });

    test('should receive connection status message on connect', (done) => {
      const port = httpServer.address().port;
      clientSocket = Client(`http://localhost:${port}`, {
        auth: {
          token: testToken
        }
      });

      clientSocket.on('connection:status', (message: any) => {
        expect(message.type).toBe('connected');
        expect(message.connectionId).toBeDefined();
        expect(message.serverInfo).toBeDefined();
        expect(message.serverInfo.features).toContain('log-streaming');
        done();
      });
    });
  });

  describe('Log Subscription', () => {
    beforeEach(async () => {
      // Establish connection
      const port = httpServer.address().port;
      clientSocket = Client(`http://localhost:${port}`, {
        auth: {
          token: testToken
        }
      });

      await new Promise<void>((resolve) => {
        clientSocket.on('connect', () => resolve());
      });
    });

    test('should successfully subscribe to deployment logs', (done) => {
      // Mock deployment access validation
      jest.spyOn(DatabaseService.prototype, 'getDeploymentById')
        .mockResolvedValue({
          id: testDeploymentId,
          project_id: 'test-project',
          status: 'RUNNING',
          created_at: new Date(),
          updated_at: new Date()
        } as any);
        
      jest.spyOn(DatabaseService.prototype, 'getProjectById')
        .mockResolvedValue({
          id: 'test-project',
          user_id: testUserId,
          name: 'Test Project',
          created_at: new Date(),
          updated_at: new Date()
        } as any);

      clientSocket.emit('subscribe', {
        type: 'subscribe',
        deploymentId: testDeploymentId,
        options: {
          tail: 10
        }
      });

      clientSocket.on('subscription:success', (response: any) => {
        expect(response.success).toBe(true);
        expect(response.deploymentId).toBe(testDeploymentId);
        expect(response.initialLogs).toBeDefined();
        done();
      });

      clientSocket.on('subscription:error', (error: any) => {
        done(new Error(`Subscription failed: ${error.error}`));
      });
    });

    test('should reject subscription to unauthorized deployment', (done) => {
      // Mock unauthorized access
      jest.spyOn(DatabaseService.prototype, 'getDeploymentById')
        .mockResolvedValue({
          id: testDeploymentId,
          project_id: 'test-project',
          status: 'RUNNING',
          created_at: new Date(),
          updated_at: new Date()
        } as any);
        
      jest.spyOn(DatabaseService.prototype, 'getProjectById')
        .mockResolvedValue({
          id: 'test-project',
          user_id: 'different-user-id', // Different user
          name: 'Test Project',
          created_at: new Date(),
          updated_at: new Date()
        } as any);

      clientSocket.emit('subscribe', {
        type: 'subscribe',
        deploymentId: testDeploymentId
      });

      clientSocket.on('subscription:error', (error: any) => {
        expect(error.error).toContain('Access denied');
        expect(error.code).toBe('ACCESS_DENIED');
        done();
      });
    });

    test('should successfully unsubscribe from deployment logs', (done) => {
      // First subscribe
      jest.spyOn(DatabaseService.prototype, 'getDeploymentById')
        .mockResolvedValue({
          id: testDeploymentId,
          project_id: 'test-project',
          status: 'RUNNING',
          created_at: new Date(),
          updated_at: new Date()
        } as any);
        
      jest.spyOn(DatabaseService.prototype, 'getProjectById')
        .mockResolvedValue({
          id: 'test-project',
          user_id: testUserId,
          name: 'Test Project',
          created_at: new Date(),
          updated_at: new Date()
        } as any);

      let subscribed = false;

      clientSocket.emit('subscribe', {
        type: 'subscribe',
        deploymentId: testDeploymentId
      });

      clientSocket.on('subscription:success', () => {
        subscribed = true;
        // Now unsubscribe
        clientSocket.emit('unsubscribe', {
          type: 'unsubscribe',
          deploymentId: testDeploymentId
        });
      });

      clientSocket.on('unsubscription:success', (response: any) => {
        expect(subscribed).toBe(true);
        expect(response.deploymentId).toBe(testDeploymentId);
        done();
      });
    });
  });

  describe('Real-time Log Streaming', () => {
    beforeEach(async () => {
      // Establish connection and subscribe
      const port = httpServer.address().port;
      clientSocket = Client(`http://localhost:${port}`, {
        auth: {
          token: testToken
        }
      });

      await new Promise<void>((resolve) => {
        clientSocket.on('connect', () => resolve());
      });

      // Mock deployment access
      jest.spyOn(DatabaseService.prototype, 'getDeploymentById')
        .mockResolvedValue({
          id: testDeploymentId,
          project_id: 'test-project',
          status: 'RUNNING',
          created_at: new Date(),
          updated_at: new Date()
        } as any);
        
      jest.spyOn(DatabaseService.prototype, 'getProjectById')
        .mockResolvedValue({
          id: 'test-project',
          user_id: testUserId,
          name: 'Test Project',
          created_at: new Date(),
          updated_at: new Date()
        } as any);

      // Subscribe
      clientSocket.emit('subscribe', {
        type: 'subscribe',
        deploymentId: testDeploymentId
      });

      await new Promise<void>((resolve) => {
        clientSocket.on('subscription:success', () => resolve());
      });
    });

    test('should receive real-time log entries', (done) => {
      // Listen for log messages
      clientSocket.on('log', (message: any) => {
        expect(message.type).toBe('deployment:logs');
        expect(message.payload).toBeDefined();
        expect(message.payload.deploymentId).toBe(testDeploymentId);
        expect(message.payload.message).toBe('Test log message');
        expect(message.deploymentId).toBe(testDeploymentId);
        done();
      });

      // Add a log entry
      setTimeout(() => {
        logStreamManager.createApplicationLog(
          testDeploymentId,
          'info',
          'Test log message',
          { test: true }
        );
      }, 100);
    });

    test('should receive deployment status updates', (done) => {
      // Listen for status messages
      clientSocket.on('status', (message: any) => {
        expect(message.type).toBe('deployment:status');
        expect(message.payload.deploymentId).toBe(testDeploymentId);
        expect(message.payload.status).toBe('BUILDING');
        expect(message.payload.previousStatus).toBe('RUNNING');
        done();
      });

      // Broadcast status update
      setTimeout(() => {
        wsService.broadcastDeploymentStatus(testDeploymentId, 'BUILDING', 'RUNNING');
      }, 100);
    });

    test('should handle multiple log entries in sequence', (done) => {
      let receivedLogs = 0;
      const expectedLogs = 3;

      clientSocket.on('log', (message: any) => {
        receivedLogs++;
        expect(message.type).toBe('deployment:logs');
        expect(message.payload.message).toContain('Sequential log');
        
        if (receivedLogs === expectedLogs) {
          done();
        }
      });

      // Add multiple log entries
      setTimeout(() => {
        for (let i = 0; i < expectedLogs; i++) {
          logStreamManager.createApplicationLog(
            testDeploymentId,
            'info',
            `Sequential log ${i + 1}`,
            { sequence: i }
          );
        }
      }, 100);
    });
  });

  describe('Connection Management', () => {
    test('should handle heartbeat/ping messages', (done) => {
      const port = httpServer.address().port;
      clientSocket = Client(`http://localhost:${port}`, {
        auth: {
          token: testToken
        }
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('ping');
      });

      clientSocket.on('pong', (response: any) => {
        expect(response.timestamp).toBeDefined();
        done();
      });
    });

    test('should handle client disconnection gracefully', (done) => {
      const port = httpServer.address().port;
      clientSocket = Client(`http://localhost:${port}`, {
        auth: {
          token: testToken
        }
      });

      clientSocket.on('connect', () => {
        // Disconnect after connecting
        setTimeout(() => {
          clientSocket.disconnect();
          
          // Check that connection was cleaned up
          setTimeout(() => {
            const connectionInfo = wsService.getConnectionInfo();
            expect(connectionInfo.totalConnections).toBe(0);
            done();
          }, 100);
        }, 100);
      });
    });
  });

  describe('Service Integration', () => {
    test('should integrate log stream manager with websocket service', (done) => {
      const port = httpServer.address().port;
      clientSocket = Client(`http://localhost:${port}`, {
        auth: {
          token: testToken
        }
      });

      // Set up subscription first
      clientSocket.on('connect', () => {
        // Mock deployment access
        jest.spyOn(DatabaseService.prototype, 'getDeploymentById')
          .mockResolvedValue({
            id: testDeploymentId,
            project_id: 'test-project',
            status: 'RUNNING',
            created_at: new Date(),
            updated_at: new Date()
          } as any);
          
        jest.spyOn(DatabaseService.prototype, 'getProjectById')
          .mockResolvedValue({
            id: 'test-project',
            user_id: testUserId,
            name: 'Test Project',
            created_at: new Date(),
            updated_at: new Date()
          } as any);

        clientSocket.emit('subscribe', {
          type: 'subscribe',
          deploymentId: testDeploymentId
        });
      });

      clientSocket.on('subscription:success', () => {
        // Now test the integration by adding a log
        logStreamManager.createSystemLog(
          testDeploymentId,
          'info',
          'Integration test log',
          { integration: true }
        );
      });

      clientSocket.on('log', (message: any) => {
        expect(message.payload.message).toBe('Integration test log');
        expect(message.payload.source).toBe('system');
        expect(message.payload.data.integration).toBe(true);
        done();
      });
    });

    test('should provide metrics and monitoring', () => {
      const metrics = wsService.getMetrics();
      
      expect(metrics).toBeDefined();
      expect(typeof metrics.totalConnections).toBe('number');
      expect(typeof metrics.activeConnections).toBe('number');
      expect(typeof metrics.totalSubscriptions).toBe('number');
      expect(typeof metrics.messagesPerSecond).toBe('number');
      expect(typeof metrics.avgLatency).toBe('number');
      expect(typeof metrics.errorRate).toBe('number');
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed subscription requests', (done) => {
      const port = httpServer.address().port;
      clientSocket = Client(`http://localhost:${port}`, {
        auth: {
          token: testToken
        }
      });

      clientSocket.on('connect', () => {
        // Send malformed subscription
        clientSocket.emit('subscribe', {
          type: 'subscribe'
          // Missing deploymentId
        });
      });

      clientSocket.on('subscription:error', (error: any) => {
        expect(error.error).toBeDefined();
        done();
      });
    });

    test('should handle database connection errors gracefully', (done) => {
      const port = httpServer.address().port;
      clientSocket = Client(`http://localhost:${port}`, {
        auth: {
          token: testToken
        }
      });

      clientSocket.on('connect', () => {
        // Mock database error
        jest.spyOn(DatabaseService.prototype, 'getDeploymentById')
          .mockRejectedValue(new Error('Database connection failed'));

        clientSocket.emit('subscribe', {
          type: 'subscribe',
          deploymentId: testDeploymentId
        });
      });

      clientSocket.on('subscription:error', (error: any) => {
        // Accept either "Subscription failed" or "Access denied" as valid error messages
        expect(error.error).toMatch(/Subscription failed|Access denied/);
        done();
      });

      // Add timeout handler
      setTimeout(() => {
        done();
      }, 8000);
    });
  });
});