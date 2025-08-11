import { MetricsCollector } from '../../src/services/monitoring/metricsCollector';
import { AlertManager } from '../../src/services/monitoring/alertManager';
import { HealthChecker } from '../../src/services/monitoring/healthChecker';

describe('Monitoring System Tests', () => {
  let metricsCollector: MetricsCollector;
  let alertManager: AlertManager;
  let healthChecker: HealthChecker;

  beforeEach(() => {
    metricsCollector = new MetricsCollector();
    alertManager = new AlertManager();
    healthChecker = new HealthChecker();
  });

  afterEach(async () => {
    await metricsCollector.stop();
    await alertManager.stop();
    await healthChecker.stop();
  });

  describe('Metrics Collection', () => {
    test('should collect system performance metrics', async () => {
      const metrics = await metricsCollector.collectSystemMetrics();
      
      expect(metrics).toHaveProperty('cpu_usage');
      expect(metrics).toHaveProperty('memory_usage');
      expect(metrics).toHaveProperty('disk_usage');
      expect(metrics).toHaveProperty('network_io');
      expect(metrics).toHaveProperty('timestamp');
      
      expect(metrics.cpu_usage).toBeGreaterThanOrEqual(0);
      expect(metrics.cpu_usage).toBeLessThanOrEqual(100);
      expect(metrics.memory_usage).toBeGreaterThanOrEqual(0);
      expect(metrics.memory_usage).toBeLessThanOrEqual(100);
    });

    test('should collect application metrics', async () => {
      // Simulate some application activity
      await metricsCollector.recordDeployment('test-project', 'success');
      await metricsCollector.recordDeployment('test-project-2', 'failure');
      await metricsCollector.recordApiCall('/api/projects', 200, 150);
      await metricsCollector.recordApiCall('/api/deploy', 500, 300);
      
      const metrics = await metricsCollector.getApplicationMetrics();
      
      expect(metrics).toHaveProperty('deployment_success_rate');
      expect(metrics).toHaveProperty('deployment_total');
      expect(metrics).toHaveProperty('api_response_time_avg');
      expect(metrics).toHaveProperty('api_error_rate');
      expect(metrics).toHaveProperty('active_deployments');
      
      expect(metrics.deployment_success_rate).toBe(0.5); // 1 success, 1 failure
      expect(metrics.deployment_total).toBe(2);
      expect(metrics.api_response_time_avg).toBe(225); // (150 + 300) / 2
    });

    test('should collect database metrics', async () => {
      const dbMetrics = await metricsCollector.collectDatabaseMetrics();
      
      expect(dbMetrics).toHaveProperty('connection_pool_size');
      expect(dbMetrics).toHaveProperty('active_connections');
      expect(dbMetrics).toHaveProperty('query_response_time_avg');
      expect(dbMetrics).toHaveProperty('slow_queries_count');
      expect(dbMetrics).toHaveProperty('deadlocks_count');
      
      expect(dbMetrics.connection_pool_size).toBeGreaterThan(0);
      expect(dbMetrics.active_connections).toBeGreaterThanOrEqual(0);
      expect(dbMetrics.query_response_time_avg).toBeGreaterThan(0);
    });

    test('should collect WebSocket metrics', async () => {
      // Simulate WebSocket activity
      metricsCollector.recordWebSocketConnection();
      metricsCollector.recordWebSocketConnection();
      metricsCollector.recordWebSocketDisconnection();
      metricsCollector.recordWebSocketMessage('deployment:status');
      metricsCollector.recordWebSocketMessage('project:update');
      
      const wsMetrics = await metricsCollector.getWebSocketMetrics();
      
      expect(wsMetrics).toHaveProperty('active_connections');
      expect(wsMetrics).toHaveProperty('total_connections');
      expect(wsMetrics).toHaveProperty('messages_sent');
      expect(wsMetrics).toHaveProperty('connection_duration_avg');
      
      expect(wsMetrics.active_connections).toBe(1);
      expect(wsMetrics.total_connections).toBe(2);
      expect(wsMetrics.messages_sent).toBe(2);
    });

    test('should export metrics in Prometheus format', async () => {
      await metricsCollector.recordApiCall('/api/test', 200, 100);
      
      const prometheusMetrics = await metricsCollector.exportPrometheusMetrics();
      
      expect(prometheusMetrics).toContain('# HELP api_requests_total Total number of API requests');
      expect(prometheusMetrics).toContain('# TYPE api_requests_total counter');
      expect(prometheusMetrics).toContain('api_requests_total{method="GET",status="200"} 1');
      expect(prometheusMetrics).toContain('# HELP api_response_time_seconds API response time in seconds');
    });
  });

  describe('Health Checks', () => {
    test('should perform comprehensive health checks', async () => {
      const healthStatus = await healthChecker.performHealthCheck();
      
      expect(healthStatus).toHaveProperty('status');
      expect(healthStatus).toHaveProperty('checks');
      expect(healthStatus).toHaveProperty('timestamp');
      
      expect(['healthy', 'degraded', 'unhealthy']).toContain(healthStatus.status);
      
      // Check individual components
      expect(healthStatus.checks).toHaveProperty('database');
      expect(healthStatus.checks).toHaveProperty('agentsphere_api');
      expect(healthStatus.checks).toHaveProperty('websocket_server');
      expect(healthStatus.checks).toHaveProperty('file_system');
      
      Object.values(healthStatus.checks).forEach((check: any) => {
        expect(check).toHaveProperty('status');
        expect(check).toHaveProperty('response_time');
        expect(['healthy', 'unhealthy']).toContain(check.status);
      });
    });

    test('should detect database connectivity issues', async () => {
      // Mock database connection failure
      jest.spyOn(healthChecker, 'checkDatabaseHealth').mockResolvedValue({
        status: 'unhealthy',
        response_time: 5000,
        error: 'Connection timeout'
      });
      
      const healthStatus = await healthChecker.performHealthCheck();
      
      expect(healthStatus.status).toBe('unhealthy');
      expect(healthStatus.checks.database.status).toBe('unhealthy');
      expect(healthStatus.checks.database.error).toBe('Connection timeout');
    });

    test('should detect AgentSphere API issues', async () => {
      // Mock AgentSphere API failure
      jest.spyOn(healthChecker, 'checkAgentSphereHealth').mockResolvedValue({
        status: 'unhealthy',
        response_time: 0,
        error: 'API endpoint unreachable'
      });
      
      const healthStatus = await healthChecker.performHealthCheck();
      
      expect(healthStatus.checks.agentsphere_api.status).toBe('unhealthy');
      expect(healthStatus.checks.agentsphere_api.error).toContain('unreachable');
    });

    test('should monitor resource usage thresholds', async () => {
      const resourceHealth = await healthChecker.checkResourceHealth();
      
      expect(resourceHealth).toHaveProperty('cpu_usage');
      expect(resourceHealth).toHaveProperty('memory_usage');
      expect(resourceHealth).toHaveProperty('disk_usage');
      expect(resourceHealth).toHaveProperty('status');
      
      // Simulate high resource usage
      jest.spyOn(metricsCollector, 'collectSystemMetrics').mockResolvedValue({
        cpu_usage: 95,
        memory_usage: 90,
        disk_usage: 85,
        network_io: { in: 1000, out: 2000 },
        timestamp: new Date()
      });
      
      const highUsageHealth = await healthChecker.checkResourceHealth();
      expect(highUsageHealth.status).toBe('degraded');
    });
  });

  describe('Alerting System', () => {
    test('should trigger alerts for high error rates', async () => {
      const alertsSent: any[] = [];
      jest.spyOn(alertManager, 'sendAlert').mockImplementation(async (alert) => {
        alertsSent.push(alert);
      });
      
      // Simulate high error rate
      for (let i = 0; i < 10; i++) {
        await metricsCollector.recordApiCall('/api/deploy', 500, 1000);
      }
      
      // Trigger alert evaluation
      await alertManager.evaluateAlerts();
      
      expect(alertsSent.length).toBeGreaterThan(0);
      expect(alertsSent[0]).toHaveProperty('severity');
      expect(alertsSent[0]).toHaveProperty('message');
      expect(alertsSent[0].severity).toBe('critical');
      expect(alertsSent[0].message).toContain('High error rate detected');
    });

    test('should trigger alerts for resource exhaustion', async () => {
      const alertsSent: any[] = [];
      jest.spyOn(alertManager, 'sendAlert').mockImplementation(async (alert) => {
        alertsSent.push(alert);
      });
      
      // Mock high resource usage
      jest.spyOn(metricsCollector, 'collectSystemMetrics').mockResolvedValue({
        cpu_usage: 98,
        memory_usage: 95,
        disk_usage: 90,
        network_io: { in: 5000, out: 10000 },
        timestamp: new Date()
      });
      
      await alertManager.evaluateResourceAlerts();
      
      const criticalAlerts = alertsSent.filter(alert => alert.severity === 'critical');
      expect(criticalAlerts.length).toBeGreaterThan(0);
      
      const cpuAlert = alertsSent.find(alert => alert.message.includes('CPU usage'));
      expect(cpuAlert).toBeDefined();
      expect(cpuAlert.severity).toBe('critical');
    });

    test('should implement alert rate limiting', async () => {
      const alertsSent: any[] = [];
      jest.spyOn(alertManager, 'sendAlert').mockImplementation(async (alert) => {
        alertsSent.push(alert);
      });
      
      // Trigger same alert multiple times rapidly
      for (let i = 0; i < 10; i++) {
        await alertManager.triggerAlert({
          type: 'high_cpu_usage',
          severity: 'warning',
          message: 'CPU usage above 80%'
        });
      }
      
      // Should only send alert once due to rate limiting
      expect(alertsSent.length).toBe(1);
      expect(alertsSent[0].message).toContain('CPU usage above 80%');
    });

    test('should escalate alerts after threshold breaches', async () => {
      const alertsSent: any[] = [];
      jest.spyOn(alertManager, 'sendAlert').mockImplementation(async (alert) => {
        alertsSent.push(alert);
      });
      
      // Initial warning
      await alertManager.triggerAlert({
        type: 'deployment_failure_rate',
        severity: 'warning',
        message: 'Deployment failure rate: 20%'
      });
      
      // Wait for escalation time window
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Trigger escalation
      await alertManager.triggerAlert({
        type: 'deployment_failure_rate',
        severity: 'critical',
        message: 'Deployment failure rate: 50%'
      });
      
      expect(alertsSent.length).toBe(2);
      expect(alertsSent[0].severity).toBe('warning');
      expect(alertsSent[1].severity).toBe('critical');
    });
  });

  describe('Auto-scaling Triggers', () => {
    test('should detect scaling triggers based on load', async () => {
      // Simulate high load conditions
      await metricsCollector.recordApiCall('/api/deploy', 200, 500);
      await metricsCollector.recordApiCall('/api/deploy', 200, 600);
      await metricsCollector.recordApiCall('/api/deploy', 200, 700);
      
      const scalingDecision = await metricsCollector.evaluateScalingNeeds();
      
      expect(scalingDecision).toHaveProperty('recommendation');
      expect(scalingDecision).toHaveProperty('current_metrics');
      expect(scalingDecision).toHaveProperty('threshold_breaches');
      
      expect(['scale_up', 'scale_down', 'maintain']).toContain(scalingDecision.recommendation);
      
      if (scalingDecision.recommendation === 'scale_up') {
        expect(scalingDecision.threshold_breaches).toContain('response_time');
      }
    });

    test('should consider historical patterns for scaling', async () => {
      // Simulate consistent high load over time
      const historicalData = [];
      for (let i = 0; i < 10; i++) {
        historicalData.push({
          timestamp: new Date(Date.now() - (i * 60000)),
          active_deployments: 50 + i,
          avg_response_time: 800 + (i * 10),
          cpu_usage: 85 + i,
          memory_usage: 80 + i
        });
      }
      
      const scalingDecision = await metricsCollector.evaluateScalingWithHistory(historicalData);
      
      expect(scalingDecision.confidence).toBeGreaterThan(0.8);
      expect(scalingDecision.recommendation).toBe('scale_up');
      expect(scalingDecision.suggested_instances).toBeGreaterThan(1);
    });
  });

  describe('Performance Testing Integration', () => {
    test('should collect performance metrics during load tests', async () => {
      const loadTestId = 'load-test-' + Date.now();
      
      // Start performance monitoring
      await metricsCollector.startPerformanceTest(loadTestId);
      
      // Simulate load test activity
      for (let i = 0; i < 100; i++) {
        await metricsCollector.recordApiCall('/api/projects', 200, 50 + Math.random() * 100);
        await metricsCollector.recordWebSocketMessage('test:message');
      }
      
      // End performance monitoring
      const testResults = await metricsCollector.endPerformanceTest(loadTestId);
      
      expect(testResults).toHaveProperty('duration');
      expect(testResults).toHaveProperty('requests_per_second');
      expect(testResults).toHaveProperty('avg_response_time');
      expect(testResults).toHaveProperty('error_rate');
      expect(testResults).toHaveProperty('peak_cpu_usage');
      expect(testResults).toHaveProperty('peak_memory_usage');
      
      expect(testResults.requests_per_second).toBeGreaterThan(0);
      expect(testResults.error_rate).toBeGreaterThanOrEqual(0);
      expect(testResults.error_rate).toBeLessThanOrEqual(1);
    });

    test('should detect performance regressions', async () => {
      const baselineResults = {
        avg_response_time: 100,
        requests_per_second: 500,
        error_rate: 0.01
      };
      
      const currentResults = {
        avg_response_time: 200,
        requests_per_second: 300,
        error_rate: 0.05
      };
      
      const regression = await metricsCollector.detectRegression(baselineResults, currentResults);
      
      expect(regression).toHaveProperty('has_regression');
      expect(regression).toHaveProperty('degraded_metrics');
      expect(regression).toHaveProperty('severity');
      
      expect(regression.has_regression).toBe(true);
      expect(regression.degraded_metrics).toContain('avg_response_time');
      expect(regression.degraded_metrics).toContain('requests_per_second');
      expect(regression.degraded_metrics).toContain('error_rate');
      expect(regression.severity).toBe('high');
    });
  });
});