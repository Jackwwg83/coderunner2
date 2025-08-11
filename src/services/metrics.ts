import { EventEmitter } from 'events';
import * as promClient from 'prom-client';
import * as os from 'os';
import { DeploymentStatus } from '../types/index';
import { DatabaseService } from './database';

/**
 * MetricsService - Comprehensive deployment monitoring and metrics collection
 * 
 * Features:
 * - System-level metrics (CPU, memory, network)
 * - Application-level metrics (deployments, sandboxes)
 * - Business-level metrics (user activity, resource usage)
 * - Prometheus integration with configurable sampling
 * - Smart sampling strategies to minimize performance impact
 * - Real-time metrics streaming via WebSocket
 */
export class MetricsService extends EventEmitter {
  private static instance: MetricsService;
  private db: DatabaseService;
  
  // Prometheus registry and metrics
  private registry: promClient.Registry;
  private collectInterval?: NodeJS.Timeout;
  private aggregationInterval?: NodeJS.Timeout;
  
  // System metrics
  private systemMetrics: {
    cpuUsage: promClient.Gauge<string>;
    memoryUsage: promClient.Gauge<string>;
    diskUsage: promClient.Gauge<string>;
    networkIO: promClient.Counter<string>;
    loadAverage: promClient.Gauge<string>;
    uptime: promClient.Gauge<string>;
  };
  
  // Application metrics
  private appMetrics: {
    deploymentCount: promClient.Gauge<string>;
    sandboxCount: promClient.Gauge<string>;
    activeUsers: promClient.Gauge<string>;
    apiRequests: promClient.Counter<string>;
    apiDuration: promClient.Histogram<string>;
    deploymentDuration: promClient.Histogram<string>;
    errorRate: promClient.Counter<string>;
    websocketConnections: promClient.Gauge<string>;
  };
  
  // Business metrics
  private businessMetrics: {
    resourceCosts: promClient.Counter<string>;
    userActivity: promClient.Counter<string>;
    featureUsage: promClient.Counter<string>;
    planDistribution: promClient.Gauge<string>;
  };
  
  // Internal state
  private lastSampleTime: number = 0;
  private metricsBuffer: Map<string, any[]> = new Map();
  private samplingConfig: {
    systemInterval: number;
    appInterval: number;
    businessInterval: number;
    bufferSize: number;
    aggregationWindow: number;
  };
  
  // Performance tracking
  private performanceImpact = {
    cpuOverhead: 0,
    memoryOverhead: 0,
    collectionTime: 0,
    lastOptimization: Date.now()
  };

  private constructor() {
    super();
    this.db = DatabaseService.getInstance();
    
    // Configuration with smart defaults
    this.samplingConfig = {
      systemInterval: parseInt(process.env.METRICS_SYSTEM_INTERVAL || '10000'), // 10 seconds
      appInterval: parseInt(process.env.METRICS_APP_INTERVAL || '5000'), // 5 seconds  
      businessInterval: parseInt(process.env.METRICS_BUSINESS_INTERVAL || '60000'), // 1 minute
      bufferSize: parseInt(process.env.METRICS_BUFFER_SIZE || '1000'),
      aggregationWindow: parseInt(process.env.METRICS_AGGREGATION_WINDOW || '300000') // 5 minutes
    };
    
    // Initialize Prometheus registry
    this.registry = new promClient.Registry();
    this.initializeMetrics();
    
    console.log('📊 MetricsService initialized with smart sampling');
    console.log(`⚡ System: ${this.samplingConfig.systemInterval}ms, App: ${this.samplingConfig.appInterval}ms`);
  }

  public static getInstance(): MetricsService {
    if (!MetricsService.instance) {
      MetricsService.instance = new MetricsService();
    }
    return MetricsService.instance;
  }

  /**
   * Initialize all Prometheus metrics
   */
  private initializeMetrics(): void {
    // System metrics
    this.systemMetrics = {
      cpuUsage: new promClient.Gauge({
        name: 'coderunner_system_cpu_usage_percent',
        help: 'System CPU usage percentage',
        labelNames: ['core', 'type'],
        registers: [this.registry]
      }),
      
      memoryUsage: new promClient.Gauge({
        name: 'coderunner_system_memory_usage_bytes',
        help: 'System memory usage in bytes',
        labelNames: ['type'],
        registers: [this.registry]
      }),
      
      diskUsage: new promClient.Gauge({
        name: 'coderunner_system_disk_usage_bytes',
        help: 'System disk usage in bytes',
        labelNames: ['mount', 'type'],
        registers: [this.registry]
      }),
      
      networkIO: new promClient.Counter({
        name: 'coderunner_system_network_bytes_total',
        help: 'System network I/O in bytes',
        labelNames: ['interface', 'direction'],
        registers: [this.registry]
      }),
      
      loadAverage: new promClient.Gauge({
        name: 'coderunner_system_load_average',
        help: 'System load average',
        labelNames: ['period'],
        registers: [this.registry]
      }),
      
      uptime: new promClient.Gauge({
        name: 'coderunner_system_uptime_seconds',
        help: 'System uptime in seconds',
        registers: [this.registry]
      })
    };
    
    // Application metrics
    this.appMetrics = {
      deploymentCount: new promClient.Gauge({
        name: 'coderunner_deployments_total',
        help: 'Total number of deployments',
        labelNames: ['status', 'type'],
        registers: [this.registry]
      }),
      
      sandboxCount: new promClient.Gauge({
        name: 'coderunner_sandboxes_total', 
        help: 'Total number of sandboxes',
        labelNames: ['status', 'template'],
        registers: [this.registry]
      }),
      
      activeUsers: new promClient.Gauge({
        name: 'coderunner_active_users_total',
        help: 'Number of active users',
        labelNames: ['period'],
        registers: [this.registry]
      }),
      
      apiRequests: new promClient.Counter({
        name: 'coderunner_api_requests_total',
        help: 'Total number of API requests',
        labelNames: ['method', 'endpoint', 'status'],
        registers: [this.registry]
      }),
      
      apiDuration: new promClient.Histogram({
        name: 'coderunner_api_duration_seconds',
        help: 'API request duration in seconds',
        labelNames: ['method', 'endpoint'],
        buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
        registers: [this.registry]
      }),
      
      deploymentDuration: new promClient.Histogram({
        name: 'coderunner_deployment_duration_seconds',
        help: 'Deployment duration in seconds',
        labelNames: ['type', 'status'],
        buckets: [1, 5, 10, 30, 60, 120, 300, 600, 1200],
        registers: [this.registry]
      }),
      
      errorRate: new promClient.Counter({
        name: 'coderunner_errors_total',
        help: 'Total number of errors',
        labelNames: ['type', 'service', 'severity'],
        registers: [this.registry]
      }),
      
      websocketConnections: new promClient.Gauge({
        name: 'coderunner_websocket_connections_total',
        help: 'Number of WebSocket connections',
        labelNames: ['status'],
        registers: [this.registry]
      })
    };
    
    // Business metrics
    this.businessMetrics = {
      resourceCosts: new promClient.Counter({
        name: 'coderunner_resource_costs_total',
        help: 'Total resource costs',
        labelNames: ['resource_type', 'plan'],
        registers: [this.registry]
      }),
      
      userActivity: new promClient.Counter({
        name: 'coderunner_user_activity_total',
        help: 'User activity events',
        labelNames: ['action', 'plan_type'],
        registers: [this.registry]
      }),
      
      featureUsage: new promClient.Counter({
        name: 'coderunner_feature_usage_total',
        help: 'Feature usage statistics',
        labelNames: ['feature', 'user_type'],
        registers: [this.registry]
      }),
      
      planDistribution: new promClient.Gauge({
        name: 'coderunner_plan_distribution_total',
        help: 'Distribution of user plans',
        labelNames: ['plan_type'],
        registers: [this.registry]
      })
    };
    
    // Register default Node.js metrics
    promClient.collectDefaultMetrics({ register: this.registry });
  }

  /**
   * Start metrics collection with smart sampling
   */
  public startCollection(): void {
    if (this.collectInterval) {
      console.warn('⚠️ Metrics collection already started');
      return;
    }
    
    // System metrics collection (less frequent)
    const systemCollector = setInterval(() => {
      this.collectSystemMetrics();
    }, this.samplingConfig.systemInterval);
    
    // Application metrics collection (more frequent)
    const appCollector = setInterval(() => {
      this.collectApplicationMetrics();
    }, this.samplingConfig.appInterval);
    
    // Business metrics collection (least frequent)
    const businessCollector = setInterval(() => {
      this.collectBusinessMetrics();
    }, this.samplingConfig.businessInterval);
    
    // Aggregation and optimization
    this.aggregationInterval = setInterval(() => {
      this.performAggregation();
      this.optimizeSampling();
    }, this.samplingConfig.aggregationWindow);
    
    this.collectInterval = systemCollector; // Keep reference for cleanup
    
    console.log('✅ Metrics collection started with adaptive sampling');
  }

  /**
   * Collect system-level metrics
   */
  private async collectSystemMetrics(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // CPU usage
      const cpus = os.cpus();
      let totalIdle = 0;
      let totalTick = 0;
      
      cpus.forEach((cpu, index) => {
        const total = Object.values(cpu.times).reduce((acc, time) => acc + time, 0);
        const idle = cpu.times.idle;
        totalIdle += idle;
        totalTick += total;
        
        // Per-core CPU usage
        this.systemMetrics.cpuUsage.set(
          { core: index.toString(), type: 'usage' },
          ((total - idle) / total) * 100
        );
      });
      
      // Overall CPU usage
      const cpuUsage = ((totalTick - totalIdle) / totalTick) * 100;
      this.systemMetrics.cpuUsage.set({ core: 'total', type: 'usage' }, cpuUsage);
      
      // Memory usage
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      
      this.systemMetrics.memoryUsage.set({ type: 'total' }, totalMem);
      this.systemMetrics.memoryUsage.set({ type: 'used' }, usedMem);
      this.systemMetrics.memoryUsage.set({ type: 'free' }, freeMem);
      this.systemMetrics.memoryUsage.set({ type: 'usage_percent' }, (usedMem / totalMem) * 100);
      
      // Load average
      const loadAvg = os.loadavg();
      this.systemMetrics.loadAverage.set({ period: '1m' }, loadAvg[0]);
      this.systemMetrics.loadAverage.set({ period: '5m' }, loadAvg[1]);
      this.systemMetrics.loadAverage.set({ period: '15m' }, loadAvg[2]);
      
      // Uptime
      this.systemMetrics.uptime.set({}, os.uptime());
      
      // Track performance impact
      const collectionTime = Date.now() - startTime;
      this.performanceImpact.collectionTime = collectionTime;
      this.performanceImpact.cpuOverhead = cpuUsage * 0.01; // Estimate
      
    } catch (error) {
      console.error('❌ Failed to collect system metrics:', error);
      this.appMetrics.errorRate.inc({ type: 'metrics', service: 'system', severity: 'error' });
    }
  }

  /**
   * Collect application-level metrics
   */
  private async collectApplicationMetrics(): Promise<void> {
    try {
      // Get deployment statistics
      const deploymentStats = await this.getDeploymentStatistics();
      
      // Update deployment metrics
      Object.entries(deploymentStats.byStatus).forEach(([status, count]) => {
        this.appMetrics.deploymentCount.set({ status, type: 'all' }, count);
      });
      
      Object.entries(deploymentStats.byType).forEach(([type, count]) => {
        this.appMetrics.deploymentCount.set({ status: 'all', type }, count);
      });
      
      // Active users (simplified - could be enhanced with session tracking)
      this.appMetrics.activeUsers.set({ period: '5m' }, deploymentStats.activeUsers);
      
    } catch (error) {
      console.error('❌ Failed to collect application metrics:', error);
      this.appMetrics.errorRate.inc({ type: 'metrics', service: 'application', severity: 'error' });
    }
  }

  /**
   * Collect business-level metrics
   */
  private async collectBusinessMetrics(): Promise<void> {
    try {
      // Get user plan distribution
      const planStats = await this.getUserPlanDistribution();
      
      Object.entries(planStats).forEach(([planType, count]) => {
        this.businessMetrics.planDistribution.set({ plan_type: planType }, count);
      });
      
    } catch (error) {
      console.error('❌ Failed to collect business metrics:', error);
      this.appMetrics.errorRate.inc({ type: 'metrics', service: 'business', severity: 'error' });
    }
  }

  /**
   * Get deployment statistics from database
   */
  private async getDeploymentStatistics(): Promise<{
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    activeUsers: number;
    total: number;
  }> {
    try {
      const result = await this.db.query(`
        SELECT 
          status,
          runtime_type,
          COUNT(*) as count,
          COUNT(DISTINCT p.user_id) as active_users
        FROM deployments d
        JOIN projects p ON d.project_id = p.id
        WHERE d.created_at >= NOW() - INTERVAL '1 day'
        GROUP BY status, runtime_type
      `);
      
      const byStatus: Record<string, number> = {};
      const byType: Record<string, number> = {};
      let activeUsers = 0;
      
      result.rows.forEach(row => {
        byStatus[row.status] = (byStatus[row.status] || 0) + parseInt(row.count);
        if (row.runtime_type) {
          byType[row.runtime_type] = (byType[row.runtime_type] || 0) + parseInt(row.count);
        }
        activeUsers = Math.max(activeUsers, parseInt(row.active_users || '0'));
      });
      
      const total = Object.values(byStatus).reduce((sum, count) => sum + count, 0);
      
      return { byStatus, byType, activeUsers, total };
      
    } catch (error) {
      console.error('Error fetching deployment statistics:', error);
      return { byStatus: {}, byType: {}, activeUsers: 0, total: 0 };
    }
  }

  /**
   * Get user plan distribution
   */
  private async getUserPlanDistribution(): Promise<Record<string, number>> {
    try {
      const result = await this.db.query(`
        SELECT plan_type, COUNT(*) as count
        FROM users
        GROUP BY plan_type
      `);
      
      const distribution: Record<string, number> = {};
      result.rows.forEach(row => {
        distribution[row.plan_type] = parseInt(row.count);
      });
      
      return distribution;
      
    } catch (error) {
      console.error('Error fetching user plan distribution:', error);
      return {};
    }
  }

  /**
   * Record API request metrics
   */
  public recordApiRequest(
    method: string,
    endpoint: string,
    statusCode: number,
    duration: number
  ): void {
    const status = Math.floor(statusCode / 100) + 'xx';
    
    this.appMetrics.apiRequests.inc({ method, endpoint, status });
    this.appMetrics.apiDuration.observe({ method, endpoint }, duration / 1000);
    
    if (statusCode >= 400) {
      this.appMetrics.errorRate.inc({
        type: 'api',
        service: 'http',
        severity: statusCode >= 500 ? 'error' : 'warning'
      });
    }
  }

  /**
   * Record deployment metrics
   */
  public recordDeployment(
    type: string,
    status: string,
    duration?: number,
    userId?: string
  ): void {
    if (duration) {
      this.appMetrics.deploymentDuration.observe(
        { type, status },
        duration / 1000
      );
    }
    
    if (userId) {
      this.businessMetrics.userActivity.inc({ action: 'deploy', plan_type: 'unknown' });
    }
  }

  /**
   * Record user activity
   */
  public recordUserActivity(action: string, planType: string = 'unknown'): void {
    this.businessMetrics.userActivity.inc({ action, plan_type: planType });
  }

  /**
   * Record feature usage
   */
  public recordFeatureUsage(feature: string, userType: string = 'authenticated'): void {
    this.businessMetrics.featureUsage.inc({ feature, user_type: userType });
  }

  /**
   * Record error
   */
  public recordError(type: string, service: string, severity: string = 'error'): void {
    this.appMetrics.errorRate.inc({ type, service, severity });
  }

  /**
   * Update WebSocket connection count
   */
  public updateWebSocketConnections(total: number, authenticated: number): void {
    this.appMetrics.websocketConnections.set({ status: 'total' }, total);
    this.appMetrics.websocketConnections.set({ status: 'authenticated' }, authenticated);
    this.appMetrics.websocketConnections.set({ status: 'anonymous' }, total - authenticated);
  }

  /**
   * Perform metric aggregation and cleanup
   */
  private performAggregation(): void {
    // Clear old buffered data
    const cutoff = Date.now() - this.samplingConfig.aggregationWindow;
    
    for (const [key, buffer] of this.metricsBuffer.entries()) {
      const filtered = buffer.filter(item => item.timestamp > cutoff);
      if (filtered.length === 0) {
        this.metricsBuffer.delete(key);
      } else {
        this.metricsBuffer.set(key, filtered);
      }
    }
    
    // Emit aggregated metrics event
    this.emit('metrics:aggregated', {
      timestamp: new Date(),
      bufferSizes: Array.from(this.metricsBuffer.entries()).map(([key, buffer]) => ({
        key,
        size: buffer.length
      })),
      performanceImpact: this.performanceImpact
    });
  }

  /**
   * Optimize sampling based on system load
   */
  private optimizeSampling(): void {
    const currentTime = Date.now();
    if (currentTime - this.performanceImpact.lastOptimization < 60000) {
      return; // Don't optimize more than once per minute
    }
    
    // Get current system load
    const loadAvg = os.loadavg()[0];
    const cpuCount = os.cpus().length;
    const loadPercentage = (loadAvg / cpuCount) * 100;
    
    // Adaptive sampling based on load
    if (loadPercentage > 80) {
      // High load: reduce sampling frequency
      this.samplingConfig.systemInterval = Math.min(
        this.samplingConfig.systemInterval * 1.2,
        30000
      );
      console.log(`🎯 High load detected (${loadPercentage.toFixed(1)}%), reducing sampling frequency`);
    } else if (loadPercentage < 30) {
      // Low load: increase sampling frequency
      this.samplingConfig.systemInterval = Math.max(
        this.samplingConfig.systemInterval * 0.9,
        5000
      );
    }
    
    this.performanceImpact.lastOptimization = currentTime;
  }

  /**
   * Get current metrics for real-time streaming
   */
  public getCurrentMetrics(): any {
    const metrics = {
      timestamp: new Date(),
      system: {
        cpu: {
          usage: 0,
          cores: os.cpus().length
        },
        memory: {
          total: os.totalmem(),
          used: os.totalmem() - os.freemem(),
          free: os.freemem(),
          usagePercent: ((os.totalmem() - os.freemem()) / os.totalmem()) * 100
        },
        load: os.loadavg(),
        uptime: os.uptime()
      },
      performance: this.performanceImpact,
      sampling: this.samplingConfig
    };
    
    return metrics;
  }

  /**
   * Get Prometheus metrics
   */
  public async getPrometheusMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * Get metrics registry for custom integrations
   */
  public getRegistry(): promClient.Registry {
    return this.registry;
  }

  /**
   * Stop metrics collection
   */
  public stopCollection(): void {
    if (this.collectInterval) {
      clearInterval(this.collectInterval);
      this.collectInterval = undefined;
    }
    
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
      this.aggregationInterval = undefined;
    }
    
    console.log('🛑 Metrics collection stopped');
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    this.stopCollection();
    this.registry.clear();
    this.metricsBuffer.clear();
    console.log('🧹 MetricsService cleanup completed');
  }

  /**
   * Get health status of metrics service
   */
  public async getHealthStatus(): Promise<{
    status: 'healthy' | 'unhealthy' | 'degraded';
    details: any;
    }> {
    const isCollecting = !!this.collectInterval;
    const recentCollectionTime = this.performanceImpact.collectionTime;
    const cpuOverhead = this.performanceImpact.cpuOverhead;
    
    let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    
    if (!isCollecting) {
      status = 'unhealthy';
    } else if (cpuOverhead > 5 || recentCollectionTime > 1000) {
      status = 'degraded';
    }
    
    return {
      status,
      details: {
        collecting: isCollecting,
        collectionTime: recentCollectionTime,
        cpuOverhead: cpuOverhead,
        bufferSizes: this.metricsBuffer.size,
        samplingConfig: this.samplingConfig,
        registeredMetrics: await this.registry.getMetricsAsJSON().then(metrics => metrics.length)
      }
    };
  }
}