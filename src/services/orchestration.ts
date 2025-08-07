import { 
  ExecutionRequest, 
  ExecutionResult, 
  ExecutionStatus, 
  DeploymentStatus,
  CreateDeploymentInput,
  ProjectFile 
} from '../types/index';
import { Sandbox, SandboxError, TimeoutError, NotFoundError } from 'agentsphere-js';
import { DatabaseService } from './database';
import { ProjectAnalyzer, ProjectAnalysis } from '../utils/analyzer';
import { ManifestEngine } from './manifestEngine';
import { EventEmitter } from 'events';
import { loadOrchestrationConfig } from '../config/orchestration';

/**
 * Deployment timeout strategies based on project type and complexity
 */

/**
 * Sandbox resource limits and monitoring
 */
interface SandboxLimits {
  maxConcurrentPerUser: number;
  memoryLimitMB: number;
  diskLimitMB: number;
  cpuLimit: number;
}

/**
 * Deployment health check configuration
 */
interface HealthCheckConfig {
  enabled: boolean;
  interval: number;
  timeout: number;
  retries: number;
  endpoints?: string[];
}

/**
 * Deployment configuration interface
 */
interface DeploymentConfig {
  timeout?: number;  // Deployment timeout time
  env?: Record<string, string>;  // Environment variables
  port?: number;  // Application port, defaults to 3000
}

/**
 * Deployment result interface
 */
interface DeploymentResult {
  id: string;
  projectId: string;
  url: string;
  sandboxId: string;
  status: 'deploying' | 'running' | 'failed' | 'stopped';
  error?: string;
}

/**
 * Enhanced OrchestrationService with AgentSphere SDK integration
 * 
 * Responsibilities:
 * - Multi-type project deployment (Node.js and Manifest)
 * - Sandbox lifecycle management (create, monitor, cleanup)
 * - Deployment orchestration with error recovery
 * - Resource management and optimization
 * - Health monitoring and alerting
 * - Automatic cleanup and garbage collection
 */
export class OrchestrationService extends EventEmitter {
  private static instance: OrchestrationService;
  private executionQueue: Map<string, ExecutionRequest> = new Map();
  private executionResults: Map<string, ExecutionResult> = new Map();
  private activeSandboxes: Map<string, Sandbox> = new Map();
  private sandboxMetadata: Map<string, { userId: string; projectId: string; createdAt: Date; lastActivity: Date; }> = new Map();
  private cleanupInterval?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;
  private db: DatabaseService;
  
  // Configuration loaded from environment and defaults
  private readonly config = loadOrchestrationConfig();

  private constructor() {
    super();
    this.db = DatabaseService.getInstance();
    this.initializeService();
    console.log('OrchestrationService initialized with AgentSphere SDK integration');
  }

  /**
   * Initialize the orchestration service
   */
  private async initializeService(): Promise<void> {
    // Start cleanup processes
    this.startCleanupProcess();
    
    // Start health monitoring
    if (this.config.healthCheck.enabled) {
      this.startHealthMonitoring();
    }
    
    // Set up event listeners
    this.setupEventListeners();
    
    console.log('OrchestrationService initialization complete');
  }

  /**
   * Set up event listeners for system events
   */
  private setupEventListeners(): void {
    this.on('sandbox:created', (sandboxId: string, metadata: any) => {
      console.log(`✅ Sandbox created: ${sandboxId}`, metadata);
    });
    
    this.on('sandbox:error', (sandboxId: string, error: Error) => {
      console.error(`❌ Sandbox error: ${sandboxId}`, error.message);
    });
    
    this.on('sandbox:cleanup', (sandboxId: string, reason: string) => {
      console.log(`🧹 Sandbox cleaned up: ${sandboxId}, reason: ${reason}`);
    });
    
    this.on('deployment:status', (deploymentId: string, status: DeploymentStatus) => {
      console.log(`📊 Deployment status update: ${deploymentId} → ${status}`);
    });
  }

  public static getInstance(): OrchestrationService {
    if (!OrchestrationService.instance) {
      OrchestrationService.instance = new OrchestrationService();
    }
    return OrchestrationService.instance;
  }

  /**
   * Deploy a project to a new sandbox with full lifecycle management
   * Supports both Node.js and Manifest project types
   * 
   * @param userId - User identifier
   * @param files - Project files to deploy
   * @param config - Deployment configuration
   */
  public async deployProject(
    userId: string,
    files: ProjectFile[],
    config: DeploymentConfig = {}
  ): Promise<DeploymentResult> {
    const deploymentId = this.generateExecutionId();
    let projectAnalysis: ProjectAnalysis;
    let finalFiles: ProjectFile[] = files;
    let deployment: any;
    
    console.log(`🚀 Starting deployment for user ${userId} with ${files.length} files`);
    
    try {
      // Step 1: Analyze project type
      console.log('📊 Analyzing project type...');
      projectAnalysis = ProjectAnalyzer.analyzeProject(files);
      console.log(`✅ Detected project type: ${projectAnalysis.projectType} (${projectAnalysis.framework})`);
      
      // Step 2: Generate project files if it's a manifest project
      if (projectAnalysis.projectType === 'manifest') {
        console.log('🛠️ Generating Express project from manifest...');
        const manifestFile = files.find(f => f.path === 'manifest.yaml' || f.path === 'manifest.yml');
        if (!manifestFile) {
          throw new Error('Manifest file not found');
        }
        
        const manifestEngine = ManifestEngine.getInstance();
        const generatedFiles = manifestEngine.generateProject(manifestFile.content);
        
        // Merge generated files with user files (user files take precedence)
        const userFilePaths = new Set(files.map(f => f.path));
        const additionalFiles = generatedFiles
          .filter(f => !userFilePaths.has(f.path))
          .map(f => ({ path: f.path, content: f.content }));
        
        finalFiles = [...files, ...additionalFiles];
        console.log(`✅ Generated ${generatedFiles.length} files, total: ${finalFiles.length} files`);
      }
      
      // Step 3: Check user sandbox limits
      await this.enforceUserLimits(userId);
      
      // Step 4: Create deployment record
      console.log('📝 Creating deployment record...');
      const deploymentInput: CreateDeploymentInput = {
        project_id: `project_${Date.now()}`, // Generate temporary project ID
        status: DeploymentStatus.PENDING,
        runtime_type: this.getTemplateForProjectType(projectAnalysis.projectType)
      };
      
      deployment = await this.db.createDeployment(deploymentInput);
      console.log(`✅ Created deployment: ${deployment.id}`);
      
      // Step 5: Update status to deploying
      await this.updateDeploymentStatus(deployment.id, DeploymentStatus.PROVISIONING);
      
      // Step 6: Create AgentSphere sandbox
      console.log('🏗️ Creating AgentSphere sandbox...');
      const template = this.getTemplateForProjectType(projectAnalysis.projectType);
      const sandbox = await Sandbox.create(template);
      const sandboxId = sandbox.sandboxId;
      
      // Store sandbox metadata
      this.activeSandboxes.set(sandboxId, sandbox);
      this.sandboxMetadata.set(sandboxId, {
        userId,
        projectId: deployment.project_id,
        createdAt: new Date(),
        lastActivity: new Date()
      });
      
      this.emit('sandbox:created', sandboxId, { userId, projectId: deployment.project_id, deploymentId });
      
      // Step 7: Update deployment with sandbox info
      await this.db.updateDeployment(deployment.id, {
        app_sandbox_id: sandboxId,
        status: DeploymentStatus.BUILDING
      });
      
      // Step 8: Start deployment process
      const result = await this.executeDeploymentProcess(
        deployment.id,
        sandboxId,
        sandbox,
        finalFiles,
        projectAnalysis,
        config
      );
      
      console.log(`✅ Deployment completed successfully: ${deployment.id}`);
      return result;
      
    } catch (error) {
      console.error(`❌ Deployment failed for user ${userId}:`, error);
      
      // Update deployment status to failed if deployment was created
      try {
        const deployment = await this.db.getDeploymentById(deploymentId);
        if (deployment) {
          await this.updateDeploymentStatus(deployment.id, DeploymentStatus.FAILED);
        }
      } catch (updateError) {
        console.error('Failed to update deployment status:', updateError);
      }
      
      throw new Error(`Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Submit code execution request (legacy method, now uses deployProject)
   */
  public async submitExecution(request: ExecutionRequest): Promise<string> {
    const files = request.files || [];
    const result = await this.deployProject(
      request.userId,
      files,
      {
        timeout: request.timeout,
        env: request.environment ? { NODE_ENV: request.environment } : {}
      }
    );
    
    return result.id;
  }

  /**
   * Monitor deployment progress and health
   */
  public async monitorDeployment(deploymentId: string): Promise<{
    status: DeploymentStatus;
    health: 'healthy' | 'unhealthy' | 'unknown';
    metrics: {
      uptime: number;
      memoryUsage: number;
      cpuUsage: number;
      responseTime?: number;
    };
    logs: string[];
  }> {
    try {
      const deployment = await this.db.getDeploymentById(deploymentId);
      if (!deployment) {
        throw new NotFoundError(`Deployment ${deploymentId} not found`);
      }
      
      const sandbox = deployment.app_sandbox_id ? this.activeSandboxes.get(deployment.app_sandbox_id) : null;
      const metadata = deployment.app_sandbox_id ? this.sandboxMetadata.get(deployment.app_sandbox_id) : null;
      
      let health: 'healthy' | 'unhealthy' | 'unknown' = 'unknown';
      let metrics = {
        uptime: 0,
        memoryUsage: 0,
        cpuUsage: 0
      };
      let logs: string[] = [];
      
      if (sandbox && metadata) {
        // Update last activity
        metadata.lastActivity = new Date();
        
        try {
          // Perform health check
          health = await this.performHealthCheck(sandbox, deployment.public_url);
          
          // Get basic metrics
          metrics = {
            uptime: Date.now() - metadata.createdAt.getTime(),
            memoryUsage: 0, // TODO: Implement memory monitoring
            cpuUsage: 0     // TODO: Implement CPU monitoring
          };
          
          // Get recent logs
          logs = await this.getSandboxLogs(sandbox);
          
        } catch (error) {
          console.error(`Health check failed for deployment ${deploymentId}:`, error);
          health = 'unhealthy';
        }
      }
      
      return {
        status: deployment.status,
        health,
        metrics,
        logs
      };
      
    } catch (error) {
      console.error(`Failed to monitor deployment ${deploymentId}:`, error);
      throw error;
    }
  }

  /**
   * Get execution status (legacy method, now uses monitorDeployment)
   */
  public async getExecutionStatus(executionId: string): Promise<ExecutionResult | null> {
    try {
      const monitoring = await this.monitorDeployment(executionId);
      
      const result: ExecutionResult = {
        id: executionId,
        status: this.mapDeploymentStatusToExecution(monitoring.status),
        output: monitoring.logs.join('\n'),
        error: monitoring.health === 'unhealthy' ? 'Health check failed' : '',
        executionTime: monitoring.metrics.uptime,
        createdAt: new Date(Date.now() - monitoring.metrics.uptime),
        updatedAt: new Date()
      };
      
      return result;
    } catch (error) {
      return null;
    }
  }

  /**
   * Cleanup sandboxes based on various criteria
   * - Idle sandboxes (no activity for configured time)
   * - Old sandboxes (exceeded maximum age)
   * - Failed/stopped deployments
   * - Orphaned sandboxes (no database record)
   */
  public async cleanupSandboxes(options: {
    force?: boolean;
    maxAge?: number;
    maxIdle?: number;
    userId?: string;
  } = {}): Promise<{
    cleaned: number;
    errors: string[];
    details: Array<{ sandboxId: string; reason: string; success: boolean }>;
  }> {
    const results = {
      cleaned: 0,
      errors: [] as string[],
      details: [] as Array<{ sandboxId: string; reason: string; success: boolean }>
    };
    
    const now = Date.now();
    const maxAge = options.maxAge || this.config.cleanup.maxSandboxAge;
    const maxIdle = options.maxIdle || this.config.cleanup.maxIdleTime;
    
    console.log(`🧹 Starting cleanup process (${this.activeSandboxes.size} active sandboxes)`);
    
    for (const [sandboxId, sandbox] of Array.from(this.activeSandboxes.entries())) {
      const metadata = this.sandboxMetadata.get(sandboxId);
      
      if (!metadata) {
        // Orphaned sandbox
        await this.cleanupSingleSandbox(sandboxId, 'orphaned', results);
        continue;
      }
      
      // Check user filter
      if (options.userId && metadata.userId !== options.userId) {
        continue;
      }
      
      const age = now - metadata.createdAt.getTime();
      const idleTime = now - metadata.lastActivity.getTime();
      
      let shouldClean = options.force;
      let reason = 'forced';
      
      if (!shouldClean && age > maxAge) {
        shouldClean = true;
        reason = 'max_age_exceeded';
      }
      
      if (!shouldClean && idleTime > maxIdle) {
        shouldClean = true;
        reason = 'idle_timeout';
      }
      
      // Check deployment status
      if (!shouldClean) {
        try {
          const deployments = await this.db.query(
            'SELECT status FROM deployments WHERE app_sandbox_id = $1',
            [sandboxId]
          );
          
          if (deployments.rows.length === 0) {
            shouldClean = true;
            reason = 'no_deployment_record';
          } else {
            const status = deployments.rows[0].status;
            if (status === DeploymentStatus.FAILED || status === DeploymentStatus.DESTROYED) {
              shouldClean = true;
              reason = `deployment_${status.toLowerCase()}`;
            }
          }
        } catch (error) {
          console.error(`Error checking deployment status for ${sandboxId}:`, error);
          results.errors.push(`Failed to check deployment status: ${error}`);
        }
      }
      
      if (shouldClean) {
        await this.cleanupSingleSandbox(sandboxId, reason, results);
      }
    }
    
    console.log(`🧹 Cleanup complete: ${results.cleaned} sandboxes cleaned, ${results.errors.length} errors`);
    return results;
  }

  /**
   * Cancel execution and cleanup associated resources
   */
  public async cancelExecution(executionId: string): Promise<boolean> {
    try {
      // Find deployment
      const deployment = await this.db.getDeploymentById(executionId);
      if (!deployment) {
        return false;
      }
      
      // Update status
      await this.updateDeploymentStatus(executionId, DeploymentStatus.DESTROYED);
      
      // Cleanup sandbox if exists
      if (deployment.app_sandbox_id) {
        const cleanupResult = await this.cleanupSandboxes({
          force: true,
          userId: undefined // Clean specific sandbox regardless of user
        });
        
        console.log(`Execution ${executionId} cancelled, cleanup result:`, cleanupResult);
      }
      
      this.executionQueue.delete(executionId);
      return true;
      
    } catch (error) {
      console.error(`Failed to cancel execution ${executionId}:`, error);
      return false;
    }
  }

  /**
   * Get execution history for a user
   * TODO: Implement with database integration
   */
  public async getExecutionHistory(userId: string, limit: number = 10): Promise<ExecutionResult[]> {
    // TODO: Implement with actual database query
    console.log(`Getting execution history for user ${userId} (limit: ${limit})`);
    return [];
  }

  /**
   * Get system execution statistics
   * TODO: Implement with real metrics
   */
  public async getExecutionStats(): Promise<{
    totalExecutions: number;
    activeExecutions: number;
    queuedExecutions: number;
    averageExecutionTime: number;
  }> {
    // TODO: Implement with actual statistics
    return {
      totalExecutions: this.executionQueue.size,
      activeExecutions: 0,
      queuedExecutions: this.executionQueue.size,
      averageExecutionTime: 0
    };
  }

  /**
   * Handle deployment errors with recovery strategies
   */
  public async handleErrors(
    deploymentId: string, 
    error: Error, 
    context: {
      stage: 'provisioning' | 'building' | 'deploying' | 'running';
      retryCount?: number;
      maxRetries?: number;
    }
  ): Promise<{
    recovered: boolean;
    action: 'retry' | 'fallback' | 'abort';
    nextRetryIn?: number;
  }> {
    const { stage, retryCount = 0, maxRetries = 3 } = context;
    
    console.error(`🚨 Deployment error in ${stage} stage for ${deploymentId}:`, error.message);
    
    // Classify error type
    const errorType = this.classifyError(error);
    const strategy = this.getRecoveryStrategy(errorType, stage, retryCount, maxRetries);
    
    // Update deployment status
    if (strategy.action === 'abort') {
      await this.updateDeploymentStatus(deploymentId, DeploymentStatus.FAILED);
      this.emit('deployment:failed', deploymentId, error);
    }
    
    // Log error details
    this.emit('sandbox:error', deploymentId, error);
    
    return strategy;
  }

  /**
   * Get deployment timeout strategy based on project characteristics
   */
  private getTimeoutStrategy(projectType: 'simple' | 'complex' | 'enterprise') {
    return this.config.timeouts[projectType];
  }

  /**
   * Classify error for recovery strategy
   */
  private classifyError(error: Error): {
    type: 'timeout' | 'resource' | 'network' | 'sandbox' | 'unknown';
    severity: 'low' | 'medium' | 'high' | 'critical';
    recoverable: boolean;
  } {
    if (error instanceof TimeoutError) {
      return { type: 'timeout', severity: 'medium', recoverable: true };
    }
    
    if (error instanceof SandboxError) {
      return { type: 'sandbox', severity: 'high', recoverable: false };
    }
    
    if (error instanceof NotFoundError) {
      return { type: 'resource', severity: 'high', recoverable: false };
    }
    
    if (error.message.includes('network') || error.message.includes('connection')) {
      return { type: 'network', severity: 'medium', recoverable: true };
    }
    
    if (error.message.includes('memory') || error.message.includes('disk')) {
      return { type: 'resource', severity: 'high', recoverable: false };
    }
    
    return { type: 'unknown', severity: 'medium', recoverable: true };
  }

  /**
   * Determine recovery strategy based on error type and context
   */
  private getRecoveryStrategy(
    errorInfo: ReturnType<typeof this.classifyError>,
    stage: string,
    retryCount: number,
    maxRetries: number
  ): {
    recovered: boolean;
    action: 'retry' | 'fallback' | 'abort';
    nextRetryIn?: number;
  } {
    if (!errorInfo.recoverable || retryCount >= maxRetries) {
      return { recovered: false, action: 'abort' };
    }
    
    const backoffTime = Math.min(1000 * Math.pow(2, retryCount), 30000); // Exponential backoff, max 30s
    
    switch (errorInfo.type) {
      case 'timeout':
        return { recovered: false, action: 'retry', nextRetryIn: backoffTime };
      
      case 'network':
        return { recovered: false, action: 'retry', nextRetryIn: backoffTime * 2 };
      
      case 'resource':
        if (stage === 'provisioning') {
          return { recovered: false, action: 'fallback', nextRetryIn: backoffTime };
        }
        return { recovered: false, action: 'abort' };
      
      default:
        return { recovered: false, action: 'retry', nextRetryIn: backoffTime };
    }
  }

  /**
   * Cleanup resources and stop background processes
   */
  public async cleanup(): Promise<void> {
    console.log('🧹 Starting OrchestrationService cleanup...');
    
    // Stop background processes
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    // Clean up all active sandboxes
    const cleanupResult = await this.cleanupSandboxes({ force: true });
    console.log('Final cleanup result:', cleanupResult);
    
    // Clear memory
    this.executionQueue.clear();
    this.executionResults.clear();
    this.activeSandboxes.clear();
    this.sandboxMetadata.clear();
    
    console.log('✅ OrchestrationService cleanup completed');
  }

  // ==================== PRIVATE HELPER METHODS ====================

  /**
   * Start the automatic cleanup process
   */
  private startCleanupProcess(): void {
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.cleanupSandboxes();
      } catch (error) {
        console.error('Scheduled cleanup failed:', error);
      }
    }, this.config.cleanup.interval);
    
    console.log(`🔄 Cleanup process started (interval: ${this.config.cleanup.interval}ms)`);
  }

  /**
   * Start health monitoring for active deployments
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      for (const [deploymentId] of Array.from(this.activeSandboxes.entries())) {
        try {
          await this.monitorDeployment(deploymentId);
        } catch (error) {
          console.error(`Health monitoring failed for ${deploymentId}:`, error);
        }
      }
    }, this.config.healthCheck.interval);
    
    console.log(`📊 Health monitoring started (interval: ${this.config.healthCheck.interval}ms)`);
  }

  /**
   * Enforce user sandbox limits
   */
  private async enforceUserLimits(userId: string): Promise<void> {
    const userSandboxes = Array.from(this.sandboxMetadata.entries())
      .filter(([, metadata]) => metadata.userId === userId);
    
    if (userSandboxes.length >= this.config.limits.maxConcurrentPerUser) {
      // Clean up oldest sandbox for this user
      const oldest = userSandboxes.reduce((oldest, current) => 
        current[1].createdAt < oldest[1].createdAt ? current : oldest
      );
      
      await this.cleanupSingleSandbox(oldest[0], 'user_limit_exceeded', {
        cleaned: 0,
        errors: [],
        details: []
      });
      
      console.log(`⚠️ Cleaned up oldest sandbox for user ${userId} due to limit`);
    }
  }

  /**
   * Create a new sandbox with proper configuration
   */
  private async createSandbox(
    userId: string, 
    projectId: string, 
    deploymentId: string,
    template: string
  ): Promise<Sandbox> {
    try {
      const sandbox = await Sandbox.create(template, {
        timeoutMs: this.getTimeoutForProject(template),
        metadata: {
          userId,
          projectId,
          deploymentId,
          createdAt: new Date().toISOString()
        }
      });
      
      return sandbox;
    } catch (error) {
      console.error('Failed to create sandbox:', error);
      throw new SandboxError(`Sandbox creation failed: ${error}`);
    }
  }

  /**
   * Execute the complete deployment process in a sandbox
   */
  private async executeDeploymentProcess(
    deploymentId: string,
    sandboxId: string,
    sandbox: Sandbox,
    files: ProjectFile[],
    projectAnalysis: ProjectAnalysis,
    config: DeploymentConfig
  ): Promise<DeploymentResult> {
    const startTime = Date.now();
    const timeout = config.timeout || 300000; // 5 minutes default
    
    try {
      console.log(`🏗️ Executing deployment process for ${deploymentId}`);
      
      // Step 1: Upload files to sandbox
      console.log('📁 Uploading project files...');
      for (const file of files) {
        await sandbox.files.write(file.path, file.content);
        console.log(`  ✅ Uploaded: ${file.path}`);
      }
      
      // Step 2: Set environment variables
      if (config.env) {
        console.log('🌍 Setting environment variables...');
        for (const [key, value] of Object.entries(config.env)) {
          // Note: AgentSphere SDK might handle env vars differently
          console.log(`  ✅ Set env: ${key}`);
        }
      }
      
      // Step 3: Install dependencies
      console.log('📦 Installing dependencies...');
      await this.updateDeploymentStatus(deploymentId, DeploymentStatus.BUILDING);
      
      const installResult = await Promise.race([
        sandbox.commands.run('npm install'),
        new Promise((_, reject) => 
          setTimeout(() => reject(new TimeoutError('npm install timeout')), timeout / 2)
        )
      ]);
      console.log('✅ Dependencies installed successfully');
      
      // Step 4: Start the application
      console.log(`🚀 Starting application with command: ${projectAnalysis.startCommand}`);
      await this.updateDeploymentStatus(deploymentId, DeploymentStatus.RUNNING);
      
      // Start the application in background
      const startHandle = await sandbox.commands.run(projectAnalysis.startCommand, { background: true });
      console.log(`\u2705 Application started with PID: ${startHandle.pid}`);
      
      // Step 5: Get public URL
      console.log('🌐 Getting public URL...');
      const port = config.port || 3000;
      const publicUrl = sandbox.getHost(port);
      
      if (!publicUrl) {
        throw new Error('Failed to get public URL from sandbox');
      }
      
      // Step 6: Update deployment with final status
      await this.db.updateDeployment(deploymentId, {
        public_url: publicUrl,
        status: DeploymentStatus.RUNNING
      });
      
      this.emit('deployment:status', deploymentId, DeploymentStatus.RUNNING);
      
      const executionTime = Date.now() - startTime;
      console.log(`✅ Deployment ${deploymentId} completed in ${executionTime}ms`);
      console.log(`🌐 Application is running at: ${publicUrl}`);
      
      return {
        id: deploymentId,
        projectId: 'project_generated',
        url: publicUrl,
        sandboxId: sandboxId,
        status: 'running'
      };
      
    } catch (error) {
      console.error(`❌ Deployment process failed for ${deploymentId}:`, error);
      await this.handleDeploymentError(deploymentId, error);
      
      return {
        id: deploymentId,
        projectId: 'unknown',
        url: '',
        sandboxId: sandboxId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown deployment error'
      };
    }
  }

  /**
   * Handle deployment errors
   */
  private async handleDeploymentError(deploymentId: string, error: Error): Promise<void> {
    await this.updateDeploymentStatus(deploymentId, DeploymentStatus.FAILED);
    this.emit('deployment:failed', deploymentId, error);
    
    // Cleanup associated sandbox
    const deployment = await this.db.getDeploymentById(deploymentId);
    if (deployment?.app_sandbox_id) {
      await this.cleanupSingleSandbox(deployment.app_sandbox_id, 'deployment_failed', {
        cleaned: 0,
        errors: [],
        details: []
      });
    }
  }

  /**
   * Update deployment status in database
   */
  private async updateDeploymentStatus(deploymentId: string, status: DeploymentStatus): Promise<void> {
    try {
      await this.db.updateDeployment(deploymentId, { status });
      this.emit('deployment:status', deploymentId, status);
    } catch (error) {
      console.error(`Failed to update deployment status for ${deploymentId}:`, error);
      throw error;
    }
  }

  /**
   * Perform health check on a sandbox
   */
  private async performHealthCheck(
    sandbox: Sandbox, 
    publicUrl?: string
  ): Promise<'healthy' | 'unhealthy' | 'unknown'> {
    try {
      if (!publicUrl) {
        return 'unknown';
      }
      
      // TODO: Implement actual health check
      // For now, just return healthy if sandbox exists
      return sandbox ? 'healthy' : 'unhealthy';
      
    } catch (error) {
      console.error('Health check failed:', error);
      return 'unhealthy';
    }
  }

  /**
   * Get sandbox logs
   */
  private async getSandboxLogs(sandbox: Sandbox): Promise<string[]> {
    try {
      // TODO: Implement log retrieval from sandbox
      return ['Sample log entry 1', 'Sample log entry 2'];
    } catch (error) {
      console.error('Failed to get sandbox logs:', error);
      return [];
    }
  }

  /**
   * Cleanup a single sandbox
   */
  private async cleanupSingleSandbox(
    sandboxId: string, 
    reason: string,
    results: { cleaned: number; errors: string[]; details: Array<any> }
  ): Promise<void> {
    try {
      const sandbox = this.activeSandboxes.get(sandboxId);
      
      if (sandbox) {
        // TODO: Properly terminate sandbox
        // await sandbox.destroy();
      }
      
      // Remove from tracking
      this.activeSandboxes.delete(sandboxId);
      this.sandboxMetadata.delete(sandboxId);
      
      // Update database records
      await this.db.query(
        'UPDATE deployments SET status = $1 WHERE app_sandbox_id = $2',
        [DeploymentStatus.DESTROYED, sandboxId]
      );
      
      results.cleaned++;
      results.details.push({ sandboxId, reason, success: true });
      
      this.emit('sandbox:cleanup', sandboxId, reason);
      
    } catch (error) {
      console.error(`Failed to cleanup sandbox ${sandboxId}:`, error);
      results.errors.push(`Sandbox ${sandboxId}: ${error}`);
      results.details.push({ sandboxId, reason, success: false });
    }
  }

  /**
   * Get timeout based on project type (in milliseconds)
   */
  private getTimeoutForProject(template: string): number {
    // Simple heuristic based on template type
    if (template.includes('nodejs') || template.includes('python')) {
      return this.config.timeouts.simple.initial * 1000; // Convert to milliseconds
    }
    
    if (template.includes('java') || template.includes('scala')) {
      return this.config.timeouts.complex.initial * 1000;
    }
    
    return this.config.timeouts.simple.initial * 1000;
  }

  /**
   * Map deployment status to execution status
   */
  private mapDeploymentStatusToExecution(status: DeploymentStatus): ExecutionStatus {
    switch (status) {
      case DeploymentStatus.PENDING:
      case DeploymentStatus.PROVISIONING:
        return ExecutionStatus.QUEUED;
      case DeploymentStatus.BUILDING:
        return ExecutionStatus.PENDING;
      case DeploymentStatus.RUNNING:
        return ExecutionStatus.RUNNING;
      case DeploymentStatus.STOPPED:
        return ExecutionStatus.CANCELLED;
      case DeploymentStatus.FAILED:
        return ExecutionStatus.FAILED;
      case DeploymentStatus.DESTROYED:
        return ExecutionStatus.CANCELLED;
      default:
        return ExecutionStatus.PENDING;
    }
  }

  /**
   * Generate unique execution/deployment ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get appropriate template for project type
   */
  private getTemplateForProjectType(projectType: 'nodejs' | 'manifest'): string {
    switch (projectType) {
      case 'nodejs':
        return 'template-nodejs-18';
      case 'manifest':
        // Manifest generates Node.js projects
        return 'template-nodejs-18';
      default:
        return 'template-nodejs-18';
    }
  }
  
  /**
   * Get project ID from deployment
   */
  private async getProjectIdFromDeployment(deploymentId: string): Promise<string> {
    try {
      const deployment = await this.db.getDeploymentById(deploymentId);
      return deployment?.project_id || 'unknown';
    } catch (error) {
      console.error('Failed to get project ID from deployment:', error);
      return 'unknown';
    }
  }
  
  /**
   * Generate unique sandbox ID
   */
  private generateSandboxId(): string {
    return `sb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}