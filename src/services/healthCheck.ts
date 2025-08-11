import { EventEmitter } from 'events';
import { DatabaseService } from './database';
import { MetricsService } from './metrics';
import { WebSocketService } from './websocket';
import * as os from 'os';
// import * as fs from 'fs/promises'; // Unused import removed
import * as http from 'http';
import * as https from 'https';

export interface HealthCheckResult {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded' | 'unknown' | 'mocked';
  responseTime: number;
  timestamp: Date;
  message?: string;
  details?: any;
  error?: string;
  dependencies?: HealthCheckResult[];
}

export interface SystemHealth {
  overall: 'healthy' | 'unhealthy' | 'degraded';
  environment: string;
  mode: string;
  timestamp: Date;
  uptime: number;
  version: string;
  checks: HealthCheckResult[];
  summary: {
    total: number;
    healthy: number;
    unhealthy: number;
    degraded: number;
    mocked: number;
    responseTime: number;
  };
  services: { [key: string]: { status: string; message?: string; connections?: number; collected?: number } };
  database?: { status: string; message?: string; };
}

export interface HealthCheckConfig {
  interval: number;
  timeout: number;
  retries: number;
  degradedThreshold: number;
  unhealthyThreshold: number;
  enableProbes: boolean;
  circuitBreaker: {
    failureThreshold: number;
    cooldownPeriod: number;
    halfOpenRetries: number;
  };
  checks: {
    database: boolean;
    websocket: boolean;
    metrics: boolean;
    system: boolean;
    network: boolean;
    dependencies: boolean;
  };
}

/**
 * HealthCheckService - Comprehensive health monitoring system
 * 
 * Features:
 * - Multi-layer health checks (application, system, network, dependencies)
 * - Configurable thresholds and retry logic
 * - Dependency health monitoring
 * - Performance impact monitoring
 * - Automated recovery suggestions
 * - Integration with monitoring systems
 */
export class HealthCheckService extends EventEmitter {
  private static instance: HealthCheckService;
  private db: DatabaseService;
  private metrics: MetricsService;
  private websocket: WebSocketService;
  
  private config: HealthCheckConfig;
  private checkInterval?: NodeJS.Timeout;
  private lastHealthCheck: SystemHealth | null = null;
  private startTime: number = Date.now();
  
  // Health check registry
  private healthChecks: Map<string, {
    name: string;
    check: () => Promise<HealthCheckResult>;
    enabled: boolean;
    lastResult?: HealthCheckResult;
  }> = new Map();
  
  // Circuit breaker for failed checks
  private circuitBreakers: Map<string, {
    failures: number;
    lastFailure: number;
    state: 'closed' | 'open' | 'half-open';
    halfOpenAttempts: number;
    stateTransitions: number;
  }> = new Map();

  private constructor() {
    super();
    this.db = DatabaseService.getInstance();
    this.metrics = MetricsService.getInstance();
    this.websocket = WebSocketService.getInstance();
    
    this.config = {
      interval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'), // 30 seconds
      timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5000'), // 5 seconds
      retries: parseInt(process.env.HEALTH_CHECK_RETRIES || '3'),
      degradedThreshold: parseFloat(process.env.HEALTH_DEGRADED_THRESHOLD || '500'), // 500ms
      unhealthyThreshold: parseFloat(process.env.HEALTH_UNHEALTHY_THRESHOLD || '2000'), // 2s
      enableProbes: process.env.HEALTH_ENABLE_PROBES === 'true',
      circuitBreaker: {
        failureThreshold: parseInt(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || '3'),
        cooldownPeriod: parseInt(process.env.CIRCUIT_BREAKER_COOLDOWN || '30000'), // 30 seconds
        halfOpenRetries: parseInt(process.env.CIRCUIT_BREAKER_HALF_OPEN_RETRIES || '3')
      },
      checks: {
        database: process.env.HEALTH_CHECK_DATABASE !== 'false',
        websocket: process.env.HEALTH_CHECK_WEBSOCKET !== 'false',
        metrics: process.env.HEALTH_CHECK_METRICS !== 'false',
        system: process.env.HEALTH_CHECK_SYSTEM !== 'false',
        network: process.env.HEALTH_CHECK_NETWORK !== 'false',
        dependencies: process.env.HEALTH_CHECK_DEPENDENCIES !== 'false'
      }
    };
    
    this.initializeHealthChecks();
    console.log('🏥 HealthCheckService initialized with comprehensive monitoring');
  }

  public static getInstance(): HealthCheckService {
    if (!HealthCheckService.instance) {
      HealthCheckService.instance = new HealthCheckService();
    }
    return HealthCheckService.instance;
  }

  /**
   * Initialize all health check functions
   */
  private initializeHealthChecks(): void {
    // Database health check with environment awareness
    this.registerHealthCheck('database', async () => {
      const startTime = Date.now();
      
      // Check if we're in development mode without a real database
      const isDevelopment = process.env.NODE_ENV === 'development';
      const hasDbUrl = !!(process.env.DATABASE_URL || process.env.DB_HOST);
      const hasMockMode = process.env.MOCK_DATABASE === 'true';
      
      if (isDevelopment && (!hasDbUrl || hasMockMode)) {
        return {
          name: 'database',
          status: 'mocked',
          responseTime: Date.now() - startTime,
          timestamp: new Date(),
          message: 'Development mode - Database mocked',
          details: {
            environment: 'development',
            mockMode: true,
            hasDbUrl,
            timestamp: new Date().toISOString(),
            note: 'Set DATABASE_URL or configure DB_* env vars for real database connection'
          }
        };
      }
      
      try {
        // Check if database service is available
        if (!this.db.isConnected()) {
          return {
            name: 'database',
            status: 'unhealthy',
            responseTime: Date.now() - startTime,
            timestamp: new Date(),
            message: 'Database not connected',
            error: 'Database pool not initialized or connection lost',
            details: {
              environment: process.env.NODE_ENV,
              connected: false
            }
          };
        }
        
        const result = await this.db.healthCheck();
        const responseTime = Date.now() - startTime;
        
        let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
        let message = 'Database connection successful';
        
        // Determine status based on response time and connection info
        if (responseTime > this.config.unhealthyThreshold) {
          status = 'unhealthy';
          message = `Database responding slowly (${responseTime}ms)`;
        } else if (responseTime > this.config.degradedThreshold) {
          status = 'degraded';
          message = `Database response degraded (${responseTime}ms)`;
        }
        
        return {
          name: 'database',
          status: result.status === 'healthy' ? status : 'unhealthy',
          responseTime,
          timestamp: new Date(),
          message: result.status === 'healthy' ? message : result.details?.message || 'Database health check failed',
          details: {
            environment: process.env.NODE_ENV,
            ...result.details,
            thresholds: {
              degraded: this.config.degradedThreshold,
              unhealthy: this.config.unhealthyThreshold
            }
          }
        };
      } catch (error) {
        return {
          name: 'database',
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
          timestamp: new Date(),
          message: 'Database connection failed',
          error: error instanceof Error ? error.message : 'Unknown database error',
          details: {
            environment: process.env.NODE_ENV,
            errorType: error instanceof Error ? error.constructor.name : 'UnknownError'
          }
        };
      }
    }, this.config.checks.database);
    
    // WebSocket health check
    this.registerHealthCheck('websocket', async () => {
      const startTime = Date.now();
      try {
        const metrics = this.websocket.getMetrics();
        const responseTime = Date.now() - startTime;
        
        let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
        if (metrics.errorRate > 0.1) {
          status = 'degraded';
        }
        if (metrics.errorRate > 0.3) {
          status = 'unhealthy';
        }
        
        return {
          name: 'websocket',
          status,
          responseTime,
          timestamp: new Date(),
          details: {
            activeConnections: metrics.activeConnections,
            totalSubscriptions: metrics.totalSubscriptions,
            errorRate: metrics.errorRate,
            messagesPerSecond: metrics.messagesPerSecond
          }
        };
      } catch (error) {
        return {
          name: 'websocket',
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
          timestamp: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }, this.config.checks.websocket);
    
    // Metrics service health check
    this.registerHealthCheck('metrics', async () => {
      const startTime = Date.now();
      try {
        const health = await this.metrics.getHealthStatus();
        const responseTime = Date.now() - startTime;
        
        return {
          name: 'metrics',
          status: health.status,
          responseTime,
          timestamp: new Date(),
          details: health.details
        };
      } catch (error) {
        return {
          name: 'metrics',
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
          timestamp: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }, this.config.checks.metrics);
    
    // System health check
    this.registerHealthCheck('system', async () => {
      const startTime = Date.now();
      try {
        const cpus = os.cpus();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const loadAvg = os.loadavg();
        const uptime = os.uptime();
        
        const memUsagePercent = ((totalMem - freeMem) / totalMem) * 100;
        const loadPercent = (loadAvg[0] / cpus.length) * 100;
        
        let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
        if (memUsagePercent > 80 || loadPercent > 80) {
          status = 'degraded';
        }
        if (memUsagePercent > 95 || loadPercent > 95) {
          status = 'unhealthy';
        }
        
        const responseTime = Date.now() - startTime;
        
        return {
          name: 'system',
          status,
          responseTime,
          timestamp: new Date(),
          details: {
            cpu: {
              cores: cpus.length,
              loadAverage: loadAvg,
              loadPercent
            },
            memory: {
              total: totalMem,
              used: totalMem - freeMem,
              free: freeMem,
              usagePercent: memUsagePercent
            },
            uptime,
            platform: os.platform(),
            arch: os.arch()
          }
        };
      } catch (error) {
        return {
          name: 'system',
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
          timestamp: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }, this.config.checks.system);
    
    // Network health check
    this.registerHealthCheck('network', async () => {
      const startTime = Date.now();
      try {
        // Check internet connectivity
        const internetCheck = await this.checkHttpEndpoint('https://www.google.com', 3000);
        
        // Check DNS resolution
        const dnsCheck = await this.checkDnsResolution('google.com');
        
        const responseTime = Date.now() - startTime;
        
        let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
        if (!internetCheck.success || !dnsCheck.success) {
          status = 'degraded';
        }
        if (!internetCheck.success && !dnsCheck.success) {
          status = 'unhealthy';
        }
        
        return {
          name: 'network',
          status,
          responseTime,
          timestamp: new Date(),
          details: {
            internet: internetCheck,
            dns: dnsCheck,
            interfaces: os.networkInterfaces()
          }
        };
      } catch (error) {
        return {
          name: 'network',
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
          timestamp: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }, this.config.checks.network);
    
    // Dependencies health check (AgentSphere, external APIs)
    this.registerHealthCheck('dependencies', async () => {
      const startTime = Date.now();
      try {
        const dependencies: HealthCheckResult[] = [];
        
        // Check AgentSphere API (if configured)
        if (process.env.AGENTSPHERE_API_URL) {
          const agentSphereCheck = await this.checkHttpEndpoint(
            process.env.AGENTSPHERE_API_URL,
            5000
          );
          
          dependencies.push({
            name: 'agentsphere',
            status: agentSphereCheck.success ? 'healthy' : 'unhealthy',
            responseTime: agentSphereCheck.responseTime,
            timestamp: new Date(),
            details: agentSphereCheck,
            error: agentSphereCheck.error || undefined
          });
        }
        
        // Aggregate dependency status
        const totalDeps = dependencies.length;
        const healthyDeps = dependencies.filter(d => d.status === 'healthy').length;
        const unhealthyDeps = dependencies.filter(d => d.status === 'unhealthy').length;
        
        let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
        if (unhealthyDeps > 0) {
          status = unhealthyDeps === totalDeps ? 'unhealthy' : 'degraded';
        }
        
        const responseTime = Date.now() - startTime;
        
        return {
          name: 'dependencies',
          status,
          responseTime,
          timestamp: new Date(),
          details: {
            total: totalDeps,
            healthy: healthyDeps,
            unhealthy: unhealthyDeps
          },
          dependencies
        };
      } catch (error) {
        return {
          name: 'dependencies',
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
          timestamp: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }, this.config.checks.dependencies);
  }

  /**
   * Register a custom health check
   */
  public registerHealthCheck(
    name: string,
    check: () => Promise<HealthCheckResult>,
    enabled: boolean = true
  ): void {
    this.healthChecks.set(name, {
      name,
      check,
      enabled
    });
    
    // Initialize circuit breaker with enhanced state management
    this.circuitBreakers.set(name, {
      failures: 0,
      lastFailure: 0,
      state: 'closed',
      halfOpenAttempts: 0,
      stateTransitions: 0
    });
  }

  /**
   * Start automated health checks
   */
  public startHealthChecks(): void {
    if (this.checkInterval) {
      console.warn('⚠️ Health checks already started');
      return;
    }
    
    // Run initial health check
    this.performHealthCheck();
    
    // Schedule periodic health checks
    this.checkInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.interval);
    
    console.log(`✅ Health checks started (interval: ${this.config.interval}ms)`);
  }

  /**
   * Perform comprehensive health check
   */
  public async performHealthCheck(): Promise<SystemHealth> {
    const startTime = Date.now();
    const checks: HealthCheckResult[] = [];
    
    // Run all enabled health checks
    for (const [name, healthCheck] of Array.from(this.healthChecks.entries())) {
      if (!healthCheck.enabled) continue;
      
      const circuitBreaker = this.circuitBreakers.get(name)!;
      
      // Enhanced circuit breaker state management
      if (circuitBreaker.state === 'open') {
        const timeSinceLastFailure = Date.now() - circuitBreaker.lastFailure;
        if (timeSinceLastFailure < this.config.circuitBreaker.cooldownPeriod) {
          checks.push({
            name,
            status: 'unknown',
            responseTime: 0,
            timestamp: new Date(),
            message: `Circuit breaker is open (${Math.ceil((this.config.circuitBreaker.cooldownPeriod - timeSinceLastFailure) / 1000)}s remaining)`,
            error: 'Circuit breaker preventing calls due to repeated failures',
            details: {
              circuitBreakerState: 'open',
              failures: circuitBreaker.failures,
              cooldownRemaining: this.config.circuitBreaker.cooldownPeriod - timeSinceLastFailure,
              stateTransitions: circuitBreaker.stateTransitions
            }
          });
          continue;
        } else {
          circuitBreaker.state = 'half-open';
          circuitBreaker.halfOpenAttempts = 0;
          circuitBreaker.stateTransitions++;
          console.log(`🔄 Circuit breaker for ${name} transitioning to half-open`);
        }
      }
      
      try {
        // Execute health check with timeout
        const result = await this.executeWithTimeout(
          healthCheck.check(),
          this.config.timeout
        );
        
        // Enhanced circuit breaker logic
        if (result.status === 'healthy' || result.status === 'mocked') {
          if (circuitBreaker.state === 'half-open') {
            circuitBreaker.halfOpenAttempts++;
            if (circuitBreaker.halfOpenAttempts >= this.config.circuitBreaker.halfOpenRetries) {
              circuitBreaker.state = 'closed';
              circuitBreaker.failures = 0;
              circuitBreaker.halfOpenAttempts = 0;
              circuitBreaker.stateTransitions++;
              console.log(`✅ Circuit breaker for ${name} closed after successful recovery`);
            }
          } else {
            circuitBreaker.failures = 0;
            circuitBreaker.state = 'closed';
          }
        } else if (result.status === 'unhealthy') {
          circuitBreaker.failures++;
          circuitBreaker.lastFailure = Date.now();
          
          if (circuitBreaker.state === 'half-open') {
            circuitBreaker.state = 'open';
            circuitBreaker.stateTransitions++;
            console.log(`🚨 Circuit breaker for ${name} re-opened due to failure in half-open state`);
          } else if (circuitBreaker.failures >= this.config.circuitBreaker.failureThreshold) {
            circuitBreaker.state = 'open';
            circuitBreaker.stateTransitions++;
            console.log(`🚨 Circuit breaker for ${name} opened due to ${circuitBreaker.failures} failures`);
          }
        }
        
        // Store last result
        healthCheck.lastResult = result;
        checks.push(result);
        
      } catch (error) {
        const errorResult: HealthCheckResult = {
          name,
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
          timestamp: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error'
        };
        
        // Enhanced error handling for circuit breaker
        circuitBreaker.failures++;
        circuitBreaker.lastFailure = Date.now();
        
        if (circuitBreaker.state === 'half-open') {
          circuitBreaker.state = 'open';
          circuitBreaker.stateTransitions++;
          console.log(`🚨 Circuit breaker for ${name} re-opened due to error in half-open state`);
        } else if (circuitBreaker.failures >= this.config.circuitBreaker.failureThreshold) {
          circuitBreaker.state = 'open';
          circuitBreaker.stateTransitions++;
          console.log(`🚨 Circuit breaker for ${name} opened due to ${circuitBreaker.failures} failures`);
        }
        
        healthCheck.lastResult = errorResult;
        checks.push(errorResult);
      }
    }
    
    // Enhanced health calculation with environment awareness
    const totalChecks = checks.length;
    const healthyChecks = checks.filter(c => c.status === 'healthy').length;
    const degradedChecks = checks.filter(c => c.status === 'degraded').length;
    const unhealthyChecks = checks.filter(c => c.status === 'unhealthy').length;
    const mockedChecks = checks.filter(c => c.status === 'mocked').length;
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    // In development mode, mocked services don't affect overall health
    const isDevelopment = process.env.NODE_ENV === 'development';
    const criticalUnhealthy = unhealthyChecks - (isDevelopment ? 0 : 0); // All unhealthy are critical in production
    
    if (criticalUnhealthy > 0) {
      overallStatus = criticalUnhealthy > totalChecks / 2 ? 'unhealthy' : 'degraded';
    } else if (degradedChecks > 0) {
      overallStatus = 'degraded';
    }
    
    const totalResponseTime = Date.now() - startTime;
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    
    // Determine mode description
    let mode = 'production';
    if (isDevelopment) {
      mode = mockedChecks > 0 ? 'development-mocked' : 'development';
    }
    
    // Create services summary
    const services: { [key: string]: { status: string; message?: string; connections?: number; collected?: number } } = {};
    checks.forEach(check => {
      services[check.name] = {
        status: check.status,
        message: check.message || undefined,
        ...(check.name === 'websocket' && check.details ? { connections: check.details.activeConnections } : {}),
        ...(check.name === 'metrics' && check.details ? { collected: check.details.metricsCollected } : {})
      };
    });
    
    const systemHealth: SystemHealth = {
      overall: overallStatus,
      environment: process.env.NODE_ENV || 'development',
      mode,
      timestamp: new Date(),
      uptime,
      version: process.env.npm_package_version || '2.0.0',
      checks,
      services,
      summary: {
        total: totalChecks,
        healthy: healthyChecks,
        unhealthy: unhealthyChecks,
        degraded: degradedChecks,
        mocked: mockedChecks,
        responseTime: totalResponseTime
      }
    };
    
    this.lastHealthCheck = systemHealth;
    
    // Emit health check event
    this.emit('health:check', systemHealth);
    
    // Log health status changes
    const previousStatus = this.lastHealthCheck?.overall;
    if (previousStatus && previousStatus !== overallStatus) {
      console.log(`🏥 Health status changed: ${previousStatus} → ${overallStatus}`);
      this.emit('health:change', { 
        previous: previousStatus, 
        current: overallStatus,
        details: systemHealth
      });
    }
    
    // Record metrics
    if (this.metrics) {
      this.metrics.recordUserActivity('health_check', 'system');
      if (overallStatus === 'unhealthy') {
        this.metrics.recordError('health', 'system', 'error');
      }
    }
    
    return systemHealth;
  }

  /**
   * Get current health status
   */
  public getHealthStatus(): SystemHealth | null {
    return this.lastHealthCheck;
  }

  /**
   * Get health check for specific component
   */
  public getComponentHealth(component: string): HealthCheckResult | null {
    const healthCheck = this.healthChecks.get(component);
    return (healthCheck && healthCheck.lastResult) ? healthCheck.lastResult : null;
  }

  /**
   * Check HTTP endpoint health
   */
  private async checkHttpEndpoint(
    url: string,
    timeout: number = 5000
  ): Promise<{
    success: boolean;
    responseTime: number;
    statusCode?: number;
    error?: string;
  }> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const client = url.startsWith('https') ? https : http;
      
      const request = client.get(url, (response) => {
        const responseTime = Date.now() - startTime;
        resolve({
          success: response.statusCode ? response.statusCode < 400 : false,
          responseTime,
          statusCode: response.statusCode || undefined
        });
      });
      
      request.setTimeout(timeout, () => {
        request.destroy();
        resolve({
          success: false,
          responseTime: Date.now() - startTime,
          error: 'Timeout'
        });
      });
      
      request.on('error', (error) => {
        resolve({
          success: false,
          responseTime: Date.now() - startTime,
          error: error.message
        });
      });
    });
  }

  /**
   * Check DNS resolution
   */
  private async checkDnsResolution(hostname: string): Promise<{
    success: boolean;
    responseTime: number;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      const { promisify } = require('util');
      const dns = require('dns');
      const lookup = promisify(dns.lookup);
      
      await lookup(hostname);
      
      return {
        success: true,
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'DNS resolution failed'
      };
    }
  }

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeout: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Health check timeout after ${timeout}ms`));
      }, timeout);
      
      promise
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Stop health checks
   */
  public stopHealthChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined as any;
    }
    
    console.log('🛑 Health checks stopped');
  }

  /**
   * Get readiness probe (for Kubernetes)
   */
  public async getReadinessProbe(): Promise<{ ready: boolean; details?: any }> {
    if (!this.config.enableProbes) {
      return { ready: true };
    }
    
    const health = await this.performHealthCheck();
    
    return {
      ready: health.overall === 'healthy' || health.overall === 'degraded',
      details: {
        overall: health.overall,
        critical: health.checks.filter(c => 
          ['database', 'metrics'].includes(c.name) && c.status === 'unhealthy'
        )
      }
    };
  }

  /**
   * Get liveness probe (for Kubernetes)
   */
  public async getLivenessProbe(): Promise<{ alive: boolean; details?: any }> {
    if (!this.config.enableProbes) {
      return { alive: true };
    }
    
    // Simple check - service is alive if it can respond
    return {
      alive: true,
      details: {
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
        timestamp: new Date()
      }
    };
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    this.stopHealthChecks();
    this.healthChecks.clear();
    this.circuitBreakers.clear();
    console.log('🧹 HealthCheckService cleanup completed');
  }
}