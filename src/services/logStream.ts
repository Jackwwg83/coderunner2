import { EventEmitter } from 'events';
import { 
  LogEntry, 
  LogBuffer, 
  LogStreamOptions, 
  LogFilterOptions,
  LogStreamStats,
  LogLevel
  // LogSource - imported but not used yet
} from '../types/websocket';
// import { DatabaseService } from './database'; // Commented out until needed

/**
 * LogStreamManager - Manages real-time log streaming with buffering
 * 
 * Features:
 * - In-memory log buffering for fast access
 * - Configurable buffer sizes and retention
 * - Log filtering and search capabilities
 * - Metrics collection and monitoring
 * - Integration with database for persistence
 */
export class LogStreamManager extends EventEmitter {
  private static instance: LogStreamManager;
  private buffers: Map<string, LogBuffer> = new Map(); // deploymentId -> LogBuffer
  private stats: Map<string, LogStreamStats> = new Map();
  private cleanupInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;
  // private _db: DatabaseService; // Commented out to avoid unused variable warning

  // Configuration
  private readonly config = {
    maxBufferSize: parseInt(process.env.LOG_BUFFER_SIZE || '1000'),
    maxRetentionTime: parseInt(process.env.LOG_RETENTION_TIME || '3600000'), // 1 hour
    cleanupInterval: parseInt(process.env.LOG_CLEANUP_INTERVAL || '300000'), // 5 minutes
    metricsInterval: parseInt(process.env.LOG_METRICS_INTERVAL || '60000'), // 1 minute
    persistLogs: process.env.LOG_PERSIST === 'true',
    compressionEnabled: process.env.LOG_COMPRESSION === 'true'
  };

  private constructor() {
    super();
    // this._db = DatabaseService.getInstance(); // Commented out until database integration needed
    this.initializeService();
    console.log('📋 LogStreamManager initialized with buffer size:', this.config.maxBufferSize);
  }

  public static getInstance(): LogStreamManager {
    if (!LogStreamManager.instance) {
      LogStreamManager.instance = new LogStreamManager();
    }
    return LogStreamManager.instance;
  }

  /**
   * Initialize the log stream service
   */
  private initializeService(): void {
    // Start cleanup process
    this.startCleanupProcess();
    
    // Start metrics collection
    this.startMetricsCollection();
    
    // Set up event listeners
    this.setupEventListeners();
  }

  /**
   * Set up internal event listeners
   */
  private setupEventListeners(): void {
    this.on('buffer:full', (deploymentId: string) => {
      console.warn(`📋 Log buffer full for deployment ${deploymentId}`);
    });

    this.on('log:added', (deploymentId: string, _logEntry: LogEntry) => {
      this.updateStats(deploymentId, 'log_added');
    });

    this.on('buffer:cleaned', (deploymentId: string, removedCount: number) => {
      console.log(`🧹 Cleaned ${removedCount} logs from buffer for deployment ${deploymentId}`);
    });
  }

  /**
   * Add a log entry to the stream
   */
  public addLog(logEntry: LogEntry): void {
    const { deploymentId } = logEntry;
    
    // Ensure buffer exists
    this.ensureBuffer(deploymentId);
    
    const buffer = this.buffers.get(deploymentId)!;
    
    // Add log to buffer
    buffer.logs.push(logEntry);
    buffer.lastAccess = new Date();
    
    // Check buffer size and trim if necessary
    if (buffer.logs.length > buffer.maxSize) {
      const removed = buffer.logs.splice(0, buffer.logs.length - buffer.maxSize);
      this.emit('buffer:full', deploymentId);
      
      // Optionally persist removed logs to database
      if (this.config.persistLogs) {
        this.persistLogs(deploymentId, removed).catch(error => {
          console.error(`Failed to persist logs for ${deploymentId}:`, error);
        });
      }
    }
    
    // Update statistics
    this.updateStats(deploymentId, 'log_added');
    
    // Emit log event for real-time streaming
    this.emit('log', deploymentId, logEntry);
    this.emit('log:added', deploymentId, logEntry);
    this.emit('log:entry', deploymentId, logEntry); // For WebSocket integration
    
    // Reference logEntry to avoid unused variable warning
    void logEntry;
  }

  /**
   * Get logs for a deployment with optional filtering
   */
  public getLogs(
    deploymentId: string, 
    options: Partial<LogStreamOptions & LogFilterOptions> = {}
  ): LogEntry[] {
    const buffer = this.buffers.get(deploymentId);
    if (!buffer) {
      return [];
    }

    let logs = [...buffer.logs];
    
    // Apply filters
    if (options.level && options.level.length > 0) {
      logs = logs.filter(log => options.level!.includes(log.level));
    }
    
    if (options.source && options.source.length > 0) {
      logs = logs.filter(log => options.source!.includes(log.source));
    }
    
    if (options.startTime) {
      logs = logs.filter(log => log.timestamp >= options.startTime!);
    }
    
    if (options.endTime) {
      logs = logs.filter(log => log.timestamp <= options.endTime!);
    }
    
    if (options.search) {
      const searchTerm = options.search.toLowerCase();
      logs = logs.filter(log => 
        log.message.toLowerCase().includes(searchTerm) ||
        (log.tags && log.tags.some(tag => tag.toLowerCase().includes(searchTerm)))
      );
    }
    
    if (options.tags && options.tags.length > 0) {
      logs = logs.filter(log => 
        log.tags && options.tags!.some(tag => log.tags!.includes(tag))
      );
    }
    
    // Apply tail limit
    if (options.tail && options.tail > 0) {
      logs = logs.slice(-options.tail);
    }
    
    // Update access time
    buffer.lastAccess = new Date();
    this.updateStats(deploymentId, 'logs_accessed');
    
    return logs;
  }

  /**
   * Get recent logs for initial client sync
   */
  public getRecentLogs(deploymentId: string, count: number = 50): LogEntry[] {
    return this.getLogs(deploymentId, { tail: count });
  }

  /**
   * Clear logs for a deployment
   */
  public clearLogs(deploymentId: string): boolean {
    const buffer = this.buffers.get(deploymentId);
    if (!buffer) {
      return false;
    }

    const clearedCount = buffer.logs.length;
    buffer.logs = [];
    buffer.lastAccess = new Date();
    
    this.emit('buffer:cleared', deploymentId, clearedCount);
    this.updateStats(deploymentId, 'buffer_cleared');
    
    console.log(`🗑️ Cleared ${clearedCount} logs for deployment ${deploymentId}`);
    return true;
  }

  /**
   * Remove buffer for a deployment
   */
  public removeBuffer(deploymentId: string): boolean {
    const buffer = this.buffers.get(deploymentId);
    if (!buffer) {
      return false;
    }

    // Optionally persist remaining logs before removal
    if (this.config.persistLogs && buffer.logs.length > 0) {
      this.persistLogs(deploymentId, buffer.logs).catch(error => {
        console.error(`Failed to persist final logs for ${deploymentId}:`, error);
      });
    }

    this.buffers.delete(deploymentId);
    this.stats.delete(deploymentId);
    
    this.emit('buffer:removed', deploymentId);
    console.log(`🗑️ Removed log buffer for deployment ${deploymentId}`);
    return true;
  }

  /**
   * Get statistics for a deployment
   */
  public getStats(deploymentId: string): LogStreamStats | null {
    return this.stats.get(deploymentId) || null;
  }

  /**
   * Get overall statistics
   */
  public getOverallStats(): {
    totalBuffers: number;
    totalLogs: number;
    totalSubscribers: number;
    memoryUsage: number;
    } {
    const totalLogs = Array.from(this.buffers.values())
      .reduce((sum, buffer) => sum + buffer.logs.length, 0);
    
    const totalSubscribers = Array.from(this.stats.values())
      .reduce((sum, stat) => sum + stat.subscriberCount, 0);
    
    // Approximate memory usage calculation
    const avgLogSize = 500; // bytes
    const memoryUsage = totalLogs * avgLogSize;
    
    return {
      totalBuffers: this.buffers.size,
      totalLogs,
      totalSubscribers,
      memoryUsage
    };
  }

  /**
   * Check if buffer exists for deployment
   */
  public hasBuffer(deploymentId: string): boolean {
    return this.buffers.has(deploymentId);
  }

  /**
   * Get active deployment IDs with buffers
   */
  public getActiveDeployments(): string[] {
    return Array.from(this.buffers.keys());
  }

  /**
   * Subscribe a user to log stream for deployment
   */
  public async subscribe(
    deploymentId: string, 
    userId: string, 
    _options: Partial<LogStreamOptions> = {}
  ): Promise<void> {
    this.ensureStats(deploymentId);
    this.ensureBuffer(deploymentId);
    
    const stats = this.stats.get(deploymentId)!;
    stats.subscriberCount++;
    stats.lastActivity = new Date();
    
    console.log(`📡 User ${userId} subscribed to log stream for deployment ${deploymentId}`);
  }

  /**
   * Unsubscribe a user from log stream
   */
  public async unsubscribe(deploymentId: string, userId: string): Promise<void> {
    const stats = this.stats.get(deploymentId);
    if (stats) {
      stats.subscriberCount = Math.max(0, stats.subscriberCount - 1);
      stats.lastActivity = new Date();
    }
    
    console.log(`📡 User ${userId} unsubscribed from log stream for deployment ${deploymentId}`);
  }

  /**
   * Update subscriber count for a deployment (legacy method)
   */
  public updateSubscriberCount(deploymentId: string, delta: number): void {
    this.ensureStats(deploymentId);
    const stats = this.stats.get(deploymentId)!;
    stats.subscriberCount = Math.max(0, stats.subscriberCount + delta);
    stats.lastActivity = new Date();
  }

  /**
   * Create a system log entry
   */
  public createSystemLog(
    deploymentId: string,
    level: LogLevel,
    message: string,
    data?: any
  ): LogEntry {
    const logEntry = this.createLogEntry(
      deploymentId,
      level,
      'system',
      message,
      data,
      ['system']
    );
    
    this.addLog(logEntry);
    return logEntry;
  }

  /**
   * Create an application log entry
   */
  public createApplicationLog(
    deploymentId: string,
    level: LogLevel,
    message: string,
    data?: any
  ): LogEntry {
    const logEntry = this.createLogEntry(
      deploymentId,
      level,
      'application',
      message,
      data
    );
    
    this.addLog(logEntry);
    return logEntry;
  }

  /**
   * Create a build log entry
   */
  public createBuildLog(
    deploymentId: string,
    level: LogLevel,
    message: string,
    data?: any
  ): LogEntry {
    const logEntry = this.createLogEntry(
      deploymentId,
      level,
      'build',
      message,
      data,
      ['build']
    );
    
    this.addLog(logEntry);
    return logEntry;
  }

  /**
   * Create a deployment log entry
   */
  public createDeploymentLog(
    deploymentId: string,
    level: LogLevel,
    message: string,
    data?: any
  ): LogEntry {
    const logEntry = this.createLogEntry(
      deploymentId,
      level,
      'deployment',
      message,
      data,
      ['deployment']
    );
    
    this.addLog(logEntry);
    return logEntry;
  }

  /**
   * Cleanup and stop the service
   */
  public async cleanup(): Promise<void> {
    console.log('🧹 Starting LogStreamManager cleanup...');
    
    // Stop intervals
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    
    // Persist all remaining logs if enabled
    if (this.config.persistLogs) {
      const persistPromises: Promise<void>[] = [];
      
      for (const [deploymentId, buffer] of this.buffers) {
        if (buffer.logs.length > 0) {
          persistPromises.push(this.persistLogs(deploymentId, buffer.logs));
        }
      }
      
      try {
        await Promise.all(persistPromises);
        console.log('✅ All logs persisted successfully');
      } catch (error) {
        console.error('❌ Error persisting logs during cleanup:', error);
      }
    }
    
    // Clear memory
    this.buffers.clear();
    this.stats.clear();
    
    console.log('✅ LogStreamManager cleanup completed');
  }

  // ==================== PRIVATE METHODS ====================

  /**
   * Ensure buffer exists for deployment
   */
  private ensureBuffer(deploymentId: string): void {
    if (!this.buffers.has(deploymentId)) {
      const buffer: LogBuffer = {
        deploymentId,
        logs: [],
        maxSize: this.config.maxBufferSize,
        createdAt: new Date(),
        lastAccess: new Date()
      };
      
      this.buffers.set(deploymentId, buffer);
      this.ensureStats(deploymentId);
      
      console.log(`📋 Created new log buffer for deployment ${deploymentId}`);
    }
  }

  /**
   * Ensure stats exist for deployment
   */
  private ensureStats(deploymentId: string): void {
    if (!this.stats.has(deploymentId)) {
      const stats: LogStreamStats = {
        deploymentId,
        totalLogs: 0,
        bufferSize: 0,
        subscriberCount: 0,
        lastActivity: new Date(),
        logRate: 0,
        avgLatency: 0
      };
      
      this.stats.set(deploymentId, stats);
    }
  }

  /**
   * Update statistics for a deployment
   */
  private updateStats(deploymentId: string, action: string): void {
    this.ensureStats(deploymentId);
    const stats = this.stats.get(deploymentId)!;
    const buffer = this.buffers.get(deploymentId);
    
    switch (action) {
    case 'log_added':
      stats.totalLogs++;
      stats.bufferSize = buffer?.logs.length || 0;
      break;
    case 'logs_accessed':
      // Update access statistics
      break;
    case 'buffer_cleared':
      stats.bufferSize = 0;
      break;
    }
    
    stats.lastActivity = new Date();
  }

  /**
   * Start cleanup process for old buffers
   */
  private startCleanupProcess(): void {
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.config.cleanupInterval);
    
    console.log(`🔄 Log cleanup process started (interval: ${this.config.cleanupInterval}ms)`);
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, this.config.metricsInterval);
    
    console.log(`📊 Log metrics collection started (interval: ${this.config.metricsInterval}ms)`);
  }

  /**
   * Perform cleanup of old buffers and logs
   */
  private performCleanup(): void {
    const now = Date.now();
    const maxAge = this.config.maxRetentionTime;
    let cleanedBuffers = 0;
    let cleanedLogs = 0;
    
    for (const [deploymentId, buffer] of this.buffers) {
      const age = now - buffer.lastAccess.getTime();
      
      if (age > maxAge) {
        // Remove entire buffer if not accessed recently
        this.removeBuffer(deploymentId);
        cleanedBuffers++;
      } else {
        // Clean old logs from buffer
        const cutoffTime = new Date(now - maxAge);
        const originalLength = buffer.logs.length;
        buffer.logs = buffer.logs.filter(log => log.timestamp > cutoffTime);
        const removed = originalLength - buffer.logs.length;
        
        if (removed > 0) {
          cleanedLogs += removed;
          this.emit('buffer:cleaned', deploymentId, removed);
        }
      }
    }
    
    if (cleanedBuffers > 0 || cleanedLogs > 0) {
      console.log(`🧹 Cleanup complete: ${cleanedBuffers} buffers, ${cleanedLogs} logs removed`);
    }
  }

  /**
   * Collect and emit metrics
   */
  private collectMetrics(): void {
    const overallStats = this.getOverallStats();
    this.emit('metrics', overallStats);
    
    // Log high-level metrics periodically
    if (overallStats.totalBuffers > 0) {
      console.log(`📊 Log metrics: ${overallStats.totalBuffers} buffers, ${overallStats.totalLogs} logs, ${Math.round(overallStats.memoryUsage / 1024 / 1024)}MB`);
    }
  }

  /**
   * Persist logs to database (if enabled)
   */
  private async persistLogs(deploymentId: string, logs: LogEntry[]): Promise<void> {
    if (!this.config.persistLogs || logs.length === 0) {
      return;
    }

    try {
      // Note: This would require a logs table in the database schema
      // For now, we'll just log that we would persist them
      console.log(`💾 Would persist ${logs.length} logs for deployment ${deploymentId}`);
      
      // TODO: Implement actual database persistence
      // await this.db.insertLogs(deploymentId, logs);
      
    } catch (error) {
      console.error(`Failed to persist logs for ${deploymentId}:`, error);
      throw error;
    }
  }

  /**
   * Generate unique log ID
   */
  private generateLogId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create log entry with sequence number
   */
  private createLogEntry(
    deploymentId: string,
    level: LogLevel,
    source: 'system' | 'application' | 'build' | 'deployment',
    message: string,
    data?: any,
    tags?: string[]
  ): LogEntry {
    // Get current buffer to determine sequence number
    this.ensureBuffer(deploymentId);
    const buffer = this.buffers.get(deploymentId)!;
    const sequence = buffer.logs.length;

    return {
      id: this.generateLogId(),
      deploymentId,
      timestamp: new Date(),
      level,
      source,
      message,
      data,
      tags: tags || undefined,
      sequence
    };
  }
}