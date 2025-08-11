import { createServer, Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { Express } from 'express';
import { authMiddleware } from '../../src/middleware/auth';
import { WebSocketService } from '../../src/services/websocket';

export interface TestServer {
  server: HttpServer;
  io: SocketIOServer;
  wsService: WebSocketService;
}

/**
 * Creates a test HTTP server with WebSocket support
 */
export function createTestServer(app: Express): TestServer {
  const server = createServer(app);
  
  // Initialize Socket.IO with test configuration
  const io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true
  });

  // WebSocket authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication required'));
      }
      
      // Use the same auth middleware logic as HTTP
      const mockReq = { 
        headers: { authorization: `Bearer ${token}` }
      } as any;
      
      const mockRes = {} as any;
      
      await new Promise((resolve, reject) => {
        authMiddleware(mockReq, mockRes, (error?: any) => {
          if (error) {
            reject(error);
          } else {
            socket.data.user = mockReq.user;
            resolve(undefined);
          }
        });
      });
      
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  // Initialize WebSocket service
  const wsService = new WebSocketService(io);

  return { server, io, wsService };
}

/**
 * Test WebSocket client helper
 */
export class TestWebSocketClient {
  private socket: any;
  private events: Map<string, any[]> = new Map();
  private subscriptions: Set<string> = new Set();

  constructor(private serverUrl: string, private authToken?: string) {}

  async connect(): Promise<void> {
    const { io } = require('socket.io-client');
    
    this.socket = io(this.serverUrl, {
      auth: { token: this.authToken },
      transports: ['websocket']
    });

    return new Promise((resolve, reject) => {
      this.socket.on('connect', () => {
        console.log('Test WebSocket client connected');
        resolve();
      });

      this.socket.on('connect_error', (error: any) => {
        console.error('Test WebSocket client connection error:', error);
        reject(error);
      });

      // Store all received events for testing
      this.socket.onAny((event: string, data: any) => {
        if (!this.events.has(event)) {
          this.events.set(event, []);
        }
        this.events.get(event)!.push({
          data,
          timestamp: Date.now()
        });
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.events.clear();
    this.subscriptions.clear();
  }

  emit(event: string, data: any): void {
    if (this.socket) {
      this.socket.emit(event, data);
    }
  }

  on(event: string, callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string, callback?: (data: any) => void): void {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  subscribeToLogs(deploymentId: string, filters?: any): void {
    this.emit('subscribe:logs', { deploymentId, filters });
    this.subscriptions.add(`logs:${deploymentId}`);
  }

  unsubscribeFromLogs(deploymentId: string): void {
    this.emit('unsubscribe:logs', { deploymentId });
    this.subscriptions.delete(`logs:${deploymentId}`);
  }

  subscribeToStatus(deploymentId: string): void {
    this.emit('subscribe:status', { deploymentId });
    this.subscriptions.add(`status:${deploymentId}`);
  }

  subscribeToScaling(deploymentId: string): void {
    this.emit('subscribe:scaling', { deploymentId });
    this.subscriptions.add(`scaling:${deploymentId}`);
  }

  subscribeToMetrics(deploymentId: string, interval?: number): void {
    this.emit('subscribe:metrics', { deploymentId, interval });
    this.subscriptions.add(`metrics:${deploymentId}`);
  }

  sendDeploymentAction(deploymentId: string, action: string, params?: any): void {
    this.emit('deployment:action', { deploymentId, action, params });
  }

  getReceivedEvents(eventType: string): any[] {
    return this.events.get(eventType) || [];
  }

  getLatestEvent(eventType: string): any {
    const events = this.getReceivedEvents(eventType);
    return events.length > 0 ? events[events.length - 1] : null;
  }

  waitForEvent(eventType: string, timeout: number = 5000): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.socket.off(eventType, eventHandler);
        reject(new Error(`Timeout waiting for event: ${eventType}`));
      }, timeout);

      const eventHandler = (data: any) => {
        clearTimeout(timeoutId);
        this.socket.off(eventType, eventHandler);
        resolve(data);
      };

      this.socket.on(eventType, eventHandler);
    });
  }

  clearReceivedEvents(): void {
    this.events.clear();
  }

  isConnected(): boolean {
    return this.socket && this.socket.connected;
  }

  getActiveSubscriptions(): string[] {
    return Array.from(this.subscriptions);
  }
}

/**
 * Creates multiple test WebSocket clients for load testing
 */
export class TestWebSocketLoadClients {
  private clients: TestWebSocketClient[] = [];
  private results: {
    connected: number;
    failed: number;
    messagesReceived: number;
    averageLatency: number;
  } = {
    connected: 0,
    failed: 0,
    messagesReceived: 0,
    averageLatency: 0
  };

  constructor(
    private serverUrl: string,
    private authToken: string,
    private clientCount: number
  ) {}

  async connectAll(): Promise<void> {
    const promises = [];

    for (let i = 0; i < this.clientCount; i++) {
      const client = new TestWebSocketClient(this.serverUrl, this.authToken);
      this.clients.push(client);

      promises.push(
        client.connect()
          .then(() => {
            this.results.connected++;
          })
          .catch((error) => {
            this.results.failed++;
            console.error(`Client ${i} connection failed:`, error);
          })
      );
    }

    await Promise.all(promises);
    console.log(`Connected ${this.results.connected}/${this.clientCount} clients`);
  }

  subscribeAllToLogs(deploymentId: string): void {
    this.clients.forEach(client => {
      if (client.isConnected()) {
        client.subscribeToLogs(deploymentId);
      }
    });
  }

  sendBroadcastMessage(deploymentId: string): void {
    // Simulate server broadcasting a message to all clients
    this.clients.forEach(client => {
      if (client.isConnected()) {
        client.emit('test:broadcast', {
          deploymentId,
          message: 'Broadcast test message',
          timestamp: Date.now()
        });
      }
    });
  }

  measureLatency(deploymentId: string, messageCount: number = 10): Promise<number> {
    return new Promise((resolve) => {
      const latencies: number[] = [];
      let messagesReceived = 0;

      this.clients.forEach((client, index) => {
        if (!client.isConnected()) return;

        client.on('test:latency:response', (data) => {
          const latency = Date.now() - data.sentTime;
          latencies.push(latency);
          messagesReceived++;

          if (messagesReceived >= messageCount) {
            const average = latencies.reduce((a, b) => a + b, 0) / latencies.length;
            this.results.averageLatency = average;
            resolve(average);
          }
        });

        // Send latency test messages
        for (let i = 0; i < messageCount / this.clients.length; i++) {
          client.emit('test:latency', {
            deploymentId,
            clientId: index,
            messageId: i,
            sentTime: Date.now()
          });
        }
      });
    });
  }

  disconnectAll(): void {
    this.clients.forEach(client => client.disconnect());
    this.clients = [];
  }

  getResults() {
    return {
      ...this.results,
      totalClients: this.clientCount,
      successRate: this.results.connected / this.clientCount
    };
  }
}