/**
 * Orchestration Service Configuration
 * 
 * Centralized configuration for deployment strategies, resource limits,
 * health checks, and cleanup policies.
 */

export interface OrchestrationConfig {
  // Timeout strategies based on project complexity
  timeouts: {
    simple: TimeoutConfig;
    complex: TimeoutConfig; 
    enterprise: TimeoutConfig;
  };
  
  // Resource limits per user/sandbox
  limits: ResourceLimits;
  
  // Health monitoring configuration
  healthCheck: HealthCheckConfig;
  
  // Cleanup and garbage collection
  cleanup: CleanupConfig;
  
  // Error handling and retry policies
  errorHandling: ErrorHandlingConfig;
}

export interface TimeoutConfig {
  initial: number;        // Initial timeout in seconds
  extension: number;      // Extension timeout in seconds  
  maximum: number;        // Maximum allowed timeout
  healthCheck: number;    // Health check interval in seconds
  gracePeriod: number;    // Grace period before force kill
}

export interface ResourceLimits {
  maxConcurrentPerUser: number;     // Max sandboxes per user
  maxConcurrentGlobal: number;      // Max total sandboxes
  memoryLimitMB: number;            // Memory limit per sandbox
  diskLimitMB: number;              // Disk space limit per sandbox
  cpuLimit: number;                 // CPU cores limit (fractional allowed)
  networkBandwidthMbps?: number;    // Network bandwidth limit
}

export interface HealthCheckConfig {
  enabled: boolean;
  interval: number;           // Check interval in milliseconds
  timeout: number;           // Timeout for each check
  retries: number;           // Number of retries before marking unhealthy
  endpoints: string[];       // Health check endpoints to test
  gracePeriod: number;       // Grace period for new deployments
}

export interface CleanupConfig {
  interval: number;          // Cleanup interval in milliseconds
  maxIdleTime: number;       // Max idle time before cleanup
  maxSandboxAge: number;     // Max sandbox age regardless of activity
  batchSize: number;         // Max sandboxes to clean per batch
  orphanTimeout: number;     // Time to wait before cleaning orphaned sandboxes
}

export interface ErrorHandlingConfig {
  maxRetries: number;
  backoffMultiplier: number;
  maxBackoffMs: number;
  retryableErrors: string[];    // Error types that should trigger retries
  fatalErrors: string[];       // Error types that should immediately fail
}

/**
 * Default configuration - can be overridden by environment variables
 */
export const DEFAULT_ORCHESTRATION_CONFIG: OrchestrationConfig = {
  timeouts: {
    simple: {
      initial: 300,        // 5 minutes
      extension: 180,      // 3 minutes
      maximum: 900,        // 15 minutes
      healthCheck: 30,     // 30 seconds
      gracePeriod: 10      // 10 seconds
    },
    complex: {
      initial: 600,        // 10 minutes
      extension: 300,      // 5 minutes
      maximum: 1800,       // 30 minutes
      healthCheck: 60,     // 1 minute
      gracePeriod: 30      // 30 seconds
    },
    enterprise: {
      initial: 900,        // 15 minutes
      extension: 600,      // 10 minutes
      maximum: 3600,       // 1 hour
      healthCheck: 120,    // 2 minutes
      gracePeriod: 60      // 1 minute
    }
  },
  
  limits: {
    maxConcurrentPerUser: 3,
    maxConcurrentGlobal: 100,
    memoryLimitMB: 512,
    diskLimitMB: 1024,
    cpuLimit: 1.0,
    networkBandwidthMbps: 10
  },
  
  healthCheck: {
    enabled: true,
    interval: 30000,       // 30 seconds
    timeout: 5000,         // 5 seconds
    retries: 3,
    endpoints: ['/health', '/api/health', '/ping'],
    gracePeriod: 60000     // 1 minute for new deployments
  },
  
  cleanup: {
    interval: 300000,      // 5 minutes
    maxIdleTime: 1800000,  // 30 minutes
    maxSandboxAge: 3600000, // 1 hour
    batchSize: 10,
    orphanTimeout: 600000  // 10 minutes
  },
  
  errorHandling: {
    maxRetries: 3,
    backoffMultiplier: 2,
    maxBackoffMs: 30000,   // 30 seconds
    retryableErrors: [
      'TimeoutError',
      'NetworkError', 
      'TemporaryFailure',
      'RateLimitError'
    ],
    fatalErrors: [
      'SandboxError',
      'NotFoundError',
      'AuthenticationError',
      'InsufficientResources'
    ]
  }
};

/**
 * Load configuration from environment variables with defaults
 */
export function loadOrchestrationConfig(): OrchestrationConfig {
  const config = { ...DEFAULT_ORCHESTRATION_CONFIG };
  
  // Override with environment variables if present
  if (process.env.MAX_SANDBOXES_PER_USER) {
    config.limits.maxConcurrentPerUser = parseInt(process.env.MAX_SANDBOXES_PER_USER);
  }
  
  if (process.env.MAX_SANDBOXES_GLOBAL) {
    config.limits.maxConcurrentGlobal = parseInt(process.env.MAX_SANDBOXES_GLOBAL);
  }
  
  if (process.env.SANDBOX_MEMORY_LIMIT) {
    config.limits.memoryLimitMB = parseInt(process.env.SANDBOX_MEMORY_LIMIT);
  }
  
  if (process.env.SANDBOX_TIMEOUT_SIMPLE) {
    config.timeouts.simple.initial = parseInt(process.env.SANDBOX_TIMEOUT_SIMPLE);
  }
  
  if (process.env.HEALTH_CHECK_ENABLED) {
    config.healthCheck.enabled = process.env.HEALTH_CHECK_ENABLED === 'true';
  }
  
  if (process.env.HEALTH_CHECK_INTERVAL) {
    config.healthCheck.interval = parseInt(process.env.HEALTH_CHECK_INTERVAL);
  }
  
  if (process.env.CLEANUP_INTERVAL) {
    config.cleanup.interval = parseInt(process.env.CLEANUP_INTERVAL);
  }
  
  if (process.env.MAX_IDLE_TIME) {
    config.cleanup.maxIdleTime = parseInt(process.env.MAX_IDLE_TIME);
  }
  
  return config;
}

/**
 * Timeout strategy matrix for different project types and scenarios
 */
export const TIMEOUT_STRATEGY_MATRIX = {
  // Project type detection based on files and dependencies
  detectProjectType: (files: any[], dependencies?: Record<string, string>): 'simple' | 'complex' | 'enterprise' => {
    const fileCount = files.length;
    const hasComplexDependencies = dependencies && Object.keys(dependencies).length > 10;
    const hasFramework = dependencies && (
      dependencies['react'] || 
      dependencies['angular'] || 
      dependencies['vue'] ||
      dependencies['express'] ||
      dependencies['spring-boot']
    );
    
    if (fileCount > 50 || hasComplexDependencies) {
      return 'enterprise';
    }
    
    if (fileCount > 20 || hasFramework) {
      return 'complex';
    }
    
    return 'simple';
  },
  
  // Extension triggers
  shouldExtendTimeout: (
    currentRuntime: number,
    timeoutConfig: TimeoutConfig,
    healthStatus: 'healthy' | 'unhealthy' | 'unknown'
  ): boolean => {
    const remainingTime = timeoutConfig.initial * 1000 - currentRuntime;
    const extensionThreshold = timeoutConfig.initial * 0.8 * 1000; // 80% of initial timeout
    
    return (
      currentRuntime > extensionThreshold &&
      remainingTime < timeoutConfig.extension * 1000 &&
      healthStatus === 'healthy'
    );
  }
};

/**
 * Resource management thresholds and scaling policies
 */
export const RESOURCE_MANAGEMENT = {
  // Auto-scaling thresholds
  scaling: {
    scaleUpThreshold: 0.8,    // Scale up when 80% of resources used
    scaleDownThreshold: 0.3,  // Scale down when below 30% usage
    scaleUpCooldown: 300000,  // 5 minutes between scale up operations
    scaleDownCooldown: 600000 // 10 minutes between scale down operations
  },
  
  // Resource monitoring intervals
  monitoring: {
    cpuCheckInterval: 10000,     // 10 seconds
    memoryCheckInterval: 15000,  // 15 seconds
    diskCheckInterval: 60000,    // 1 minute
    networkCheckInterval: 30000  // 30 seconds
  },
  
  // Alert thresholds
  alerts: {
    highCpuThreshold: 0.8,
    highMemoryThreshold: 0.85,
    highDiskThreshold: 0.9,
    lowDiskSpaceThreshold: 0.95
  }
};