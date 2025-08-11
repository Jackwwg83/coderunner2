import { io, Socket } from 'socket.io-client';

export interface DeploymentLog {
  id: string;
  deploymentId: string;
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'trace';
  source: 'system' | 'application' | 'build' | 'deployment';
  message: string;
  data?: any;
  tags?: string[];
  metadata?: {
    component?: string;
    userId?: string;
    sessionId?: string;
    traceId?: string;
  };
}

export interface DeploymentStatus {
  deploymentId: string;
  status: 'deploying' | 'running' | 'stopped' | 'failed';
  updatedAt: string;
  metadata?: any;
}

export interface DeploymentMetrics {
  deploymentId: string;
  cpu: number;
  memory: number;
  network?: {
    in: number;
    out: number;
  };
  timestamp: string;
}

export interface WebSocketState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  reconnectAttempts: number;
  subscriptions: Set<string>;
}

export type WebSocketEventHandlers = {
  'deployment:log': (log: DeploymentLog) => void;
  'deployment:status': (status: DeploymentStatus) => void;
  'deployment:metrics': (metrics: DeploymentMetrics) => void;
  'deployment:error': (error: { deploymentId: string; error: string; timestamp: string }) => void;
  'connection:status': (status: { connected: boolean; userId?: string; timestamp: string }) => void;
  'health:status': (health: { status: 'healthy' | 'degraded' | 'unhealthy'; details?: any }) => void;
};

class WebSocketClient {
  private socket: Socket | null = null;
  private token: string | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private eventHandlers: Map<string, Set<Function>> = new Map();
  private state: WebSocketState = {
    connected: false,
    connecting: false,
    error: null,
    reconnectAttempts: 0,
    subscriptions: new Set()
  };

  private readonly maxReconnectAttempts = 10;
  private readonly reconnectDelay = 1000; // Start with 1 second
  private readonly heartbeatInterval = 30000; // 30 seconds
  private readonly connectionTimeout = 5000; // 5 seconds

  constructor() {
    // Bind methods to preserve context
    this.connect = this.connect.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.handleConnect = this.handleConnect.bind(this);
    this.handleDisconnect = this.handleDisconnect.bind(this);
    this.handleError = this.handleError.bind(this);
    this.startHeartbeat = this.startHeartbeat.bind(this);
    this.stopHeartbeat = this.stopHeartbeat.bind(this);
  }

  /**
   * Connect to WebSocket server with authentication
   */
  connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.state.connecting) {
        return resolve();
      }

      if (this.socket?.connected) {
        return resolve();
      }

      this.token = token;
      this.state.connecting = true;
      this.state.error = null;

      const wsUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/^https?/, 'ws') || 'ws://localhost:8081';
      
      console.log(`🔌 Connecting to WebSocket: ${wsUrl}`);

      this.socket = io(wsUrl, {
        transports: ['websocket'],
        timeout: this.connectionTimeout,
        auth: {
          token: token
        },
        reconnection: false // We handle reconnection manually
      });

      // Set up event listeners
      this.socket.on('connect', () => {
        this.handleConnect();
        resolve();
      });

      this.socket.on('disconnect', this.handleDisconnect);
      this.socket.on('connect_error', (error) => {
        this.handleError(error);
        reject(error);
      });
      this.socket.on('error', this.handleError);

      // Set up application event listeners
      this.setupEventListeners();

      // Connection timeout
      const timeout = setTimeout(() => {
        if (this.state.connecting) {
          this.handleError(new Error('Connection timeout'));
          reject(new Error('Connection timeout'));
        }
      }, this.connectionTimeout);

      this.socket.on('connect', () => clearTimeout(timeout));
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopHeartbeat();

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.state = {
      connected: false,
      connecting: false,
      error: null,
      reconnectAttempts: 0,
      subscriptions: new Set()
    };

    console.log('🔌 WebSocket disconnected');
    this.emit('connection:status', { connected: false, timestamp: new Date().toISOString() });
  }

  /**
   * Subscribe to deployment logs and events
   */
  subscribeToDeployment(deploymentId: string): void {
    if (!this.socket?.connected) {
      console.warn('Cannot subscribe: WebSocket not connected');
      return;
    }

    if (this.state.subscriptions.has(deploymentId)) {
      return; // Already subscribed
    }

    console.log(`📡 Subscribing to deployment: ${deploymentId}`);
    
    this.socket.emit('subscribe:deployment', { deploymentId });
    this.state.subscriptions.add(deploymentId);
  }

  /**
   * Unsubscribe from deployment logs and events
   */
  unsubscribeFromDeployment(deploymentId: string): void {
    if (!this.socket?.connected) {
      return;
    }

    if (!this.state.subscriptions.has(deploymentId)) {
      return; // Not subscribed
    }

    console.log(`📡 Unsubscribing from deployment: ${deploymentId}`);
    
    this.socket.emit('unsubscribe:deployment', { deploymentId });
    this.state.subscriptions.delete(deploymentId);
  }

  /**
   * Add event listener for WebSocket events
   */
  on<K extends keyof WebSocketEventHandlers>(event: K, handler: WebSocketEventHandlers[K]): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler as Function);
  }

  /**
   * Remove event listener
   */
  off<K extends keyof WebSocketEventHandlers>(event: K, handler: WebSocketEventHandlers[K]): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler as Function);
    }
  }

  /**
   * Emit event to registered handlers
   */
  private emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in WebSocket event handler for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Get current WebSocket state
   */
  getState(): WebSocketState {
    return { ...this.state };
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state.connected && this.socket?.connected === true;
  }

  /**
   * Get subscription list
   */
  getSubscriptions(): string[] {
    return Array.from(this.state.subscriptions);
  }

  /**
   * Handle successful connection
   */
  private handleConnect(): void {
    console.log('✅ WebSocket connected successfully');
    
    this.state = {
      ...this.state,
      connected: true,
      connecting: false,
      error: null,
      reconnectAttempts: 0
    };

    this.startHeartbeat();
    this.emit('connection:status', { connected: true, timestamp: new Date().toISOString() });

    // Resubscribe to all previous subscriptions
    this.state.subscriptions.forEach(deploymentId => {
      this.socket?.emit('subscribe:deployment', { deploymentId });
    });
  }

  /**
   * Handle disconnection
   */
  private handleDisconnect(reason: string): void {
    console.log(`🔌 WebSocket disconnected: ${reason}`);
    
    this.state.connected = false;
    this.state.connecting = false;
    this.stopHeartbeat();

    this.emit('connection:status', { connected: false, timestamp: new Date().toISOString() });

    // Auto-reconnect if it wasn't a manual disconnect
    if (reason !== 'io client disconnect' && this.token) {
      this.scheduleReconnect();
    }
  }

  /**
   * Handle connection error
   */
  private handleError(error: any): void {
    console.error('❌ WebSocket error:', error);
    
    this.state.connecting = false;
    this.state.error = error.message || 'WebSocket connection failed';

    if (this.token) {
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule automatic reconnection
   */
  private scheduleReconnect(): void {
    if (this.state.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      this.state.error = 'Max reconnection attempts reached';
      return;
    }

    if (this.reconnectTimer) {
      return; // Already scheduled
    }

    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.state.reconnectAttempts),
      30000 // Max 30 seconds
    );

    console.log(`🔄 Scheduling reconnect in ${delay}ms (attempt ${this.state.reconnectAttempts + 1})`);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      this.state.reconnectAttempts++;

      if (this.token) {
        try {
          await this.connect(this.token);
        } catch (error) {
          console.error('Reconnection failed:', error);
        }
      }
    }, delay);
  }

  /**
   * Set up WebSocket event listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    // Deployment log events
    this.socket.on('deployment:log', (data: DeploymentLog) => {
      this.emit('deployment:log', data);
    });

    // Deployment status events  
    this.socket.on('deployment:status', (data: DeploymentStatus) => {
      this.emit('deployment:status', data);
    });

    // Deployment metrics events
    this.socket.on('deployment:metrics', (data: DeploymentMetrics) => {
      this.emit('deployment:metrics', data);
    });

    // Deployment error events
    this.socket.on('deployment:error', (data: { deploymentId: string; error: string; timestamp: string }) => {
      this.emit('deployment:error', data);
    });

    // Health status events
    this.socket.on('health:status', (data: { status: 'healthy' | 'degraded' | 'unhealthy'; details?: any }) => {
      this.emit('health:status', data);
    });

    // Server heartbeat response
    this.socket.on('heartbeat:pong', () => {
      // Server is responsive
    });
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('heartbeat:ping');
      }
    }, this.heartbeatInterval);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

// Export singleton instance
export const websocketClient = new WebSocketClient();
export default websocketClient;