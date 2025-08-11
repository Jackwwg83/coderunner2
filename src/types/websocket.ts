// WebSocket and Real-time Log Streaming Types
import { Socket } from 'socket.io';
import { JWTPayload } from './index';

// ========================================
// ENHANCED SOCKET AND CONNECTION TYPES
// ========================================

/**
 * Authenticated Socket with user information
 */
export interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: JWTPayload;
  userRooms?: Set<string>; // Renamed to avoid conflict with Socket.rooms
  isAuthenticated: boolean;
  lastActivity: Date;
  rateLimitBucket?: RateLimitBucket;
  metadata?: ConnectionMetadata;
}

export interface LogEntry {
  id: string;
  deploymentId: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug' | 'trace' | 'fatal';
  source: 'system' | 'application' | 'build' | 'deployment' | 'container';
  message: string;
  data?: any;
  tags?: string[] | undefined;
  sequence: number; // For ordering
  category?: string;
}

export interface LogStreamOptions {
  deploymentId: string;
  level?: LogLevel;
  source?: LogSource;
  tail?: number; // Number of recent logs to send initially
  follow?: boolean; // Whether to stream new logs
}

export type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'trace';
export type LogSource = 'system' | 'application' | 'build' | 'deployment';

export interface WebSocketAuthPayload {
  token: string;
  deploymentId?: string;
}

export interface WebSocketUser {
  userId: string;
  email: string;
  planType: string;
}

export interface WebSocketConnection {
  id: string;
  socket: any; // Socket.IO socket
  userId: string;
  subscriptions: Set<string>; // Set of deployment IDs
  connectedAt: Date;
  lastActivity: Date;
}

export interface LogStreamEvent {
  type: 'log' | 'status' | 'error' | 'heartbeat';
  deploymentId: string;
  timestamp: Date;
  data: any;
}

export interface DeploymentStatusEvent {
  type: 'status';
  deploymentId: string;
  status: string;
  timestamp: Date;
  previousStatus?: string;
  metadata?: any;
}

export interface LogBuffer {
  deploymentId: string;
  logs: LogEntry[];
  maxSize: number;
  createdAt: Date;
  lastAccess: Date;
}

export interface WebSocketMetrics {
  totalConnections: number;
  activeConnections: number;
  authenticatedConnections: number;
  totalSubscriptions: number;
  messagesPerSecond: number;
  avgLatency: number;
  errorRate: number;
  connectionsByRoom: { [room: string]: number };
  totalMessages: number;
  uptime: number;
}

export interface ConnectionMetadata {
  userAgent?: string;
  ip?: string;
  country?: string;
  connectTime: Date;
  lastPing: Date;
  reconnectCount: number;
  latency: number;
  dataTransferred: number;
}

/**
 * Rate limiting bucket for connection
 */
export interface RateLimitBucket {
  userId: string;
  requests: number;
  resetTime: number;
  isBlocked: boolean;
}

/**
 * WebSocket service configuration
 */
export interface WebSocketServiceConfig {
  port?: number;
  cors?: {
    origin: string | string[];
    credentials: boolean;
  };
  connectionTimeout?: number;
  heartbeatInterval?: number;
  maxConnections?: number;
  rateLimiting?: {
    requests: number;
    window: number; // milliseconds
  };
  redis?: {
    enabled: boolean;
    host?: string;
    port?: number;
    password?: string;
  };
}

/**
 * Redis pub/sub message for horizontal scaling
 */
export interface RedisMessage {
  type: 'log:entry' | 'deployment:status' | 'system:notification';
  payload: any;
  timestamp: Date;
  serverId: string;
  targetRoom?: string;
  targetUser?: string;
}

export interface LogStreamConfig {
  maxBufferSize: number;
  maxConnections: number;
  heartbeatInterval: number;
  connectionTimeout: number;
  maxReconnectAttempts: number;
  logRetentionTime: number; // in milliseconds
  compressionEnabled: boolean;
  rateLimitEnabled: boolean;
  maxMessagesPerSecond: number;
}

export interface WebSocketRoom {
  id: string; // deployment ID
  connections: Set<string>; // connection IDs
  createdAt: Date;
  lastActivity: Date;
  isActive: boolean;
}

export interface LogFilterOptions {
  level?: LogLevel[];
  source?: LogSource[];
  startTime?: Date;
  endTime?: Date;
  search?: string;
  tags?: string[];
}

export interface WebSocketError {
  code: string;
  message: string;
  timestamp: Date;
  connectionId?: string;
  deploymentId?: string;
  context?: any;
}

export interface LogStreamStats {
  deploymentId: string;
  totalLogs: number;
  bufferSize: number;
  subscriberCount: number;
  lastActivity: Date;
  logRate: number; // logs per second
  avgLatency: number;
}

// Events that can be emitted/received through WebSocket
export type WebSocketEventType = 
  | 'authenticate'
  | 'subscribe'
  | 'unsubscribe' 
  | 'log'
  | 'status'
  | 'error'
  | 'heartbeat'
  | 'deployment:status'
  | 'deployment:logs'
  | 'system:alert'
  | 'connection:status';

export interface WebSocketMessage {
  type: WebSocketEventType;
  payload: any;
  timestamp: Date;
  requestId?: string;
  deploymentId?: string;
}

export interface SubscriptionRequest {
  type: 'subscribe';
  deploymentId: string;
  options?: LogStreamOptions;
}

export interface UnsubscriptionRequest {
  type: 'unsubscribe';
  deploymentId: string;
}

export interface AuthenticationRequest {
  type: 'authenticate';
  token: string;
}

export interface AuthenticationResponse {
  type: 'authentication';
  success: boolean;
  userId?: string;
  error?: string;
}

export interface SubscriptionResponse {
  type: 'subscription';
  success: boolean;
  deploymentId: string;
  initialLogs?: LogEntry[];
  error?: string;
}

export interface HeartbeatMessage {
  type: 'heartbeat';
  timestamp: Date;
  connectionId: string;
  serverTime: Date;
  latency?: number;
}

// ========================================
// ENHANCED MESSAGE TYPES
// ========================================

/**
 * Log buffer for delayed subscribers
 */
export interface LogBufferEntry {
  deploymentId: string;
  entries: LogEntry[];
  maxSize: number;
  createdAt: Date;
  lastAccessed: Date;
  subscriberCount: number;
}

/**
 * Connection information for monitoring
 */
export interface ConnectionInfo {
  socketId: string;
  userId?: string;
  email?: string;
  connectedAt: Date;
  lastActivity: Date;
  rooms: string[];
  ipAddress: string;
  userAgent?: string;
  latency: number;
  isAuthenticated: boolean;
}

/**
 * WebSocket middleware function type
 */
export type WebSocketMiddleware = (
  socket: AuthenticatedSocket,
  next: (err?: Error) => void
) => void;

/**
 * Message handler function type
 */
export type MessageHandler<T extends WebSocketMessage = WebSocketMessage> = (
  message: T,
  socket: AuthenticatedSocket
) => Promise<void> | void;

/**
 * Room naming utilities
 */
export interface RoomNames {
  deployment: (deploymentId: string) => string;
  user: (userId: string) => string;
  system: () => string;
}

/**
 * Enhanced deployment status with metadata
 */
export interface EnhancedDeploymentStatusEvent extends DeploymentStatusEvent {
  healthCheck?: {
    status: 'healthy' | 'unhealthy' | 'unknown';
    lastCheck: Date;
    details?: any;
  };
  resources?: {
    cpu: number;
    memory: number;
    disk: number;
  };
}

/**
 * System-wide log stream statistics
 */
export interface SystemLogStats {
  totalStreams: number;
  totalBufferSize: number;
  activeSubscriptions: number;
  subscriptionsByDeployment: { [deploymentId: string]: number };
  messagesPerSecond: number;
  errorRate: number;
  averageLatency: number;
  uptime: number;
}