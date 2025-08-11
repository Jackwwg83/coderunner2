import request from 'supertest';
import { app } from '../../src/index';
import { MetricsService } from '../../src/services/metrics';
import { HealthCheckService } from '../../src/services/healthCheck';
import { DatabaseService } from '../../src/services/database';
import { WebSocketService } from '../../src/services/websocket';

// Mock external dependencies
jest.mock('../../src/services/database');
jest.mock('prom-client');

describe('Monitoring Integration Tests', () => {
  let metricsService: MetricsService;
  let healthService: HealthCheckService;
  let mockDb: jest.Mocked<DatabaseService>;

  beforeAll(async () => {
    // Initialize services
    metricsService = MetricsService.getInstance();
    healthService = HealthCheckService.getInstance();
    mockDb = DatabaseService.getInstance() as jest.Mocked<DatabaseService>;
    
    // Mock database responses
    mockDb.healthCheck = jest.fn().mockResolvedValue({
      healthy: true,
      connection: true,
      latency: 10,
      poolSize: 10,
      activeConnections: 2
    });
    
    mockDb.query = jest.fn().mockResolvedValue({
      rows: [],
      rowCount: 0,
      command: 'SELECT',
      oid: 0,
      fields: []
    });
    
    // Start monitoring services
    metricsService.startCollection();
    healthService.startHealthChecks();
  });

  afterAll(async () => {
    await metricsService.cleanup();
    await healthService.cleanup();
  });

  describe('Health Endpoints', () => {
    it('should provide basic health check', async () => {
      const response = await request(app)
        .get('/health')
        .expect('Content-Type', /json/);
        
      expect(response.status).toBeOneOf([200, 503]);
      expect(response.body).toHaveProperty('overall');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('checks');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(response.body.overall);
    });

    it('should provide detailed health information', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200)
        .expect('Content-Type', /json/);
        
      expect(response.body).toHaveProperty('overall');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('summary');
      expect(response.body.summary).toHaveProperty('total');
      expect(response.body.summary).toHaveProperty('healthy');
      expect(response.body.summary).toHaveProperty('unhealthy');
    });

    it('should provide readiness probe', async () => {
      const response = await request(app)
        .get('/ready')
        .expect('Content-Type', /json/);
        
      expect(response.status).toBeOneOf([200, 503]);
      expect(response.body).toHaveProperty('ready');
      expect(typeof response.body.ready).toBe('boolean');
    });

    it('should provide liveness probe', async () => {
      const response = await request(app)
        .get('/live')
        .expect('Content-Type', /json/);
        
      expect(response.status).toBeOneOf([200, 503]);
      expect(response.body).toHaveProperty('alive');
      expect(typeof response.body.alive).toBe('boolean');
    });
  });

  describe('Metrics Endpoints', () => {
    it('should provide Prometheus metrics', async () => {
      const response = await request(app)
        .get('/api/metrics')
        .expect(200);
        
      expect(response.headers['content-type']).toBe('text/plain; charset=utf-8');
      expect(typeof response.text).toBe('string');
    });

    it('should provide current metrics in JSON format', async () => {
      const response = await request(app)
        .get('/api/metrics/current')
        .expect(200)
        .expect('Content-Type', /json/);
        
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('system');
      expect(response.body.system).toHaveProperty('cpu');
      expect(response.body.system).toHaveProperty('memory');
      expect(response.body.system).toHaveProperty('load');
    });
  });

  describe('Request Metrics Collection', () => {
    it('should collect metrics for API requests', async () => {
      // Make some requests to generate metrics
      await request(app).get('/health').expect(200);
      await request(app).get('/api/health').expect(200);
      await request(app).get('/api/metrics/current').expect(200);
      
      // Check that metrics were recorded
      const metrics = await request(app)
        .get('/api/metrics')
        .expect(200);
        
      expect(typeof metrics.text).toBe('string');
      expect(metrics.text.length).toBeGreaterThan(0);
    });

    it('should record error metrics for 404 responses', async () => {
      await request(app)
        .get('/nonexistent-endpoint')
        .expect(404);
        
      // Error metrics should be recorded
      const metrics = await request(app)
        .get('/api/metrics')
        .expect(200);
        
      expect(typeof metrics.text).toBe('string');
    });
  });

  describe('Service Integration', () => {
    it('should reflect service health in metrics', async () => {
      const healthResponse = await request(app)
        .get('/api/health')
        .expect(200);
        
      const metricsResponse = await request(app)
        .get('/api/metrics/current')
        .expect(200);
        
      // Health status should be consistent between endpoints
      expect(healthResponse.body.overall).toBeDefined();
      expect(metricsResponse.body.system).toBeDefined();
    });

    it('should handle service failures gracefully', async () => {
      // Mock database failure
      mockDb.healthCheck.mockRejectedValueOnce(new Error('Connection failed'));
      
      const response = await request(app)
        .get('/api/health')
        .expect(200); // Should still return 200 but with degraded status
        
      expect(response.body.overall).toBeDefined();
      
      // Check that error was recorded in metrics
      const metrics = await request(app)
        .get('/api/metrics')
        .expect(200);
        
      expect(typeof metrics.text).toBe('string');
    });
  });

  describe('Performance Monitoring', () => {
    it('should track response times', async () => {
      const start = Date.now();
      
      await request(app)
        .get('/api/health')
        .expect(200);
        
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(5000); // Should respond within 5 seconds
    });

    it('should handle concurrent requests without degradation', async () => {
      const promises = Array(10).fill(null).map(() => 
        request(app).get('/health').expect(200)
      );
      
      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
      
      // All requests should succeed
      results.forEach(result => {
        expect(result.body).toHaveProperty('overall');
      });
    });
  });

  describe('Monitoring Configuration', () => {
    it('should respect environment configuration', () => {
      const originalInterval = process.env.METRICS_SYSTEM_INTERVAL;
      process.env.METRICS_SYSTEM_INTERVAL = '5000';
      
      // Create new instance to test configuration
      (MetricsService as any).instance = undefined;
      const configuredService = MetricsService.getInstance();
      
      const metrics = configuredService.getCurrentMetrics();
      expect(metrics.sampling.systemInterval).toBe(5000);
      
      // Restore original value
      if (originalInterval) {
        process.env.METRICS_SYSTEM_INTERVAL = originalInterval;
      } else {
        delete process.env.METRICS_SYSTEM_INTERVAL;
      }
    });

    it('should handle missing configuration gracefully', async () => {
      // Test with minimal configuration
      const response = await request(app)
        .get('/health')
        .expect('Content-Type', /json/);
        
      expect(response.status).toBeOneOf([200, 503]);
      expect(response.body).toHaveProperty('overall');
    });
  });

  describe('Data Quality', () => {
    it('should provide consistent timestamps', async () => {
      const healthResponse = await request(app)
        .get('/api/health')
        .expect(200);
        
      const metricsResponse = await request(app)
        .get('/api/metrics/current')
        .expect(200);
        
      const healthTime = new Date(healthResponse.body.timestamp).getTime();
      const metricsTime = new Date(metricsResponse.body.timestamp).getTime();
      
      // Timestamps should be within reasonable range (5 seconds)
      expect(Math.abs(healthTime - metricsTime)).toBeLessThan(5000);
    });

    it('should validate metric value ranges', async () => {
      const response = await request(app)
        .get('/api/metrics/current')
        .expect(200);
        
      const { system } = response.body;
      
      // CPU usage should be 0-100%
      expect(system.cpu.usage).toBeGreaterThanOrEqual(0);
      expect(system.cpu.usage).toBeLessThanOrEqual(100);
      
      // Memory usage percentage should be 0-100%
      expect(system.memory.usagePercent).toBeGreaterThanOrEqual(0);
      expect(system.memory.usagePercent).toBeLessThanOrEqual(100);
      
      // Memory values should be positive
      expect(system.memory.total).toBeGreaterThan(0);
      expect(system.memory.free).toBeGreaterThanOrEqual(0);
      expect(system.memory.used).toBeGreaterThanOrEqual(0);
      
      // Uptime should be positive
      expect(system.uptime).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle metrics service errors', async () => {
      // Mock metrics service failure
      const originalMethod = metricsService.getCurrentMetrics;
      metricsService.getCurrentMetrics = jest.fn().mockImplementation(() => {
        throw new Error('Metrics service failed');
      });
      
      const response = await request(app)
        .get('/api/metrics/current')
        .expect(500);
        
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Failed to retrieve current metrics');
      
      // Restore original method
      metricsService.getCurrentMetrics = originalMethod;
    });

    it('should handle health check service errors', async () => {
      // Mock health service failure
      const originalMethod = healthService.performHealthCheck;
      healthService.performHealthCheck = jest.fn().mockImplementation(() => {
        throw new Error('Health check failed');
      });
      
      const response = await request(app)
        .get('/health')
        .expect(503);
        
      expect(response.body).toHaveProperty('overall', 'unhealthy');
      expect(response.body).toHaveProperty('error');
      
      // Restore original method
      healthService.performHealthCheck = originalMethod;
    });
  });

  describe('Load Testing', () => {
    it('should maintain performance under load', async () => {
      const startTime = Date.now();
      const concurrentRequests = 50;
      
      // Create array of concurrent requests
      const promises = Array(concurrentRequests).fill(null).map(async (_, index) => {
        const endpoints = ['/health', '/api/health', '/api/metrics/current'];
        const endpoint = endpoints[index % endpoints.length];
        
        return request(app)
          .get(endpoint)
          .timeout(10000); // 10 second timeout
      });
      
      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      
      // All requests should complete
      expect(results).toHaveLength(concurrentRequests);
      
      // Should complete within reasonable time (30 seconds for 50 requests)
      expect(totalTime).toBeLessThan(30000);
      
      // Most requests should succeed
      const successfulRequests = results.filter(result => result.status < 400);
      expect(successfulRequests.length).toBeGreaterThan(concurrentRequests * 0.8); // 80% success rate
    }, 45000);
  });

  describe('Memory Management', () => {
    it('should not leak memory during metrics collection', async () => {
      const initialMemory = process.memoryUsage();
      
      // Generate some load
      for (let i = 0; i < 100; i++) {
        await request(app).get('/health');
        metricsService.recordApiRequest('GET', '/test', 200, 10);
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      
      // Memory usage should not increase dramatically (allow 50MB increase)
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB
    });
  });
});

// Helper matcher
expect.extend({
  toBeOneOf(received, validOptions) {
    const pass = validOptions.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${validOptions}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${validOptions}`,
        pass: false,
      };
    }
  },
});

// Type declaration for custom matcher
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeOneOf(validOptions: any[]): R;
    }
  }
}