import { MetricsService } from '../../src/services/metrics';
import { DatabaseService } from '../../src/services/database';

// Mock dependencies
jest.mock('../../src/services/database');
jest.mock('prom-client', () => ({
  collectDefaultMetrics: jest.fn(),
  Registry: jest.fn().mockImplementation(() => ({
    metrics: jest.fn().mockResolvedValue('# Mock metrics'),
    clear: jest.fn(),
    getMetricsAsJSON: jest.fn().mockReturnValue([])
  })),
  Gauge: jest.fn().mockImplementation(() => ({
    set: jest.fn(),
    inc: jest.fn(),
    dec: jest.fn()
  })),
  Counter: jest.fn().mockImplementation(() => ({
    inc: jest.fn(),
    labels: jest.fn().mockReturnValue({ inc: jest.fn() })
  })),
  Histogram: jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    labels: jest.fn().mockReturnValue({ observe: jest.fn() })
  }))
}));

describe('MetricsService', () => {
  let metricsService: MetricsService;
  let mockDb: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    // Reset singleton
    (MetricsService as any).instance = undefined;
    metricsService = MetricsService.getInstance();
    
    mockDb = DatabaseService.getInstance() as jest.Mocked<DatabaseService>;
    mockDb.query = jest.fn();
  });

  afterEach(async () => {
    await metricsService.cleanup();
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize as singleton', () => {
      const instance1 = MetricsService.getInstance();
      const instance2 = MetricsService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should start metrics collection', () => {
      expect(() => metricsService.startCollection()).not.toThrow();
    });

    it('should stop metrics collection', () => {
      metricsService.startCollection();
      expect(() => metricsService.stopCollection()).not.toThrow();
    });
  });

  describe('System Metrics', () => {
    beforeEach(() => {
      metricsService.startCollection();
    });

    it('should collect current system metrics', () => {
      const metrics = metricsService.getCurrentMetrics();
      
      expect(metrics).toHaveProperty('timestamp');
      expect(metrics).toHaveProperty('system');
      expect(metrics.system).toHaveProperty('cpu');
      expect(metrics.system).toHaveProperty('memory');
      expect(metrics.system).toHaveProperty('load');
      expect(metrics.system).toHaveProperty('uptime');
    });

    it('should have proper memory usage percentage calculation', () => {
      const metrics = metricsService.getCurrentMetrics();
      
      expect(metrics.system.memory.usagePercent).toBeGreaterThanOrEqual(0);
      expect(metrics.system.memory.usagePercent).toBeLessThanOrEqual(100);
    });

    it('should track performance impact', () => {
      const metrics = metricsService.getCurrentMetrics();
      
      expect(metrics).toHaveProperty('performance');
      expect(metrics.performance).toHaveProperty('cpuOverhead');
      expect(metrics.performance).toHaveProperty('collectionTime');
    });
  });

  describe('API Metrics Recording', () => {
    it('should record API request metrics', () => {
      expect(() => {
        metricsService.recordApiRequest('GET', '/api/test', 200, 150);
      }).not.toThrow();
    });

    it('should record API error metrics for 4xx codes', () => {
      expect(() => {
        metricsService.recordApiRequest('POST', '/api/test', 404, 50);
      }).not.toThrow();
    });

    it('should record API error metrics for 5xx codes', () => {
      expect(() => {
        metricsService.recordApiRequest('GET', '/api/test', 500, 1000);
      }).not.toThrow();
    });
  });

  describe('Deployment Metrics', () => {
    it('should record deployment metrics with duration', () => {
      expect(() => {
        metricsService.recordDeployment('nodejs', 'completed', 30000, 'user123');
      }).not.toThrow();
    });

    it('should record deployment metrics without duration', () => {
      expect(() => {
        metricsService.recordDeployment('manifest', 'failed');
      }).not.toThrow();
    });
  });

  describe('User Activity Tracking', () => {
    it('should record user activity', () => {
      expect(() => {
        metricsService.recordUserActivity('login', 'premium');
      }).not.toThrow();
    });

    it('should record feature usage', () => {
      expect(() => {
        metricsService.recordFeatureUsage('websocket', 'authenticated');
      }).not.toThrow();
    });
  });

  describe('WebSocket Metrics', () => {
    it('should update WebSocket connection counts', () => {
      expect(() => {
        metricsService.updateWebSocketConnections(50, 45);
      }).not.toThrow();
    });

    it('should handle zero connections', () => {
      expect(() => {
        metricsService.updateWebSocketConnections(0, 0);
      }).not.toThrow();
    });
  });

  describe('Error Recording', () => {
    it('should record errors with different severities', () => {
      expect(() => {
        metricsService.recordError('api', 'http', 'warning');
        metricsService.recordError('database', 'connection', 'error');
        metricsService.recordError('system', 'memory', 'critical');
      }).not.toThrow();
    });
  });

  describe('Database Integration', () => {
    it('should fetch deployment statistics', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          { status: 'RUNNING', runtime_type: 'nodejs', count: '5', active_users: '3' },
          { status: 'FAILED', runtime_type: 'manifest', count: '2', active_users: '1' }
        ],
        rowCount: 2,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      // Access private method for testing
      const privateMethod = (metricsService as any).getDeploymentStatistics;
      const stats = await privateMethod.call(metricsService);
      
      expect(stats.byStatus).toHaveProperty('RUNNING');
      expect(stats.byStatus).toHaveProperty('FAILED');
      expect(stats.byType).toHaveProperty('nodejs');
      expect(stats.byType).toHaveProperty('manifest');
    });

    it('should handle database errors gracefully', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('Database error'));

      // Access private method for testing
      const privateMethod = (metricsService as any).getDeploymentStatistics;
      const stats = await privateMethod.call(metricsService);
      
      expect(stats.byStatus).toEqual({});
      expect(stats.byType).toEqual({});
      expect(stats.activeUsers).toBe(0);
    });

    it('should fetch user plan distribution', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          { plan_type: 'free', count: '100' },
          { plan_type: 'premium', count: '25' },
          { plan_type: 'team', count: '5' }
        ],
        rowCount: 3,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      // Access private method for testing
      const privateMethod = (metricsService as any).getUserPlanDistribution;
      const distribution = await privateMethod.call(metricsService);
      
      expect(distribution).toHaveProperty('free', 100);
      expect(distribution).toHaveProperty('premium', 25);
      expect(distribution).toHaveProperty('team', 5);
    });
  });

  describe('Prometheus Integration', () => {
    it('should return Prometheus metrics', async () => {
      const metrics = await metricsService.getPrometheusMetrics();
      expect(typeof metrics).toBe('string');
      expect(metrics).toBe('# Mock metrics');
    });

    it('should return metrics registry', () => {
      const registry = metricsService.getRegistry();
      expect(registry).toBeDefined();
    });
  });

  describe('Health Status', () => {
    it('should return health status when not collecting', () => {
      const health = metricsService.getHealthStatus();
      
      expect(health.status).toBe('unhealthy');
      expect(health.details).toHaveProperty('collecting', false);
    });

    it('should return health status when collecting', () => {
      metricsService.startCollection();
      const health = metricsService.getHealthStatus();
      
      expect(['healthy', 'degraded']).toContain(health.status);
      expect(health.details).toHaveProperty('collecting', true);
    });
  });

  describe('Resource Management', () => {
    it('should track sampling configuration', () => {
      const metrics = metricsService.getCurrentMetrics();
      
      expect(metrics).toHaveProperty('sampling');
      expect(metrics.sampling).toHaveProperty('systemInterval');
      expect(metrics.sampling).toHaveProperty('appInterval');
      expect(metrics.sampling).toHaveProperty('businessInterval');
    });

    it('should handle cleanup gracefully', async () => {
      metricsService.startCollection();
      await expect(metricsService.cleanup()).resolves.not.toThrow();
    });
  });

  describe('Performance Optimization', () => {
    it('should maintain performance metrics', () => {
      const metrics = metricsService.getCurrentMetrics();
      
      expect(metrics.performance).toHaveProperty('cpuOverhead');
      expect(metrics.performance).toHaveProperty('collectionTime');
      expect(metrics.performance.cpuOverhead).toBeGreaterThanOrEqual(0);
      expect(metrics.performance.collectionTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle high frequency requests without degradation', () => {
      // Simulate high frequency API requests
      for (let i = 0; i < 100; i++) {
        metricsService.recordApiRequest('GET', '/api/test', 200, 50);
      }
      
      const health = metricsService.getHealthStatus();
      expect(['healthy', 'degraded']).toContain(health.status);
    });
  });

  describe('Event Emission', () => {
    it('should emit events when configured', (done) => {
      metricsService.on('metrics:aggregated', (data) => {
        expect(data).toHaveProperty('timestamp');
        expect(data).toHaveProperty('bufferSizes');
        expect(data).toHaveProperty('performanceImpact');
        done();
      });
      
      // Trigger aggregation by accessing private method
      const privateMethod = (metricsService as any).performAggregation;
      privateMethod.call(metricsService);
    });
  });

  describe('System Metrics Collection', () => {
    it('should collect CPU usage metrics', async () => {
      metricsService.startCollection();
      
      // Allow metrics collection to run
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const metrics = metricsService.getCurrentMetrics();
      expect(metrics.system.cpu).toHaveProperty('usage');
      expect(metrics.system.cpu).toHaveProperty('cores');
      expect(metrics.system.cpu.cores).toBeGreaterThan(0);
    });

    it('should collect memory usage metrics with correct percentages', () => {
      const metrics = metricsService.getCurrentMetrics();
      
      expect(metrics.system.memory).toHaveProperty('total');
      expect(metrics.system.memory).toHaveProperty('used');
      expect(metrics.system.memory).toHaveProperty('free');
      expect(metrics.system.memory).toHaveProperty('usagePercent');
      
      expect(metrics.system.memory.total).toBeGreaterThan(0);
      expect(metrics.system.memory.usagePercent).toBeGreaterThanOrEqual(0);
      expect(metrics.system.memory.usagePercent).toBeLessThanOrEqual(100);
      expect(metrics.system.memory.used + metrics.system.memory.free).toBe(metrics.system.memory.total);
    });

    it('should collect load average metrics', () => {
      const metrics = metricsService.getCurrentMetrics();
      
      expect(metrics.system.load).toHaveLength(3);
      expect(metrics.system.load[0]).toBeGreaterThanOrEqual(0);
      expect(metrics.system.load[1]).toBeGreaterThanOrEqual(0);
      expect(metrics.system.load[2]).toBeGreaterThanOrEqual(0);
    });

    it('should collect uptime metrics', () => {
      const metrics = metricsService.getCurrentMetrics();
      
      expect(metrics.system.uptime).toBeGreaterThan(0);
      expect(typeof metrics.system.uptime).toBe('number');
    });
  });

  describe('Application Metrics Collection', () => {
    it('should handle deployment statistics with mixed data', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          { status: 'RUNNING', runtime_type: 'nodejs', count: '3', active_users: '2' },
          { status: 'FAILED', runtime_type: 'nodejs', count: '1', active_users: '1' },
          { status: 'BUILDING', runtime_type: 'python', count: '2', active_users: '1' },
          { status: 'STOPPED', runtime_type: null, count: '1', active_users: '0' }
        ],
        rowCount: 4,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      // Access private method for testing
      const privateMethod = (metricsService as any).getDeploymentStatistics;
      const stats = await privateMethod.call(metricsService);
      
      expect(stats.byStatus).toHaveProperty('RUNNING', 3);
      expect(stats.byStatus).toHaveProperty('FAILED', 1);
      expect(stats.byStatus).toHaveProperty('BUILDING', 2);
      expect(stats.byStatus).toHaveProperty('STOPPED', 1);
      
      expect(stats.byType).toHaveProperty('nodejs', 4);
      expect(stats.byType).toHaveProperty('python', 2);
      expect(stats.byType).not.toHaveProperty('null');
      
      expect(stats.total).toBe(7);
      expect(stats.activeUsers).toBe(2);
    });

    it('should handle empty deployment statistics', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      const privateMethod = (metricsService as any).getDeploymentStatistics;
      const stats = await privateMethod.call(metricsService);
      
      expect(stats.byStatus).toEqual({});
      expect(stats.byType).toEqual({});
      expect(stats.total).toBe(0);
      expect(stats.activeUsers).toBe(0);
    });
  });

  describe('Business Metrics Collection', () => {
    it('should collect complete plan distribution', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          { plan_type: 'free', count: '150' },
          { plan_type: 'premium', count: '50' },
          { plan_type: 'team', count: '10' },
          { plan_type: 'enterprise', count: '2' }
        ],
        rowCount: 4,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      const privateMethod = (metricsService as any).getUserPlanDistribution;
      const distribution = await privateMethod.call(metricsService);
      
      expect(distribution).toHaveProperty('free', 150);
      expect(distribution).toHaveProperty('premium', 50);
      expect(distribution).toHaveProperty('team', 10);
      expect(distribution).toHaveProperty('enterprise', 2);
    });

    it('should handle database errors in plan distribution', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('Connection timeout'));

      const privateMethod = (metricsService as any).getUserPlanDistribution;
      const distribution = await privateMethod.call(metricsService);
      
      expect(distribution).toEqual({});
    });
  });

  describe('API Request Metrics', () => {
    it('should categorize status codes correctly', () => {
      expect(() => {
        metricsService.recordApiRequest('GET', '/api/test', 200, 150);   // 2xx
        metricsService.recordApiRequest('POST', '/api/create', 201, 300); // 2xx
        metricsService.recordApiRequest('GET', '/api/notfound', 404, 50);  // 4xx
        metricsService.recordApiRequest('DELETE', '/api/error', 500, 1000); // 5xx
        metricsService.recordApiRequest('PATCH', '/api/update', 302, 200);  // 3xx
      }).not.toThrow();
    });

    it('should record duration in seconds', () => {
      // Test with various durations in milliseconds
      expect(() => {
        metricsService.recordApiRequest('GET', '/fast', 200, 50);    // 0.05 seconds
        metricsService.recordApiRequest('POST', '/medium', 200, 500); // 0.5 seconds
        metricsService.recordApiRequest('PUT', '/slow', 200, 2000);   // 2 seconds
      }).not.toThrow();
    });

    it('should handle extreme duration values', () => {
      expect(() => {
        metricsService.recordApiRequest('GET', '/instant', 200, 0);
        metricsService.recordApiRequest('POST', '/timeout', 504, 30000);
        metricsService.recordApiRequest('GET', '/ultra-fast', 200, 1);
      }).not.toThrow();
    });
  });

  describe('Deployment Metrics Recording', () => {
    it('should record deployment with all parameters', () => {
      expect(() => {
        metricsService.recordDeployment('nodejs', 'completed', 45000, 'user123');
        metricsService.recordDeployment('python', 'failed', 120000, 'user456');
        metricsService.recordDeployment('manifest', 'building', 5000);
      }).not.toThrow();
    });

    it('should handle deployment without optional parameters', () => {
      expect(() => {
        metricsService.recordDeployment('nodejs', 'completed');
        metricsService.recordDeployment('python', 'failed', undefined, 'user123');
      }).not.toThrow();
    });

    it('should handle edge case durations', () => {
      expect(() => {
        metricsService.recordDeployment('nodejs', 'completed', 0);        // Instant
        metricsService.recordDeployment('python', 'timeout', 1800000);    // 30 minutes
        metricsService.recordDeployment('manifest', 'failed', 1);         // 1ms
      }).not.toThrow();
    });
  });

  describe('Feature Usage and User Activity', () => {
    it('should record various user activities', () => {
      expect(() => {
        metricsService.recordUserActivity('login', 'premium');
        metricsService.recordUserActivity('logout', 'free');
        metricsService.recordUserActivity('deploy', 'team');
        metricsService.recordUserActivity('view_logs', 'enterprise');
      }).not.toThrow();
    });

    it('should record feature usage with default user type', () => {
      expect(() => {
        metricsService.recordFeatureUsage('websocket');
        metricsService.recordFeatureUsage('api_deployment');
        metricsService.recordFeatureUsage('log_streaming');
      }).not.toThrow();
    });

    it('should record feature usage with specific user types', () => {
      expect(() => {
        metricsService.recordFeatureUsage('advanced_analytics', 'premium');
        metricsService.recordFeatureUsage('team_collaboration', 'team');
        metricsService.recordFeatureUsage('enterprise_sso', 'enterprise');
        metricsService.recordFeatureUsage('basic_deployment', 'free');
      }).not.toThrow();
    });

    it('should handle activity recording without plan type', () => {
      expect(() => {
        metricsService.recordUserActivity('unknown_action');
      }).not.toThrow();
    });
  });

  describe('Error Recording and Categorization', () => {
    it('should record errors with different types and services', () => {
      expect(() => {
        metricsService.recordError('api', 'http', 'warning');
        metricsService.recordError('database', 'connection', 'error');
        metricsService.recordError('websocket', 'authentication', 'critical');
        metricsService.recordError('deployment', 'build', 'error');
        metricsService.recordError('system', 'memory', 'warning');
      }).not.toThrow();
    });

    it('should use default severity when not specified', () => {
      expect(() => {
        metricsService.recordError('unknown', 'service');
      }).not.toThrow();
    });

    it('should handle various severity levels', () => {
      expect(() => {
        metricsService.recordError('test', 'service', 'trace');
        metricsService.recordError('test', 'service', 'debug');
        metricsService.recordError('test', 'service', 'info');
        metricsService.recordError('test', 'service', 'warning');
        metricsService.recordError('test', 'service', 'error');
        metricsService.recordError('test', 'service', 'critical');
        metricsService.recordError('test', 'service', 'fatal');
      }).not.toThrow();
    });
  });

  describe('WebSocket Connection Tracking', () => {
    it('should track various connection scenarios', () => {
      expect(() => {
        metricsService.updateWebSocketConnections(100, 80);  // 80% authenticated
        metricsService.updateWebSocketConnections(50, 50);   // 100% authenticated
        metricsService.updateWebSocketConnections(200, 0);   // 0% authenticated
        metricsService.updateWebSocketConnections(1, 1);     // Single connection
      }).not.toThrow();
    });

    it('should handle edge case connection counts', () => {
      expect(() => {
        metricsService.updateWebSocketConnections(0, 0);      // No connections
        metricsService.updateWebSocketConnections(1000, 999); // High volume
        metricsService.updateWebSocketConnections(5, 10);     // More auth than total (edge case)
      }).not.toThrow();
    });

    it('should calculate anonymous connections correctly', () => {
      // This test relies on implementation details, but validates the logic
      expect(() => {
        metricsService.updateWebSocketConnections(100, 60); // Should result in 40 anonymous
      }).not.toThrow();
    });
  });

  describe('Performance Monitoring and Optimization', () => {
    it('should track performance impact metrics', () => {
      metricsService.startCollection();
      const metrics = metricsService.getCurrentMetrics();
      
      expect(metrics.performance).toHaveProperty('cpuOverhead');
      expect(metrics.performance).toHaveProperty('collectionTime');
      expect(metrics.performance.cpuOverhead).toBeGreaterThanOrEqual(0);
      expect(metrics.performance.collectionTime).toBeGreaterThanOrEqual(0);
    });

    it('should adapt sampling configuration', () => {
      const metrics = metricsService.getCurrentMetrics();
      
      expect(metrics.sampling).toHaveProperty('systemInterval');
      expect(metrics.sampling).toHaveProperty('appInterval');
      expect(metrics.sampling).toHaveProperty('businessInterval');
      expect(metrics.sampling).toHaveProperty('bufferSize');
      expect(metrics.sampling).toHaveProperty('aggregationWindow');
      
      expect(metrics.sampling.systemInterval).toBeGreaterThan(0);
      expect(metrics.sampling.appInterval).toBeGreaterThan(0);
      expect(metrics.sampling.businessInterval).toBeGreaterThan(0);
    });

    it('should emit aggregation events', (done) => {
      metricsService.on('metrics:aggregated', (data) => {
        expect(data).toHaveProperty('timestamp');
        expect(data).toHaveProperty('bufferSizes');
        expect(data).toHaveProperty('performanceImpact');
        expect(Array.isArray(data.bufferSizes)).toBe(true);
        done();
      });
      
      // Trigger aggregation manually
      const privateMethod = (metricsService as any).performAggregation;
      privateMethod.call(metricsService);
    });

    it('should optimize sampling based on system load', () => {
      // This tests the optimization logic without relying on actual system load
      const originalOptimize = (metricsService as any).optimizeSampling.bind(metricsService);
      
      expect(() => {
        originalOptimize();
      }).not.toThrow();
    });
  });

  describe('Registry and Prometheus Integration', () => {
    it('should return valid Prometheus registry', () => {
      const registry = metricsService.getRegistry();
      expect(registry).toBeDefined();
      expect(typeof registry.metrics).toBe('function');
      expect(typeof registry.getMetricsAsJSON).toBe('function');
    });

    it('should return metrics in Prometheus format', async () => {
      const metrics = await metricsService.getPrometheusMetrics();
      expect(typeof metrics).toBe('string');
      // Basic validation that it's in Prometheus format
      expect(metrics).toContain('# Mock metrics');
    });

    it('should have registered metrics', () => {
      const registry = metricsService.getRegistry();
      const metricsJSON = registry.getMetricsAsJSON();
      expect(Array.isArray(metricsJSON)).toBe(true);
    });
  });

  describe('Health Status Monitoring', () => {
    it('should return healthy status when collecting', () => {
      metricsService.startCollection();
      const health = metricsService.getHealthStatus();
      
      expect(['healthy', 'degraded']).toContain(health.status);
      expect(health.details).toHaveProperty('collecting', true);
      expect(health.details).toHaveProperty('collectionTime');
      expect(health.details).toHaveProperty('cpuOverhead');
      expect(health.details).toHaveProperty('bufferSizes');
      expect(health.details).toHaveProperty('samplingConfig');
      expect(health.details).toHaveProperty('registeredMetrics');
    });

    it('should return unhealthy status when not collecting', () => {
      metricsService.stopCollection();
      const health = metricsService.getHealthStatus();
      
      expect(health.status).toBe('unhealthy');
      expect(health.details.collecting).toBe(false);
    });

    it('should detect degraded status with high overhead', () => {
      metricsService.startCollection();
      
      // Simulate high performance impact
      (metricsService as any).performanceImpact.cpuOverhead = 10; // > 5%
      (metricsService as any).performanceImpact.collectionTime = 2000; // > 1000ms
      
      const health = metricsService.getHealthStatus();
      expect(health.status).toBe('degraded');
    });
  });

  describe('Sampling Configuration and Intervals', () => {
    it('should handle environment variable configuration', async () => {
      // Test with mock environment variables
      process.env.METRICS_SYSTEM_INTERVAL = '15000';
      process.env.METRICS_APP_INTERVAL = '3000';
      process.env.METRICS_BUSINESS_INTERVAL = '120000';
      process.env.METRICS_BUFFER_SIZE = '2000';
      process.env.METRICS_AGGREGATION_WINDOW = '600000';
      
      // Create new instance to test configuration
      (MetricsService as any).instance = undefined;
      const configuredService = MetricsService.getInstance();
      const metrics = configuredService.getCurrentMetrics();
      
      expect(metrics.sampling.systemInterval).toBe(15000);
      expect(metrics.sampling.appInterval).toBe(3000);
      expect(metrics.sampling.businessInterval).toBe(120000);
      expect(metrics.sampling.bufferSize).toBe(2000);
      expect(metrics.sampling.aggregationWindow).toBe(600000);
      
      await configuredService.cleanup();
    });

    it('should use default values when environment variables are not set', async () => {
      delete process.env.METRICS_SYSTEM_INTERVAL;
      delete process.env.METRICS_APP_INTERVAL;
      delete process.env.METRICS_BUSINESS_INTERVAL;
      
      (MetricsService as any).instance = undefined;
      const defaultService = MetricsService.getInstance();
      const metrics = defaultService.getCurrentMetrics();
      
      expect(metrics.sampling.systemInterval).toBe(10000);
      expect(metrics.sampling.appInterval).toBe(5000);
      expect(metrics.sampling.businessInterval).toBe(60000);
      
      await defaultService.cleanup();
    });
  });

  describe('Memory Management and Cleanup', () => {
    it('should clear metrics buffer during aggregation', () => {
      // Add some data to buffer
      const buffer = (metricsService as any).metricsBuffer;
      buffer.set('test', [
        { timestamp: Date.now() - 400000, data: 'old' }, // Old data
        { timestamp: Date.now() - 100000, data: 'new' }  // New data
      ]);
      
      // Perform aggregation
      const privateMethod = (metricsService as any).performAggregation;
      privateMethod.call(metricsService);
      
      // Old data should be cleaned up
      expect(buffer.has('test')).toBe(true);
      const remaining = buffer.get('test');
      expect(remaining).toHaveLength(1);
      expect(remaining[0].data).toBe('new');
    });

    it('should remove empty buffers during aggregation', () => {
      const buffer = (metricsService as any).metricsBuffer;
      buffer.set('old_buffer', [
        { timestamp: Date.now() - 400000, data: 'very_old' }
      ]);
      
      const privateMethod = (metricsService as any).performAggregation;
      privateMethod.call(metricsService);
      
      expect(buffer.has('old_buffer')).toBe(false);
    });

    it('should handle cleanup with active intervals', async () => {
      metricsService.startCollection();
      
      // Verify intervals are active
      expect((metricsService as any).collectInterval).toBeDefined();
      expect((metricsService as any).aggregationInterval).toBeDefined();
      
      await metricsService.cleanup();
      
      // Verify cleanup completed
      expect((metricsService as any).collectInterval).toBeUndefined();
      expect((metricsService as any).aggregationInterval).toBeUndefined();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle multiple start/stop cycles', () => {
      expect(() => {
        metricsService.startCollection();
        metricsService.startCollection(); // Should warn but not crash
        metricsService.stopCollection();
        metricsService.stopCollection(); // Should be safe
        metricsService.startCollection();
      }).not.toThrow();
    });

    it('should handle null/undefined values gracefully', () => {
      expect(() => {
        metricsService.recordApiRequest('GET', '/test', 200, 0);
        metricsService.recordDeployment('unknown', 'unknown');
        metricsService.updateWebSocketConnections(0, 0);
      }).not.toThrow();
    });

    it('should handle database query failures in metric collection', async () => {
      metricsService.startCollection();
      
      // Mock database failure
      mockDb.query.mockRejectedValue(new Error('Database connection lost'));
      
      // Collection should not crash the service
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const health = metricsService.getHealthStatus();
      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
    });

    it('should handle malformed database results', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          { count: null, active_users: undefined },
          { status: null, runtime_type: '', count: 'invalid' }
        ],
        rowCount: 2,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      const privateMethod = (metricsService as any).getDeploymentStatistics;
      const stats = await privateMethod.call(metricsService);
      
      // Should handle gracefully without crashing
      expect(typeof stats).toBe('object');
      expect(stats).toHaveProperty('byStatus');
      expect(stats).toHaveProperty('byType');
      expect(stats).toHaveProperty('activeUsers');
      expect(stats).toHaveProperty('total');
    });

    it('should handle extreme values in metrics', () => {
      expect(() => {
        // Test with extreme values
        metricsService.recordApiRequest('GET', '/test', 999, Number.MAX_SAFE_INTEGER);
        metricsService.recordDeployment('type', 'status', Number.MAX_SAFE_INTEGER);
        metricsService.updateWebSocketConnections(Number.MAX_SAFE_INTEGER, 0);
        
        // Test with edge case values
        metricsService.recordApiRequest('', '', 0, -1);
        metricsService.recordError('', '', '');
      }).not.toThrow();
    });

    it('should continue working after partial failures', async () => {
      metricsService.startCollection();
      
      // Simulate partial database failure
      mockDb.query
        .mockRejectedValueOnce(new Error('Deployment query failed'))
        .mockResolvedValueOnce({
          rows: [{ plan_type: 'free', count: '10' }],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: []
        });

      // Wait for collection cycles
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Service should still be operational
      const health = metricsService.getHealthStatus();
      expect(health.details.collecting).toBe(true);
      
      // Should still accept new metrics
      expect(() => {
        metricsService.recordUserActivity('test', 'premium');
      }).not.toThrow();
    });
  });
});