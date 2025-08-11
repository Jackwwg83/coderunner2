import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { 
  WebSocketConnection,
  WebSocketUser,
  WebSocketMessage,
  // LogStreamOptions, // imported but not used yet
  WebSocketMetrics,
  LogEntry,
  SubscriptionRequest,
  UnsubscriptionRequest,
  // AuthenticationRequest, // imported but not used yet
  WebSocketRoom
  // WebSocketError // imported but not used yet
} from '../types/websocket';
import { AuthService } from './auth';
import { LogStreamManager } from './logStream';
import { DatabaseService } from './database';
import { EventEmitter } from 'events';

/**
 * WebSocketService - Real-time WebSocket server for log streaming
 * 
 * Features:
 * - Socket.io based WebSocket server
 * - JWT authentication middleware
 * - Room-based subscriptions (deployment-specific)
 * - Real-time log streaming with buffering
 * - Connection lifecycle management
 * - Auto-reconnection support
 * - Metrics collection and monitoring
 * - Rate limiting and security
 */
export class WebSocketService extends EventEmitter {
  private static instance: WebSocketService;
  private io: SocketIOServer | null = null;
  private connections: Map<string, WebSocketConnection> = new Map();
  private rooms: Map<string, WebSocketRoom> = new Map();
  private metrics: WebSocketMetrics;
  private metricsInterval?: NodeJS.Timeout;
  private heartbeatInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;
  private redisClient?: any; // Redis client for pub/sub
  private redisSubscriber?: any; // Redis subscriber
  private serverId: string;

  // Services
  private authService: AuthService;
  private logStreamManager: LogStreamManager;
  private db: DatabaseService;

  // Configuration
  private readonly config = {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      credentials: true
    },
    maxConnections: parseInt(process.env.WS_MAX_CONNECTIONS || '1000'),
    heartbeatInterval: parseInt(process.env.WS_HEARTBEAT_INTERVAL || '30000'), // 30 seconds
    connectionTimeout: parseInt(process.env.WS_CONNECTION_TIMEOUT || '300000'), // 5 minutes
    maxSubscriptionsPerUser: parseInt(process.env.WS_MAX_SUBSCRIPTIONS || '10'),
    rateLimitEnabled: process.env.WS_RATE_LIMIT === 'true',
    maxMessagesPerSecond: parseInt(process.env.WS_MAX_MESSAGES_PER_SECOND || '10'),
    compressionEnabled: process.env.WS_COMPRESSION === 'true',
    cleanupInterval: parseInt(process.env.WS_CLEANUP_INTERVAL || '60000'), // 1 minute
    // Redis configuration for horizontal scaling
    redis: {
      enabled: process.env.REDIS_ENABLED === 'true',
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'coderunner:ws:'
    }
  };

  private constructor() {
    super();
    this.authService = AuthService.getInstance();
    this.logStreamManager = LogStreamManager.getInstance();
    this.db = DatabaseService.getInstance();
    
    // Generate unique server ID for Redis pub/sub
    this.serverId = `ws-${require('os').hostname()}-${process.pid}-${Date.now()}`;
    
    // Initialize metrics
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      authenticatedConnections: 0,
      totalSubscriptions: 0,
      messagesPerSecond: 0,
      avgLatency: 0,
      errorRate: 0,
      connectionsByRoom: {},
      totalMessages: 0,
      uptime: Date.now()
    };

    console.log('🔌 WebSocketService initialized with server ID:', this.serverId);
  }

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  /**
   * Initialize WebSocket server
   */
  public initialize(httpServer: HttpServer): void {
    if (this.io) {
      console.warn('⚠️ WebSocket server already initialized');
      return;
    }

    // Create Socket.io server
    this.io = new SocketIOServer(httpServer, {
      cors: this.config.cors,
      // compression: this.config.compressionEnabled, // Not available in this version
      pingTimeout: this.config.connectionTimeout,
      pingInterval: this.config.heartbeatInterval / 2,
      maxHttpBufferSize: 1e6, // 1MB
      allowEIO3: false // Security: disable older protocol versions
    });

    // Set up middleware
    this.setupMiddleware();
    
    // Set up connection handling
    this.setupConnectionHandling();
    
    // Start background processes
    this.startBackgroundProcesses();
    
    // Set up log stream integration
    this.setupLogStreamIntegration();
    
    // Initialize Redis if enabled
    if (this.config.redis.enabled) {
      this.setupRedis();
    }

    console.log('✅ WebSocket server initialized successfully');
    console.log(`🔌 CORS origin: ${this.config.cors.origin}`);
    console.log(`📊 Max connections: ${this.config.maxConnections}`);
    console.log(`🔴 Redis pub/sub: ${this.config.redis.enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Broadcast log to all subscribers of a deployment
   */
  public broadcastLog(deploymentId: string, logEntry: LogEntry): void {
    if (!this.io) return;

    const room = this.rooms.get(deploymentId);
    if (!room || room.connections.size === 0) {
      return;
    }

    const message: WebSocketMessage = {
      type: 'deployment:logs',
      payload: logEntry,
      timestamp: new Date(),
      deploymentId
    };

    // Broadcast to room
    this.io.to(deploymentId).emit('log', message);
    
    // Update metrics
    this.updateMetrics('message_sent', room.connections.size);
    
    // Update room activity
    room.lastActivity = new Date();

    console.log(`📡 Broadcasted log to ${room.connections.size} subscribers for deployment ${deploymentId}`);
  }

  /**
   * Broadcast deployment status change
   */
  public broadcastDeploymentStatus(
    deploymentId: string, 
    status: string, 
    previousStatus?: string
  ): void {
    if (!this.io) return;

    const room = this.rooms.get(deploymentId);
    if (!room || room.connections.size === 0) {
      return;
    }

    const message: WebSocketMessage = {
      type: 'deployment:status',
      payload: {
        deploymentId,
        status,
        previousStatus,
        timestamp: new Date()
      },
      timestamp: new Date(),
      deploymentId
    };

    this.io.to(deploymentId).emit('status', message);
    this.updateMetrics('message_sent', room.connections.size);
    
    console.log(`📡 Broadcasted status change to ${room.connections.size} subscribers: ${deploymentId} → ${status}`);
  }

  /**
   * Get current metrics
   */
  public getMetrics(): WebSocketMetrics {
    this.metrics.activeConnections = this.connections.size;
    this.metrics.totalSubscriptions = Array.from(this.rooms.values())
      .reduce((sum, room) => sum + room.connections.size, 0);
    
    return { ...this.metrics };
  }

  /**
   * Get connection information
   */
  public getConnectionInfo(): {
    totalConnections: number;
    activeRooms: number;
    connectionsByUser: Record<string, number>;
    } {
    const connectionsByUser: Record<string, number> = {};
    
    for (const connection of this.connections.values()) {
      const userId = connection.userId;
      connectionsByUser[userId] = (connectionsByUser[userId] || 0) + 1;
    }

    return {
      totalConnections: this.connections.size,
      activeRooms: this.rooms.size,
      connectionsByUser
    };
  }

  /**
   * Cleanup and shutdown
   */
  public async cleanup(): Promise<void> {
    console.log('🧹 Starting WebSocket service cleanup...');
    
    // Stop background processes
    if (this.metricsInterval) clearInterval(this.metricsInterval);
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    
    // Disconnect all clients
    if (this.io) {
      this.io.emit('system:shutdown', { 
        message: 'Server is shutting down',
        timestamp: new Date()
      });
      
      // Give clients time to handle shutdown message
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.io.close();
      this.io = null;
    }
    
    // Cleanup Redis connections
    if (this.redisClient) {
      try {
        this.redisClient.disconnect();
        console.log('✅ Redis publisher disconnected');
      } catch (error) {
        console.error('Error disconnecting Redis publisher:', error);
      }
    }
    
    if (this.redisSubscriber) {
      try {
        this.redisSubscriber.disconnect();
        console.log('✅ Redis subscriber disconnected');
      } catch (error) {
        console.error('Error disconnecting Redis subscriber:', error);
      }
    }
    
    // Clear memory
    this.connections.clear();
    this.rooms.clear();
    
    console.log('✅ WebSocket service cleanup completed');
  }

  // ==================== PRIVATE METHODS ====================

  /**
   * Set up middleware for authentication and rate limiting
   */
  private setupMiddleware(): void {
    if (!this.io) return;

    // Authentication middleware
    this.io.use(async (socket: Socket, next: (error?: Error) => void) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.query.token as string;
        
        if (!token) {
          throw new Error('Authentication token required');
        }

        // Verify JWT token
        const payload = this.authService.verifyToken(token);
        
        // Attach user info to socket
        (socket as any).user = {
          userId: payload.userId,
          email: payload.email,
          planType: payload.planType
        } as WebSocketUser;
        
        next();
      } catch (error) {
        console.error('❌ WebSocket authentication failed:', error instanceof Error ? error.message : 'Unknown error');
        next(new Error('Authentication failed'));
      }
    });

    // Rate limiting middleware (if enabled)
    if (this.config.rateLimitEnabled) {
      this.io.use((_socket: Socket, next: (error?: Error) => void) => {
        // TODO: Implement rate limiting logic
        next();
      });
    }
  }

  /**
   * Set up connection event handling
   */
  private setupConnectionHandling(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: Socket) => {
      const user = (socket as any).user as WebSocketUser;
      
      // Check connection limits
      if (this.connections.size >= this.config.maxConnections) {
        console.warn(`⚠️ Connection limit reached, rejecting connection from ${user.userId}`);
        socket.emit('error', { message: 'Server at capacity', code: 'CONNECTION_LIMIT_EXCEEDED' });
        socket.disconnect();
        return;
      }

      // Create connection record
      const connection: WebSocketConnection = {
        id: socket.id,
        socket,
        userId: user.userId,
        subscriptions: new Set(),
        connectedAt: new Date(),
        lastActivity: new Date()
      };

      this.connections.set(socket.id, connection);
      this.updateMetrics('connection_established');
      
      console.log(`✅ WebSocket connected: ${user.email} (${socket.id})`);
      
      // Send welcome message
      socket.emit('connection:status', {
        type: 'connected',
        connectionId: socket.id,
        timestamp: new Date(),
        serverInfo: {
          version: '1.0.0',
          features: ['log-streaming', 'deployment-status']
        }
      });

      // Set up event handlers
      this.setupSocketEventHandlers(socket, connection);
    });
  }

  /**
   * Set up event handlers for a socket connection
   */
  private setupSocketEventHandlers(socket: Socket, connection: WebSocketConnection): void {
    const user = (socket as any).user as WebSocketUser;

    // Subscription to deployment logs
    socket.on('subscribe', async (request: SubscriptionRequest) => {
      try {
        const { deploymentId, options = {} } = request;
        
        // Validate deployment access
        const hasAccess = await this.validateDeploymentAccess(user.userId, deploymentId);
        if (!hasAccess) {
          socket.emit('subscription:error', {
            deploymentId,
            error: 'Access denied to deployment',
            code: 'ACCESS_DENIED'
          });
          return;
        }

        // Check subscription limits
        if (connection.subscriptions.size >= this.config.maxSubscriptionsPerUser) {
          socket.emit('subscription:error', {
            deploymentId,
            error: 'Maximum subscriptions exceeded',
            code: 'SUBSCRIPTION_LIMIT_EXCEEDED'
          });
          return;
        }

        // Join room
        socket.join(deploymentId);
        connection.subscriptions.add(deploymentId);
        
        // Update room info
        this.ensureRoom(deploymentId);
        const room = this.rooms.get(deploymentId)!;
        room.connections.add(socket.id);
        room.lastActivity = new Date();
        room.isActive = true;

        // Update log stream subscriber count
        this.logStreamManager.updateSubscriberCount(deploymentId, 1);
        
        // Send initial logs if requested
        let initialLogs: LogEntry[] = [];
        if ('tail' in options && typeof options.tail === 'number' && options.tail > 0) {
          const { tail, ...otherOptions } = options;
          initialLogs = this.logStreamManager.getLogs(deploymentId, { 
            deploymentId,
            tail,
            ...otherOptions 
          });
        }

        // Send subscription confirmation
        socket.emit('subscription:success', {
          type: 'subscription',
          success: true,
          deploymentId,
          initialLogs,
          options
        });

        this.updateMetrics('subscription_added');
        console.log(`📋 User ${user.email} subscribed to deployment ${deploymentId}`);

      } catch (error) {
        console.error('Subscription error:', error);
        socket.emit('subscription:error', {
          deploymentId: request.deploymentId,
          error: 'Subscription failed',
          code: 'SUBSCRIPTION_ERROR'
        });
      }
    });

    // Unsubscription from deployment logs
    socket.on('unsubscribe', (request: UnsubscriptionRequest) => {
      const { deploymentId } = request;
      
      if (connection.subscriptions.has(deploymentId)) {
        socket.leave(deploymentId);
        connection.subscriptions.delete(deploymentId);
        
        // Update room info
        const room = this.rooms.get(deploymentId);
        if (room) {
          room.connections.delete(socket.id);
          room.lastActivity = new Date();
          
          if (room.connections.size === 0) {
            room.isActive = false;
          }
        }

        // Update log stream subscriber count
        this.logStreamManager.updateSubscriberCount(deploymentId, -1);
        
        socket.emit('unsubscription:success', {
          deploymentId,
          timestamp: new Date()
        });

        this.updateMetrics('subscription_removed');
        console.log(`📋 User ${user.email} unsubscribed from deployment ${deploymentId}`);
      }
    });

    // Heartbeat/ping handling
    socket.on('ping', () => {
      connection.lastActivity = new Date();
      socket.emit('pong', { timestamp: new Date() });
    });

    // Handle disconnection
    socket.on('disconnect', (reason: string) => {
      this.handleDisconnection(socket.id, reason);
    });

    // Error handling
    socket.on('error', (error: Error) => {
      console.error(`❌ Socket error for ${user.email}:`, error);
      this.updateMetrics('error');
    });

    // Activity tracking
    socket.onAny(() => {
      connection.lastActivity = new Date();
    });
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnection(socketId: string, reason: string): void {
    const connection = this.connections.get(socketId);
    if (!connection) return;

    const user = (connection.socket as any).user as WebSocketUser;
    
    // Remove from all subscribed rooms
    for (const deploymentId of connection.subscriptions) {
      const room = this.rooms.get(deploymentId);
      if (room) {
        room.connections.delete(socketId);
        if (room.connections.size === 0) {
          room.isActive = false;
        }
      }
      
      // Update subscriber count
      this.logStreamManager.updateSubscriberCount(deploymentId, -1);
    }
    
    // Remove connection
    this.connections.delete(socketId);
    this.updateMetrics('connection_closed');
    
    console.log(`❌ WebSocket disconnected: ${user.email} (${socketId}) - ${reason}`);
  }

  /**
   * Set up log stream integration
   */
  private setupLogStreamIntegration(): void {
    // Listen for new logs from LogStreamManager
    this.logStreamManager.on('log', (deploymentId: string, logEntry: LogEntry) => {
      this.broadcastLog(deploymentId, logEntry);
    });

    // Listen for deployment status changes (this would come from OrchestrationService)
    this.on('deployment:status', (deploymentId: string, status: string, previousStatus?: string) => {
      this.broadcastDeploymentStatus(deploymentId, status, previousStatus);
      
      // Broadcast to other WebSocket servers via Redis
      if (this.config.redis.enabled && this.redisClient) {
        this.publishToRedis({
          type: 'deployment:status',
          payload: { deploymentId, status, previousStatus },
          timestamp: new Date(),
          serverId: this.serverId
        });
      }
    });
  }

  /**
   * Start background processes
   */
  private startBackgroundProcesses(): void {
    // Metrics collection
    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, 60000); // Every minute

    // Heartbeat monitoring
    this.heartbeatInterval = setInterval(() => {
      this.checkConnectionHealth();
    }, this.config.heartbeatInterval);

    // Cleanup inactive connections and rooms
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.config.cleanupInterval);

    console.log('🔄 WebSocket background processes started');
  }

  /**
   * Ensure room exists for deployment
   */
  private ensureRoom(deploymentId: string): void {
    if (!this.rooms.has(deploymentId)) {
      const room: WebSocketRoom = {
        id: deploymentId,
        connections: new Set(),
        createdAt: new Date(),
        lastActivity: new Date(),
        isActive: false
      };
      
      this.rooms.set(deploymentId, room);
      console.log(`📦 Created room for deployment ${deploymentId}`);
    }
  }

  /**
   * Validate user access to deployment
   */
  private async validateDeploymentAccess(userId: string, deploymentId: string): Promise<boolean> {
    try {
      // Check if deployment exists and user has access
      const deployment = await this.db.getDeploymentById(deploymentId);
      if (!deployment) {
        return false;
      }

      // Get project to check user ownership
      const project = await this.db.getProjectById(deployment.project_id);
      if (!project) {
        return false;
      }

      return project.user_id === userId;
    } catch (error) {
      console.error('Error validating deployment access:', error);
      return false;
    }
  }

  /**
   * Update metrics
   */
  private updateMetrics(event: string, count: number = 1): void {
    switch (event) {
    case 'connection_established':
      this.metrics.totalConnections += count;
      break;
    case 'connection_closed':
      // Active connections updated in getMetrics()
      break;
    case 'message_sent':
      // Update messages per second (simplified)
      this.metrics.messagesPerSecond = (this.metrics.messagesPerSecond + count) / 2;
      break;
    case 'subscription_added':
    case 'subscription_removed':
      // Total subscriptions updated in getMetrics()
      break;
    case 'error':
      this.metrics.errorRate = Math.min(this.metrics.errorRate + 0.01, 1.0);
      break;
    }
  }

  /**
   * Collect and emit metrics
   */
  private collectMetrics(): void {
    const metrics = this.getMetrics();
    this.emit('metrics', metrics);
    
    // Decay error rate over time
    this.metrics.errorRate = Math.max(this.metrics.errorRate * 0.95, 0);
    
    console.log(`📊 WS Metrics: ${metrics.activeConnections} connections, ${metrics.totalSubscriptions} subscriptions`);
  }

  /**
   * Check connection health and remove stale connections
   */
  private checkConnectionHealth(): void {
    const now = Date.now();
    const timeout = this.config.connectionTimeout;
    let removedCount = 0;

    for (const [socketId, connection] of this.connections) {
      const lastActivity = connection.lastActivity.getTime();
      
      if (now - lastActivity > timeout) {
        // Connection is stale, disconnect
        connection.socket.disconnect();
        this.handleDisconnection(socketId, 'timeout');
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(`🧹 Removed ${removedCount} stale connections`);
    }
  }

  /**
   * Perform cleanup of inactive rooms and resources
   */
  private performCleanup(): void {
    const now = Date.now();
    const maxInactiveTime = 300000; // 5 minutes
    let removedRooms = 0;

    for (const [deploymentId, room] of this.rooms) {
      if (room.connections.size === 0 && 
          (now - room.lastActivity.getTime()) > maxInactiveTime) {
        
        this.rooms.delete(deploymentId);
        removedRooms++;
        
        console.log(`🧹 Removed inactive room for deployment ${deploymentId}`);
      }
    }

    if (removedRooms > 0) {
      console.log(`🧹 Cleanup complete: removed ${removedRooms} inactive rooms`);
    }
  }

  /**
   * Setup Redis pub/sub for horizontal scaling
   */
  private setupRedis(): void {
    try {
      // Note: In a real implementation, you would use a Redis client like 'redis' or 'ioredis'
      // For this implementation, we'll prepare the structure but not actually connect
      // since Redis is optional and may not be available in development
      
      console.log('🔴 Redis pub/sub setup prepared (install redis client to enable)');
      console.log(`   Host: ${this.config.redis.host}:${this.config.redis.port}`);
      console.log(`   Key prefix: ${this.config.redis.keyPrefix}`);
      
      // TODO: Implement actual Redis connection
      // const Redis = require('ioredis');
      // this.redisClient = new Redis({
      //   host: this.config.redis.host,
      //   port: this.config.redis.port,
      //   password: this.config.redis.password,
      //   retryDelayOnFailover: 100,
      //   maxRetriesPerRequest: 3
      // });
      
      // this.redisSubscriber = new Redis({
      //   host: this.config.redis.host,
      //   port: this.config.redis.port,
      //   password: this.config.redis.password
      // });
      
      // this.redisSubscriber.subscribe('coderunner:ws:broadcast');
      // this.redisSubscriber.on('message', (channel: string, message: string) => {
      //   this.handleRedisMessage(channel, message);
      // });
      
    } catch (error) {
      console.error('❌ Failed to setup Redis pub/sub:', error);
      console.log('💡 WebSocket will work without Redis, but horizontal scaling will be limited');
    }
  }

  /**
   * Publish message to Redis for other WebSocket servers
   */
  private publishToRedis(message: any): void {
    if (!this.redisClient) return;
    
    try {
      const channel = `${this.config.redis.keyPrefix}broadcast`;
      this.redisClient.publish(channel, JSON.stringify(message));
    } catch (error) {
      console.error('Failed to publish to Redis:', error);
    }
  }

  // Note: Redis message handling would be implemented here when Redis is enabled
  // private handleRedisMessage(channel: string, message: string): void { ... }

  /**
   * Get Redis configuration status
   */
  public getRedisStatus(): { enabled: boolean; connected: boolean; serverId: string } {
    return {
      enabled: this.config.redis.enabled,
      connected: !!this.redisClient,
      serverId: this.serverId
    };
  }

  /**
   * Enhanced broadcast log with Redis support
   */
  public broadcastLogWithRedis(deploymentId: string, logEntry: LogEntry): void {
    // Broadcast locally
    this.broadcastLog(deploymentId, logEntry);
    
    // Broadcast to other servers via Redis
    if (this.config.redis.enabled && this.redisClient) {
      this.publishToRedis({
        type: 'log:entry',
        payload: logEntry,
        timestamp: new Date(),
        serverId: this.serverId
      });
    }
  }
}