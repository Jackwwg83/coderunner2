/**
 * Database Scheduler Service
 * P3-T03 Implementation for CodeRunner v2.0
 * 
 * Handles scheduled database operations:
 * - Automated backup scheduling
 * - Maintenance window management
 * - Lifecycle management (TTL, cleanup)
 * - Auto-scaling schedules
 * - Cost optimization scheduling
 * - Cold storage migration
 */

import { EventEmitter } from 'events';
import * as cron from 'node-cron';
import { logger } from '../utils/logger';
import { DatabaseRegistry } from './databaseRegistry';
import { Deployment, DeploymentStatus, BackupInfo } from './databaseOrchestrator';

/**
 * Scheduled task types
 */
export enum TaskType {
  BACKUP = 'backup',
  MAINTENANCE = 'maintenance',
  CLEANUP = 'cleanup',
  SCALING = 'scaling',
  OPTIMIZATION = 'optimization',
  COLD_STORAGE = 'cold_storage',
  TTL_CLEANUP = 'ttl_cleanup'
}

/**
 * Task execution status
 */
export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

/**
 * Scheduled task interface
 */
export interface ScheduledTask {
  id: string;
  deploymentId: string;
  type: TaskType;
  cronExpression: string;
  status: TaskStatus;
  config: TaskConfig;
  nextRun: Date;
  lastRun?: Date;
  lastResult?: TaskResult;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Task configuration
 */
export interface TaskConfig {
  // Common configuration
  timeout?: number; // milliseconds
  priority?: number; // 1-10, higher is more important
  
  // Backup specific
  backupType?: 'full' | 'incremental' | 'differential';
  compression?: boolean;
  encryption?: boolean;
  retention?: number; // days
  
  // Maintenance specific
  maintenanceType?: 'update' | 'reindex' | 'vacuum' | 'analyze';
  
  // Scaling specific
  targetReplicas?: number;
  scalingPolicy?: string;
  
  // Optimization specific
  optimizationType?: 'performance' | 'cost' | 'storage';
  
  // Cold storage specific
  ageThreshold?: number; // days
  storageClass?: string;
}

/**
 * Task execution result
 */
export interface TaskResult {
  success: boolean;
  startTime: Date;
  endTime: Date;
  duration: number; // milliseconds
  output?: string;
  error?: string;
  metrics?: Record<string, number>;
}

/**
 * Maintenance window definition
 */
export interface MaintenanceWindow {
  start: string; // HH:MM format
  end: string; // HH:MM format
  timezone: string;
  daysOfWeek: number[]; // 0-6, Sunday is 0
  duration: number; // minutes
  type: 'weekly' | 'daily' | 'monthly';
}

/**
 * Scaling schedule configuration
 */
export interface ScalingSchedule {
  scaleUp: {
    cron: string;
    replicas: number;
  };
  scaleDown: {
    cron: string;
    replicas: number;
  };
  autoScale?: {
    enabled: boolean;
    minReplicas: number;
    maxReplicas: number;
  };
}

/**
 * Scheduler statistics
 */
export interface SchedulerStats {
  totalTasks: number;
  activeTasks: number;
  completedTasks: number;
  failedTasks: number;
  nextScheduledTasks: ScheduledTask[];
  averageExecutionTime: number;
  successRate: number;
}

/**
 * Database Scheduler Service
 */
export class DatabaseScheduler extends EventEmitter {
  private static instance: DatabaseScheduler;
  private tasks: Map<string, ScheduledTask> = new Map();
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();
  private runningTasks: Map<string, Promise<TaskResult>> = new Map();
  private registry: DatabaseRegistry;
  
  private constructor() {
    super();
    this.registry = DatabaseRegistry.getInstance();
    this.initializeScheduler();
    logger.info('DatabaseScheduler initialized');
  }

  public static getInstance(): DatabaseScheduler {
    if (!DatabaseScheduler.instance) {
      DatabaseScheduler.instance = new DatabaseScheduler();
    }
    return DatabaseScheduler.instance;
  }

  /**
   * Initialize the scheduler
   */
  private async initializeScheduler(): Promise<void> {
    // Load existing tasks
    await this.loadExistingTasks();
    
    // Start background processes
    this.startCleanupProcess();
    this.startTaskMonitoring();
    
    // Set up event listeners
    this.setupEventListeners();
    
    logger.info('DatabaseScheduler initialization complete');
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    this.on('task:scheduled', (task: ScheduledTask) => {
      logger.info(`Task scheduled: ${task.id} (${task.type}) for deployment: ${task.deploymentId}`);
    });
    
    this.on('task:started', (taskId: string) => {
      logger.info(`Task started: ${taskId}`);
    });
    
    this.on('task:completed', (taskId: string, result: TaskResult) => {
      if (result.success) {
        logger.info(`Task completed: ${taskId} in ${result.duration}ms`);
      } else {
        logger.error(`Task failed: ${taskId}`, result.error);
      }
    });
    
    this.on('task:cancelled', (taskId: string) => {
      logger.info(`Task cancelled: ${taskId}`);
    });
  }

  /**
   * Schedule a backup task
   */
  public async scheduleBackup(deploymentId: string, cronExpression: string, config?: Partial<TaskConfig>): Promise<string> {
    const deployment = this.registry.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }
    
    const taskConfig: TaskConfig = {
      backupType: 'full',
      compression: true,
      encryption: false,
      retention: 30,
      timeout: 3600000, // 1 hour
      priority: 5,
      ...config
    };
    
    const task = this.createTask(deploymentId, TaskType.BACKUP, cronExpression, taskConfig);
    return this.scheduleTask(task);
  }

  /**
   * Schedule maintenance for a deployment
   */
  public async scheduleMaintenance(deploymentId: string, window: MaintenanceWindow, config?: Partial<TaskConfig>): Promise<string> {
    const deployment = this.registry.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }
    
    // Convert maintenance window to cron expression
    const cronExpression = this.maintenanceWindowToCron(window);
    
    const taskConfig: TaskConfig = {
      maintenanceType: 'update',
      timeout: 7200000, // 2 hours
      priority: 8,
      ...config
    };
    
    const task = this.createTask(deploymentId, TaskType.MAINTENANCE, cronExpression, taskConfig);
    return this.scheduleTask(task);
  }

  /**
   * Schedule deployment destruction (TTL)
   */
  public async scheduleDestruction(deploymentId: string, ttl: number): Promise<string> {
    const deployment = this.registry.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }
    
    const destructionTime = new Date(Date.now() + ttl);
    const cronExpression = this.dateToCron(destructionTime);
    
    const taskConfig: TaskConfig = {
      timeout: 600000, // 10 minutes
      priority: 10 // Highest priority
    };
    
    const task = this.createTask(deploymentId, TaskType.TTL_CLEANUP, cronExpression, taskConfig, 1); // Run only once
    return this.scheduleTask(task);
  }

  /**
   * Schedule scaling operations
   */
  public async scheduleScaling(deploymentId: string, schedule: ScalingSchedule): Promise<string[]> {
    const deployment = this.registry.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }
    
    const taskIds: string[] = [];
    
    // Schedule scale up
    if (schedule.scaleUp) {
      const scaleUpConfig: TaskConfig = {
        targetReplicas: schedule.scaleUp.replicas,
        timeout: 1800000, // 30 minutes
        priority: 7
      };
      
      const scaleUpTask = this.createTask(deploymentId, TaskType.SCALING, schedule.scaleUp.cron, scaleUpConfig);
      taskIds.push(await this.scheduleTask(scaleUpTask));
    }
    
    // Schedule scale down
    if (schedule.scaleDown) {
      const scaleDownConfig: TaskConfig = {
        targetReplicas: schedule.scaleDown.replicas,
        timeout: 1800000, // 30 minutes
        priority: 6
      };
      
      const scaleDownTask = this.createTask(deploymentId, TaskType.SCALING, schedule.scaleDown.cron, scaleDownConfig);
      taskIds.push(await this.scheduleTask(scaleDownTask));
    }
    
    return taskIds;
  }

  /**
   * Schedule optimization tasks
   */
  public async scheduleOptimization(deploymentId: string, cronExpression: string = '0 2 * * *'): Promise<string> {
    const deployment = this.registry.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }
    
    const taskConfig: TaskConfig = {
      optimizationType: 'performance',
      timeout: 3600000, // 1 hour
      priority: 4
    };
    
    const task = this.createTask(deploymentId, TaskType.OPTIMIZATION, cronExpression, taskConfig);
    return this.scheduleTask(task);
  }

  /**
   * Schedule cold storage migration
   */
  public async scheduleColdStorage(deploymentId: string, age: number, cronExpression: string = '0 3 * * 0'): Promise<string> {
    const deployment = this.registry.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }
    
    const taskConfig: TaskConfig = {
      ageThreshold: age,
      storageClass: 'cold',
      timeout: 7200000, // 2 hours
      priority: 3
    };
    
    const task = this.createTask(deploymentId, TaskType.COLD_STORAGE, cronExpression, taskConfig);
    return this.scheduleTask(task);
  }

  /**
   * Cancel a scheduled task
   */
  public async cancelTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    
    // Cancel cron job
    const cronJob = this.cronJobs.get(taskId);
    if (cronJob) {
      cronJob.destroy();
      this.cronJobs.delete(taskId);
    }
    
    // Cancel running task
    const runningTask = this.runningTasks.get(taskId);
    if (runningTask) {
      // Note: Can't directly cancel a running promise, but we can mark it as cancelled
      task.status = TaskStatus.CANCELLED;
      this.runningTasks.delete(taskId);
    }
    
    // Update task status
    task.status = TaskStatus.CANCELLED;
    task.updatedAt = new Date();
    this.tasks.set(taskId, task);
    
    this.emit('task:cancelled', taskId);
    logger.info(`Task cancelled: ${taskId}`);
  }

  /**
   * Cancel all scheduled tasks for a deployment
   */
  public async cancelScheduledTasks(deploymentId: string): Promise<void> {
    const deploymentTasks = Array.from(this.tasks.values())
      .filter(task => task.deploymentId === deploymentId && task.status === TaskStatus.PENDING);
    
    for (const task of deploymentTasks) {
      await this.cancelTask(task.id);
    }
    
    logger.info(`Cancelled ${deploymentTasks.length} scheduled tasks for deployment: ${deploymentId}`);
  }

  /**
   * Cancel backup schedule for a deployment
   */
  public async cancelBackupSchedule(deploymentId: string): Promise<void> {
    const backupTasks = Array.from(this.tasks.values())
      .filter(task => task.deploymentId === deploymentId && 
                     task.type === TaskType.BACKUP && 
                     task.status === TaskStatus.PENDING);
    
    for (const task of backupTasks) {
      await this.cancelTask(task.id);
    }
    
    logger.info(`Cancelled backup schedule for deployment: ${deploymentId}`);
  }

  /**
   * Get scheduled tasks for a deployment
   */
  public getScheduledTasks(deploymentId: string): ScheduledTask[] {
    return Array.from(this.tasks.values())
      .filter(task => task.deploymentId === deploymentId)
      .sort((a, b) => a.nextRun.getTime() - b.nextRun.getTime());
  }

  /**
   * Get all scheduled tasks
   */
  public getAllTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values())
      .sort((a, b) => a.nextRun.getTime() - b.nextRun.getTime());
  }

  /**
   * Get next scheduled tasks
   */
  public getNextTasks(limit: number = 10): ScheduledTask[] {
    return Array.from(this.tasks.values())
      .filter(task => task.status === TaskStatus.PENDING)
      .sort((a, b) => a.nextRun.getTime() - b.nextRun.getTime())
      .slice(0, limit);
  }

  /**
   * Get scheduler statistics
   */
  public getStats(): SchedulerStats {
    const tasks = Array.from(this.tasks.values());
    const completedTasks = tasks.filter(t => t.status === TaskStatus.COMPLETED);
    const failedTasks = tasks.filter(t => t.status === TaskStatus.FAILED);
    
    // Calculate average execution time
    const executionTimes = completedTasks
      .map(t => t.lastResult?.duration)
      .filter(d => d !== undefined) as number[];
    const averageExecutionTime = executionTimes.length > 0 
      ? executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length 
      : 0;
    
    // Calculate success rate
    const totalFinishedTasks = completedTasks.length + failedTasks.length;
    const successRate = totalFinishedTasks > 0 ? (completedTasks.length / totalFinishedTasks) * 100 : 100;
    
    return {
      totalTasks: tasks.length,
      activeTasks: tasks.filter(t => t.status === TaskStatus.PENDING || t.status === TaskStatus.RUNNING).length,
      completedTasks: completedTasks.length,
      failedTasks: failedTasks.length,
      nextScheduledTasks: this.getNextTasks(5),
      averageExecutionTime,
      successRate
    };
  }

  // ==================== PRIVATE HELPER METHODS ====================

  /**
   * Load existing tasks from storage
   */
  private async loadExistingTasks(): Promise<void> {
    try {
      // TODO: Load from database
      // const result = await this.db.query('SELECT * FROM scheduled_tasks WHERE status IN ($1, $2)', [TaskStatus.PENDING, TaskStatus.RUNNING]);
      // result.rows.forEach(row => this.restoreTask(row));
      
      logger.info('Existing scheduled tasks loaded');
    } catch (error) {
      logger.error('Failed to load existing tasks:', error);
    }
  }

  /**
   * Start cleanup process for completed/failed tasks
   */
  private startCleanupProcess(): void {
    // Clean up old tasks every hour
    setInterval(() => {
      this.cleanupOldTasks();
    }, 3600000); // 1 hour
    
    logger.info('Task cleanup process started');
  }

  /**
   * Start task monitoring process
   */
  private startTaskMonitoring(): void {
    // Monitor running tasks every minute
    setInterval(() => {
      this.monitorRunningTasks();
    }, 60000); // 1 minute
    
    logger.info('Task monitoring started');
  }

  /**
   * Create a new scheduled task
   */
  private createTask(
    deploymentId: string,
    type: TaskType,
    cronExpression: string,
    config: TaskConfig,
    maxRetries: number = 3
  ): ScheduledTask {
    const taskId = this.generateTaskId();
    const now = new Date();
    
    // Calculate next run time
    const nextRun = this.getNextRunTime(cronExpression, now);
    
    return {
      id: taskId,
      deploymentId,
      type,
      cronExpression,
      status: TaskStatus.PENDING,
      config,
      nextRun,
      retryCount: 0,
      maxRetries,
      createdAt: now,
      updatedAt: now
    };
  }

  /**
   * Schedule a task
   */
  private async scheduleTask(task: ScheduledTask): Promise<string> {
    // Store task
    this.tasks.set(task.id, task);
    
    // Create cron job
    const cronJob = cron.schedule(task.cronExpression, async () => {
      await this.executeTask(task.id);
    }, {
      scheduled: true,
      timezone: 'UTC'
    });
    
    this.cronJobs.set(task.id, cronJob);
    
    // Persist task
    await this.persistTask(task);
    
    this.emit('task:scheduled', task);
    logger.info(`Task scheduled: ${task.id} for ${task.nextRun.toISOString()}`);
    
    return task.id;
  }

  /**
   * Execute a scheduled task
   */
  private async executeTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== TaskStatus.PENDING) {
      return;
    }
    
    // Check if deployment still exists
    const deployment = this.registry.get(task.deploymentId);
    if (!deployment) {
      logger.warn(`Deployment not found for task: ${taskId}, cancelling task`);
      await this.cancelTask(taskId);
      return;
    }
    
    // Update task status
    task.status = TaskStatus.RUNNING;
    task.lastRun = new Date();
    task.updatedAt = new Date();
    this.tasks.set(taskId, task);
    
    this.emit('task:started', taskId);
    
    // Execute the task
    const executionPromise = this.performTaskExecution(task, deployment);
    this.runningTasks.set(taskId, executionPromise);
    
    try {
      const result = await executionPromise;
      await this.handleTaskResult(taskId, result);
    } catch (error) {
      await this.handleTaskError(taskId, error as Error);
    } finally {
      this.runningTasks.delete(taskId);
    }
  }

  /**
   * Perform the actual task execution
   */
  private async performTaskExecution(task: ScheduledTask, deployment: Deployment): Promise<TaskResult> {
    const startTime = new Date();
    
    try {
      let output = '';
      let success = false;
      
      switch (task.type) {
        case TaskType.BACKUP:
          output = await this.executeBackupTask(task, deployment);
          success = true;
          break;
        
        case TaskType.MAINTENANCE:
          output = await this.executeMaintenanceTask(task, deployment);
          success = true;
          break;
        
        case TaskType.SCALING:
          output = await this.executeScalingTask(task, deployment);
          success = true;
          break;
        
        case TaskType.OPTIMIZATION:
          output = await this.executeOptimizationTask(task, deployment);
          success = true;
          break;
        
        case TaskType.COLD_STORAGE:
          output = await this.executeColdStorageTask(task, deployment);
          success = true;
          break;
        
        case TaskType.TTL_CLEANUP:
          output = await this.executeTTLCleanupTask(task, deployment);
          success = true;
          break;
        
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }
      
      const endTime = new Date();
      
      return {
        success,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        output
      };
      
    } catch (error) {
      const endTime = new Date();
      
      return {
        success: false,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Execute backup task
   */
  private async executeBackupTask(task: ScheduledTask, deployment: Deployment): Promise<string> {
    // Import the orchestrator at execution time to avoid circular dependency
    const { DatabaseOrchestrator } = await import('./databaseOrchestrator');
    const orchestrator = DatabaseOrchestrator.getInstance();
    
    const backupInfo = await orchestrator.backupDatabase(deployment.id);
    return `Backup created: ${backupInfo.id}`;
  }

  /**
   * Execute maintenance task
   */
  private async executeMaintenanceTask(task: ScheduledTask, deployment: Deployment): Promise<string> {
    // TODO: Implement maintenance task execution
    const maintenanceType = task.config.maintenanceType || 'update';
    return `Maintenance completed: ${maintenanceType} for ${deployment.id}`;
  }

  /**
   * Execute scaling task
   */
  private async executeScalingTask(task: ScheduledTask, deployment: Deployment): Promise<string> {
    const { DatabaseOrchestrator } = await import('./databaseOrchestrator');
    const orchestrator = DatabaseOrchestrator.getInstance();
    
    const targetReplicas = task.config.targetReplicas || 1;
    await orchestrator.scaleDatabase(deployment.id, targetReplicas);
    return `Scaling completed: ${deployment.id} → ${targetReplicas} replicas`;
  }

  /**
   * Execute optimization task
   */
  private async executeOptimizationTask(task: ScheduledTask, deployment: Deployment): Promise<string> {
    // TODO: Implement optimization task execution
    const optimizationType = task.config.optimizationType || 'performance';
    return `Optimization completed: ${optimizationType} for ${deployment.id}`;
  }

  /**
   * Execute cold storage task
   */
  private async executeColdStorageTask(task: ScheduledTask, deployment: Deployment): Promise<string> {
    // TODO: Implement cold storage migration
    const ageThreshold = task.config.ageThreshold || 90;
    return `Cold storage migration completed: ${deployment.id} (age > ${ageThreshold} days)`;
  }

  /**
   * Execute TTL cleanup task
   */
  private async executeTTLCleanupTask(task: ScheduledTask, deployment: Deployment): Promise<string> {
    const { DatabaseOrchestrator } = await import('./databaseOrchestrator');
    const orchestrator = DatabaseOrchestrator.getInstance();
    
    await orchestrator.destroyDatabase(deployment.id);
    
    // Cancel the task since deployment is destroyed
    await this.cancelTask(task.id);
    
    return `TTL cleanup completed: ${deployment.id} destroyed`;
  }

  /**
   * Handle successful task execution
   */
  private async handleTaskResult(taskId: string, result: TaskResult): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;
    
    task.status = TaskStatus.COMPLETED;
    task.lastResult = result;
    task.retryCount = 0; // Reset retry count on success
    task.nextRun = this.getNextRunTime(task.cronExpression, new Date());
    task.updatedAt = new Date();
    
    // Mark task as pending for next execution (unless it's a one-time task)
    if (task.maxRetries !== 1 && task.type !== TaskType.TTL_CLEANUP) {
      task.status = TaskStatus.PENDING;
    }
    
    this.tasks.set(taskId, task);
    await this.persistTask(task);
    
    this.emit('task:completed', taskId, result);
  }

  /**
   * Handle task execution error
   */
  private async handleTaskError(taskId: string, error: Error): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;
    
    task.retryCount++;
    task.lastResult = {
      success: false,
      startTime: new Date(),
      endTime: new Date(),
      duration: 0,
      error: error.message
    };
    
    if (task.retryCount >= task.maxRetries) {
      task.status = TaskStatus.FAILED;
    } else {
      task.status = TaskStatus.PENDING;
      task.nextRun = new Date(Date.now() + (task.retryCount * 60000)); // Retry with delay
    }
    
    task.updatedAt = new Date();
    this.tasks.set(taskId, task);
    await this.persistTask(task);
    
    this.emit('task:completed', taskId, task.lastResult);
  }

  /**
   * Clean up old completed/failed tasks
   */
  private cleanupOldTasks(): void {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    
    const tasksToCleanup = Array.from(this.tasks.values())
      .filter(task => 
        (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.FAILED) &&
        task.updatedAt < cutoff
      );
    
    for (const task of tasksToCleanup) {
      this.tasks.delete(task.id);
      this.cronJobs.delete(task.id);
    }
    
    if (tasksToCleanup.length > 0) {
      logger.info(`Cleaned up ${tasksToCleanup.length} old tasks`);
    }
  }

  /**
   * Monitor running tasks for timeouts
   */
  private monitorRunningTasks(): void {
    const now = new Date().getTime();
    
    for (const [taskId, task] of this.tasks.entries()) {
      if (task.status === TaskStatus.RUNNING && task.lastRun) {
        const runtime = now - task.lastRun.getTime();
        const timeout = task.config.timeout || 3600000; // 1 hour default
        
        if (runtime > timeout) {
          logger.warn(`Task timeout detected: ${taskId} (running for ${runtime}ms)`);
          
          // Mark as failed and cleanup
          task.status = TaskStatus.FAILED;
          task.lastResult = {
            success: false,
            startTime: task.lastRun,
            endTime: new Date(),
            duration: runtime,
            error: 'Task timeout'
          };
          
          this.tasks.set(taskId, task);
          this.runningTasks.delete(taskId);
          
          this.emit('task:completed', taskId, task.lastResult);
        }
      }
    }
  }

  /**
   * Convert maintenance window to cron expression
   */
  private maintenanceWindowToCron(window: MaintenanceWindow): string {
    const [hour, minute] = window.start.split(':').map(Number);
    const daysOfWeek = window.daysOfWeek.join(',');
    
    return `${minute} ${hour} * * ${daysOfWeek}`;
  }

  /**
   * Convert date to cron expression (one-time execution)
   */
  private dateToCron(date: Date): string {
    const minute = date.getMinutes();
    const hour = date.getHours();
    const day = date.getDate();
    const month = date.getMonth() + 1;
    
    return `${minute} ${hour} ${day} ${month} *`;
  }

  /**
   * Get next run time for a cron expression
   */
  private getNextRunTime(cronExpression: string, fromDate: Date): Date {
    try {
      // This is a simplified implementation
      // In production, use a proper cron parser library
      const nextRun = new Date(fromDate.getTime() + 60000); // Add 1 minute for now
      return nextRun;
    } catch (error) {
      logger.error('Failed to calculate next run time:', error);
      return new Date(fromDate.getTime() + 3600000); // Default to 1 hour from now
    }
  }

  /**
   * Generate unique task ID
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Persist task to storage
   */
  private async persistTask(task: ScheduledTask): Promise<void> {
    try {
      // TODO: Implement database persistence
      // await this.db.query('INSERT INTO scheduled_tasks (...) VALUES (...) ON CONFLICT (id) DO UPDATE SET ...', [...]);
      
      logger.debug(`Task persisted: ${task.id}`);
    } catch (error) {
      logger.error(`Failed to persist task: ${task.id}`, error);
    }
  }
}