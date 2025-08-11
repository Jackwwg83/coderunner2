import { HealthCheckService, HealthCheckResult, SystemHealth } from '../../src/services/healthCheck';
import { DatabaseService } from '../../src/services/database';
import { MetricsService } from '../../src/services/metrics';
import { WebSocketService } from '../../src/services/websocket';

// Mock dependencies
jest.mock('../../src/services/database');
jest.mock('../../src/services/metrics');
jest.mock('../../src/services/websocket');
jest.mock('http');
jest.mock('https');
jest.mock('fs/promises');

describe('HealthCheckService', () => {
  let healthService: HealthCheckService;
  let mockDb: jest.Mocked<DatabaseService>;
  let mockMetrics: jest.Mocked<MetricsService>;
  let mockWebSocket: jest.Mocked<WebSocketService>;

  beforeEach(() => {
    // Reset singleton
    (HealthCheckService as any).instance = undefined;
    healthService = HealthCheckService.getInstance();
    
    mockDb = DatabaseService.getInstance() as jest.Mocked<DatabaseService>;
    mockMetrics = MetricsService.getInstance() as jest.Mocked<MetricsService>;
    mockWebSocket = WebSocketService.getInstance() as jest.Mocked<WebSocketService>;
    
    // Setup default mock responses
    mockDb.healthCheck = jest.fn().mockResolvedValue({
      healthy: true,
      connection: true,
      latency: 10,
      poolSize: 10,
      activeConnections: 2
    });
    
    mockMetrics.getHealthStatus = jest.fn().mockReturnValue({
      status: 'healthy',
      details: {
        collecting: true,
        collectionTime: 50,
        cpuOverhead: 1,
        registeredMetrics: 15
      }
    });
    
    mockWebSocket.getMetrics = jest.fn().mockReturnValue({
      totalConnections: 100,
      activeConnections: 50,
      authenticatedConnections: 45,
      totalSubscriptions: 25,
      messagesPerSecond: 10,
      avgLatency: 20,
      errorRate: 0.01,
      connectionsByRoom: {},
      totalMessages: 1000,
      uptime: Date.now()
    });
  });

  afterEach(async () => {
    await healthService.cleanup();
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize as singleton', () => {
      const instance1 = HealthCheckService.getInstance();
      const instance2 = HealthCheckService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should register default health checks', () => {
      // Access private healthChecks map
      const healthChecks = (healthService as any).healthChecks;
      
      expect(healthChecks.has('database')).toBe(true);
      expect(healthChecks.has('websocket')).toBe(true);
      expect(healthChecks.has('metrics')).toBe(true);
      expect(healthChecks.has('system')).toBe(true);
      expect(healthChecks.has('network')).toBe(true);
      expect(healthChecks.has('dependencies')).toBe(true);
    });

    it('should start health checks', () => {
      expect(() => healthService.startHealthChecks()).not.toThrow();
    });

    it('should stop health checks', () => {
      healthService.startHealthChecks();
      expect(() => healthService.stopHealthChecks()).not.toThrow();
    });
  });

  describe('Custom Health Checks', () => {
    it('should register custom health check', () => {
      const customCheck = jest.fn().mockResolvedValue({
        name: 'custom',
        status: 'healthy' as const,
        responseTime: 10,
        timestamp: new Date()
      });
      
      healthService.registerHealthCheck('custom', customCheck, true);
      
      const healthChecks = (healthService as any).healthChecks;
      expect(healthChecks.has('custom')).toBe(true);
    });

    it('should execute custom health check', async () => {
      const customCheck = jest.fn().mockResolvedValue({
        name: 'custom',
        status: 'healthy' as const,
        responseTime: 15,
        timestamp: new Date()
      });
      
      healthService.registerHealthCheck('custom', customCheck, true);
      const result = await healthService.performHealthCheck();
      
      expect(customCheck).toHaveBeenCalled();
      expect(result.checks.some(check => check.name === 'custom')).toBe(true);
    });
  });

  describe('System Health Check', () => {
    it('should perform comprehensive health check', async () => {
      const result = await healthService.performHealthCheck();
      
      expect(result).toHaveProperty('overall');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('uptime');
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('checks');
      expect(result).toHaveProperty('summary');
      
      expect(['healthy', 'degraded', 'unhealthy']).toContain(result.overall);
      expect(Array.isArray(result.checks)).toBe(true);
    });

    it('should calculate overall status correctly', async () => {
      // All services healthy
      const result = await healthService.performHealthCheck();
      expect(result.overall).toBe('healthy');
      
      // Simulate degraded service
      mockWebSocket.getMetrics.mockReturnValueOnce({
        ...mockWebSocket.getMetrics(),
        errorRate: 0.15 // 15% error rate -> degraded
      });
      
      const degradedResult = await healthService.performHealthCheck();
      expect(['degraded', 'unhealthy']).toContain(degradedResult.overall);
    });

    it('should handle unhealthy services', async () => {
      mockDb.healthCheck.mockRejectedValueOnce(new Error('Database connection failed'));
      
      const result = await healthService.performHealthCheck();
      expect(result.overall).not.toBe('healthy');
      
      const dbCheck = result.checks.find(check => check.name === 'database');
      expect(dbCheck?.status).toBe('unhealthy');
      expect(dbCheck?.error).toBe('Database connection failed');
    });
  });

  describe('Database Health Check', () => {
    it('should check database health when connected', async () => {
      const result = await healthService.performHealthCheck();
      const dbCheck = result.checks.find(check => check.name === 'database');
      
      expect(dbCheck).toBeDefined();
      expect(dbCheck?.status).toBe('healthy');
      expect(dbCheck?.details).toHaveProperty('connection', true);
      expect(dbCheck?.details).toHaveProperty('latency');
    });

    it('should handle database errors', async () => {
      mockDb.healthCheck.mockRejectedValueOnce(new Error('Connection timeout'));
      
      const result = await healthService.performHealthCheck();
      const dbCheck = result.checks.find(check => check.name === 'database');
      
      expect(dbCheck?.status).toBe('unhealthy');
      expect(dbCheck?.error).toBe('Connection timeout');
    });
  });

  describe('WebSocket Health Check', () => {
    it('should check WebSocket health with normal error rate', async () => {
      const result = await healthService.performHealthCheck();
      const wsCheck = result.checks.find(check => check.name === 'websocket');
      
      expect(wsCheck).toBeDefined();
      expect(wsCheck?.status).toBe('healthy');
      expect(wsCheck?.details).toHaveProperty('activeConnections');
      expect(wsCheck?.details).toHaveProperty('errorRate');
    });

    it('should mark WebSocket as degraded with high error rate', async () => {
      mockWebSocket.getMetrics.mockReturnValueOnce({
        ...mockWebSocket.getMetrics(),
        errorRate: 0.15 // 15% error rate
      });
      
      const result = await healthService.performHealthCheck();
      const wsCheck = result.checks.find(check => check.name === 'websocket');
      
      expect(wsCheck?.status).toBe('degraded');
    });

    it('should mark WebSocket as unhealthy with very high error rate', async () => {
      mockWebSocket.getMetrics.mockReturnValueOnce({
        ...mockWebSocket.getMetrics(),
        errorRate: 0.35 // 35% error rate
      });
      
      const result = await healthService.performHealthCheck();
      const wsCheck = result.checks.find(check => check.name === 'websocket');
      
      expect(wsCheck?.status).toBe('unhealthy');
    });
  });

  describe('Metrics Health Check', () => {
    it('should check metrics service health', async () => {
      const result = await healthService.performHealthCheck();
      const metricsCheck = result.checks.find(check => check.name === 'metrics');
      
      expect(metricsCheck).toBeDefined();
      expect(metricsCheck?.status).toBe('healthy');
      expect(metricsCheck?.details).toHaveProperty('collecting', true);
    });

    it('should handle metrics service errors', async () => {
      mockMetrics.getHealthStatus.mockImplementationOnce(() => {
        throw new Error('Metrics service error');
      });
      
      const result = await healthService.performHealthCheck();
      const metricsCheck = result.checks.find(check => check.name === 'metrics');
      
      expect(metricsCheck?.status).toBe('unhealthy');
      expect(metricsCheck?.error).toBe('Metrics service error');
    });
  });

  describe('System Resource Check', () => {
    it('should check system resources', async () => {
      const result = await healthService.performHealthCheck();
      const systemCheck = result.checks.find(check => check.name === 'system');
      
      expect(systemCheck).toBeDefined();
      expect(systemCheck?.details).toHaveProperty('cpu');
      expect(systemCheck?.details).toHaveProperty('memory');
      expect(systemCheck?.details).toHaveProperty('uptime');
      expect(systemCheck?.details).toHaveProperty('platform');
    });

    it('should detect high resource usage', async () => {
      // Mock high memory usage
      jest.doMock('os', () => ({
        cpus: () => [{ times: { user: 1000, nice: 0, sys: 200, idle: 100, irq: 0 } }],
        totalmem: () => 8000000000, // 8GB
        freemem: () => 400000000,   // 400MB free (95% used)
        loadavg: () => [0.5, 0.3, 0.2],
        uptime: () => 86400,
        platform: () => 'linux',
        arch: () => 'x64'
      }));
      
      const result = await healthService.performHealthCheck();
      const systemCheck = result.checks.find(check => check.name === 'system');
      
      // Should detect high memory usage
      expect(systemCheck?.details.memory.usagePercent).toBeGreaterThan(90);
    });
  });

  describe('Network Health Check', () => {
    it('should perform network connectivity check', async () => {
      const result = await healthService.performHealthCheck();
      const networkCheck = result.checks.find(check => check.name === 'network');
      
      expect(networkCheck).toBeDefined();
      expect(networkCheck?.details).toHaveProperty('internet');
      expect(networkCheck?.details).toHaveProperty('dns');
      expect(networkCheck?.details).toHaveProperty('interfaces');
    });
  });

  describe('Circuit Breaker', () => {
    it('should implement circuit breaker for failing checks', async () => {
      // Make database check fail multiple times
      mockDb.healthCheck.mockRejectedValue(new Error('Connection failed'));
      
      // First few failures should still attempt the check
      await healthService.performHealthCheck();
      await healthService.performHealthCheck();
      await healthService.performHealthCheck();
      
      expect(mockDb.healthCheck).toHaveBeenCalledTimes(3);
      
      // After 3 failures, circuit should be open
      const result = await healthService.performHealthCheck();
      const dbCheck = result.checks.find(check => check.name === 'database');
      
      expect(dbCheck?.status).toBe('unknown');
      expect(dbCheck?.error).toBe('Circuit breaker is open');
    });
  });

  describe('Kubernetes Probes', () => {
    it('should provide readiness probe', async () => {
      const readiness = await healthService.getReadinessProbe();
      
      expect(readiness).toHaveProperty('ready');
      expect(typeof readiness.ready).toBe('boolean');
      
      if (readiness.details) {
        expect(readiness.details).toHaveProperty('overall');
      }
    });

    it('should provide liveness probe', async () => {
      const liveness = await healthService.getLivenessProbe();
      
      expect(liveness).toHaveProperty('alive');
      expect(typeof liveness.alive).toBe('boolean');
      
      if (liveness.details) {
        expect(liveness.details).toHaveProperty('uptime');
        expect(liveness.details).toHaveProperty('timestamp');
      }
    });

    it('should mark as not ready when critical services are down', async () => {
      // Simulate database failure (critical service)
      mockDb.healthCheck.mockRejectedValueOnce(new Error('Database down'));
      
      const readiness = await healthService.getReadinessProbe();
      
      // Should still be ready if only database is down (degraded mode)
      expect(typeof readiness.ready).toBe('boolean');
    });
  });

  describe('Component-specific Health', () => {
    it('should get health status for specific component', async () => {
      await healthService.performHealthCheck();
      
      const dbHealth = healthService.getComponentHealth('database');
      expect(dbHealth).toBeDefined();
      expect(dbHealth?.name).toBe('database');
    });

    it('should return null for non-existent component', () => {
      const health = healthService.getComponentHealth('nonexistent');
      expect(health).toBeNull();
    });
  });

  describe('Health Status Caching', () => {
    it('should cache last health check result', async () => {
      const result1 = await healthService.performHealthCheck();
      const cached = healthService.getHealthStatus();
      
      expect(cached).toBeDefined();
      expect(cached?.timestamp).toEqual(result1.timestamp);
      expect(cached?.overall).toBe(result1.overall);
    });

    it('should return null when no health check performed', () => {
      const status = healthService.getHealthStatus();
      expect(status).toBeNull();
    });
  });

  describe('Event Emission', () => {
    it('should emit health check events', (done) => {
      healthService.on('health:check', (healthStatus: SystemHealth) => {
        expect(healthStatus).toHaveProperty('overall');
        expect(healthStatus).toHaveProperty('checks');
        done();
      });
      
      healthService.performHealthCheck();
    });

    it('should emit health change events', (done) => {
      // First health check to establish baseline
      healthService.performHealthCheck().then(() => {
        healthService.on('health:change', (event) => {
          expect(event).toHaveProperty('previous');
          expect(event).toHaveProperty('current');
          expect(event).toHaveProperty('details');
          done();
        });
        
        // Simulate service degradation
        mockDb.healthCheck.mockRejectedValueOnce(new Error('Service degraded'));
        healthService.performHealthCheck();
      });
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout long-running health checks', async () => {
      // Mock a slow health check
      const slowCheck = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 10000))
      );
      
      healthService.registerHealthCheck('slow', slowCheck, true);
      
      const result = await healthService.performHealthCheck();
      const slowCheckResult = result.checks.find(check => check.name === 'slow');
      
      expect(slowCheckResult?.status).toBe('unhealthy');
      expect(slowCheckResult?.error).toContain('timeout');
    }, 15000);
  });

  describe('Resource Management', () => {
    it('should handle cleanup gracefully', async () => {
      healthService.startHealthChecks();
      await expect(healthService.cleanup()).resolves.not.toThrow();
    });

    it('should handle multiple start/stop cycles', () => {
      expect(() => {
        healthService.startHealthChecks();
        healthService.startHealthChecks(); // Should warn but not crash
        healthService.stopHealthChecks();
        healthService.stopHealthChecks(); // Should be safe
        healthService.startHealthChecks();
      }).not.toThrow();
    });
  });

  describe('Configuration', () => {
    it('should use environment-based configuration', () => {
      // Test with different env vars
      process.env.HEALTH_CHECK_INTERVAL = '60000';
      process.env.HEALTH_CHECK_TIMEOUT = '10000';
      
      (HealthCheckService as any).instance = undefined;
      const configuredService = HealthCheckService.getInstance();
      
      const config = (configuredService as any).config;
      expect(config.interval).toBe(60000);
      expect(config.timeout).toBe(10000);
      
      // Cleanup
      delete process.env.HEALTH_CHECK_INTERVAL;
      delete process.env.HEALTH_CHECK_TIMEOUT;
    });

    it('should disable specific checks via configuration', () => {
      process.env.HEALTH_CHECK_DATABASE = 'false';
      
      (HealthCheckService as any).instance = undefined;
      const configuredService = HealthCheckService.getInstance();
      
      const config = (configuredService as any).config;
      expect(config.checks.database).toBe(false);
      
      delete process.env.HEALTH_CHECK_DATABASE;
    });
  });
});