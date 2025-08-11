import { AutoScalingService, ScalingMetrics, ScalingPolicy, ScalingDecision } from '../../src/services/autoScaling';
import { DatabaseService } from '../../src/services/database';
import { MetricsService } from '../../src/services/metrics';
import { WebSocketService } from '../../src/services/websocket';

// Mock dependencies
jest.mock('../../src/services/database');
jest.mock('../../src/services/metrics');
jest.mock('../../src/services/websocket');
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

const mockDb = {
  query: jest.fn()
} as any;

const mockMetrics = {
  getCurrentMetrics: jest.fn()
} as any;

const mockWebsocket = {
  broadcastToDeploymentChannel: jest.fn()
} as any;

describe('AutoScalingService', () => {
  let autoScaling: AutoScalingService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    (DatabaseService.getInstance as jest.Mock).mockReturnValue(mockDb);
    (MetricsService.getInstance as jest.Mock).mockReturnValue(mockMetrics);
    (WebSocketService.getInstance as jest.Mock).mockReturnValue(mockWebsocket);

    autoScaling = AutoScalingService.getInstance();
  });

  afterEach(async () => {
    await autoScaling.cleanup();
  });

  describe('Policy Management', () => {
    it('should create a scaling policy', async () => {
      const policyData = {
        deploymentId: 'test-deployment',
        name: 'Test Policy',
        metrics: [
          { metric: 'cpu' as const, threshold: 0.7, comparison: 'gt' as const, weight: 0.5 },
          { metric: 'memory' as const, threshold: 0.8, comparison: 'gt' as const, weight: 0.5 }
        ],
        scaleUpThreshold: 0.7,
        scaleDownThreshold: 0.3,
        cooldownPeriod: 300,
        minInstances: 1,
        maxInstances: 10,
        isEnabled: true
      };

      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const policy = await autoScaling.createScalingPolicy(policyData);

      expect(policy).toBeDefined();
      expect(policy.name).toBe('Test Policy');
      expect(policy.deploymentId).toBe('test-deployment');
      expect(policy.metrics).toHaveLength(2);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO scaling_policies'),
        expect.arrayContaining([
          expect.any(String),
          'test-deployment',
          'Test Policy',
          true,
          'multi_metric',
          expect.any(String),
          expect.any(Date),
          expect.any(Date)
        ])
      );
    });

    it('should load active scaling policies', async () => {
      const mockPolicyRows = [
        {
          id: 'policy-1',
          deployment_id: 'deployment-1',
          name: 'Policy 1',
          is_enabled: true,
          policy_config: JSON.stringify({
            metrics: [{ metric: 'cpu', threshold: 0.7, comparison: 'gt', weight: 0.5 }],
            scaleUpThreshold: 0.7,
            scaleDownThreshold: 0.3,
            cooldownPeriod: 300,
            minInstances: 1,
            maxInstances: 10
          }),
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      mockDb.query.mockResolvedValueOnce({ rows: mockPolicyRows });

      await autoScaling.loadActivePolicies();

      const status = autoScaling.getScalingStatus('deployment-1');
      expect(status.policy).toBeDefined();
      expect(status.policy?.name).toBe('Policy 1');
    });
  });

  describe('Scaling Decisions', () => {
    beforeEach(async () => {
      // Set up a test policy
      const policyData = {
        deploymentId: 'test-deployment',
        name: 'Test Policy',
        metrics: [
          { metric: 'cpu' as const, threshold: 0.7, comparison: 'gt' as const, weight: 0.6 },
          { metric: 'memory' as const, threshold: 0.8, comparison: 'gt' as const, weight: 0.4 }
        ],
        scaleUpThreshold: 0.7,
        scaleDownThreshold: 0.3,
        cooldownPeriod: 300,
        minInstances: 1,
        maxInstances: 10,
        isEnabled: true
      };

      mockDb.query.mockResolvedValueOnce({ rows: [] });
      await autoScaling.createScalingPolicy(policyData);
    });

    it('should decide to scale up when metrics exceed threshold', async () => {
      // Mock high resource usage
      mockMetrics.getCurrentMetrics.mockReturnValue({
        system: {
          cpu: { usage: 85 },
          memory: { usagePercent: 90 }
        }
      });

      const decision = await autoScaling.evaluateDeploymentScaling('test-deployment');

      expect(decision.action).toBe('scale_up');
      expect(decision.confidence).toBeGreaterThan(0);
      expect(decision.targetInstances).toBe(2);
      expect(decision.triggeredMetrics).toContain('cpu');
      expect(decision.triggeredMetrics).toContain('memory');
    });

    it('should decide to scale down when metrics are below threshold', async () => {
      // Set initial instance count to 3
      const status = autoScaling.getScalingStatus('test-deployment');
      // Mock current instance count
      (autoScaling as any).currentInstances.set('test-deployment', 3);

      // Mock low resource usage
      mockMetrics.getCurrentMetrics.mockReturnValue({
        system: {
          cpu: { usage: 20 },
          memory: { usagePercent: 25 }
        }
      });

      const decision = await autoScaling.evaluateDeploymentScaling('test-deployment');

      expect(decision.action).toBe('scale_down');
      expect(decision.targetInstances).toBe(2);
      expect(decision.confidence).toBeGreaterThan(0);
    });

    it('should not scale during cooldown period', async () => {
      // Set cooldown
      (autoScaling as any).cooldownTracker.set('test-deployment', new Date());

      // Mock high resource usage
      mockMetrics.getCurrentMetrics.mockReturnValue({
        system: {
          cpu: { usage: 85 },
          memory: { usagePercent: 90 }
        }
      });

      const decision = await autoScaling.evaluateDeploymentScaling('test-deployment');

      expect(decision.action).toBe('no_change');
      expect(decision.reason).toContain('Cooldown period active');
    });

    it('should respect minimum instance limits', async () => {
      // Set current instances to minimum
      (autoScaling as any).currentInstances.set('test-deployment', 1);

      // Mock very low resource usage
      mockMetrics.getCurrentMetrics.mockReturnValue({
        system: {
          cpu: { usage: 5 },
          memory: { usagePercent: 10 }
        }
      });

      const decision = await autoScaling.evaluateDeploymentScaling('test-deployment');

      expect(decision.targetInstances).toBeGreaterThanOrEqual(1);
    });

    it('should respect maximum instance limits', async () => {
      // Set current instances to maximum
      (autoScaling as any).currentInstances.set('test-deployment', 10);

      // Mock very high resource usage
      mockMetrics.getCurrentMetrics.mockReturnValue({
        system: {
          cpu: { usage: 95 },
          memory: { usagePercent: 95 }
        }
      });

      const decision = await autoScaling.evaluateDeploymentScaling('test-deployment');

      expect(decision.targetInstances).toBeLessThanOrEqual(10);
    });
  });

  describe('Manual Scaling', () => {
    it('should execute manual scaling', async () => {
      const success = await autoScaling.manualScale('test-deployment', 5, 'Load testing');

      expect(success).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO scaling_events'),
        expect.arrayContaining([
          expect.any(String),
          'test-deployment',
          undefined,
          'manual_override',
          1,
          5,
          'Manual scaling: Load testing',
          expect.any(String),
          expect.any(Date)
        ])
      );
    });

    it('should not scale to same instance count', async () => {
      const success = await autoScaling.manualScale('test-deployment', 1, 'Same count');

      expect(success).toBe(true);
      expect(mockDb.query).not.toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO scaling_events'),
        expect.anything()
      );
    });
  });

  describe('Scaling History', () => {
    it('should retrieve scaling history', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          deployment_id: 'test-deployment',
          policy_id: 'policy-1',
          event_type: 'scale_up',
          from_instances: 1,
          to_instances: 2,
          reason: 'High CPU usage',
          metrics_snapshot: '{}',
          created_at: new Date()
        }
      ];

      mockDb.query.mockResolvedValueOnce({ rows: mockEvents });

      const history = await autoScaling.getScalingHistory('test-deployment');

      expect(history).toHaveLength(1);
      expect(history[0].eventType).toBe('scale_up');
      expect(history[0].fromInstances).toBe(1);
      expect(history[0].toInstances).toBe(2);
    });
  });

  describe('Policy Templates', () => {
    it('should create conservative policy template', () => {
      const template = AutoScalingService.createPolicyTemplate('conservative');

      expect(template.scaleUpThreshold).toBe(0.8);
      expect(template.scaleDownThreshold).toBe(0.2);
      expect(template.cooldownPeriod).toBe(600);
      expect(template.maxInstances).toBe(5);
      expect(template.metrics).toHaveLength(3);
    });

    it('should create aggressive policy template', () => {
      const template = AutoScalingService.createPolicyTemplate('aggressive');

      expect(template.scaleUpThreshold).toBe(0.6);
      expect(template.scaleDownThreshold).toBe(0.4);
      expect(template.cooldownPeriod).toBe(120);
      expect(template.maxInstances).toBe(20);
      expect(template.metrics).toHaveLength(4);
    });

    it('should create cost-optimized policy template', () => {
      const template = AutoScalingService.createPolicyTemplate('cost_optimized');

      expect(template.scaleUpThreshold).toBe(0.85);
      expect(template.scaleDownThreshold).toBe(0.15);
      expect(template.cooldownPeriod).toBe(900);
      expect(template.maxInstances).toBe(3);
    });

    it('should create performance policy template', () => {
      const template = AutoScalingService.createPolicyTemplate('performance');

      expect(template.scaleUpThreshold).toBe(0.5);
      expect(template.scaleDownThreshold).toBe(0.3);
      expect(template.cooldownPeriod).toBe(180);
      expect(template.maxInstances).toBe(25);
      expect(template.metrics.some(m => m.metric === 'response_time')).toBe(true);
    });

    it('should create balanced policy template', () => {
      const template = AutoScalingService.createPolicyTemplate('balanced');

      expect(template.scaleUpThreshold).toBe(0.7);
      expect(template.scaleDownThreshold).toBe(0.3);
      expect(template.cooldownPeriod).toBe(300);
      expect(template.maxInstances).toBe(10);
      expect(template.metrics).toHaveLength(4);
    });
  });

  describe('Metric Calculation', () => {
    it('should calculate weighted scaling score correctly', () => {
      const metrics: ScalingMetrics = {
        cpuUsage: 80,
        memoryUsage: 75,
        requestRate: 100,
        responseTime: 500,
        errorRate: 2,
        timestamp: new Date()
      };

      const policy = {
        metrics: [
          { metric: 'cpu' as const, threshold: 0.7, comparison: 'gt' as const, weight: 0.5 },
          { metric: 'memory' as const, threshold: 0.7, comparison: 'gt' as const, weight: 0.3 },
          { metric: 'response_time' as const, threshold: 0.4, comparison: 'gt' as const, weight: 0.2 }
        ]
      } as ScalingPolicy;

      // Use private method through any cast for testing
      const result = (autoScaling as any).calculateScalingScore(metrics, policy);

      expect(result.score).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.triggeredMetrics).toContain('cpu');
      expect(result.triggeredMetrics).toContain('memory');
    });

    it('should normalize metric values correctly', () => {
      const normalizeMetricValue = (autoScaling as any).normalizeMetricValue;

      expect(normalizeMetricValue('cpu', 80)).toBeCloseTo(0.8);
      expect(normalizeMetricValue('memory', 90)).toBeCloseTo(0.9);
      expect(normalizeMetricValue('error_rate', 5)).toBeCloseTo(0.5);
      expect(normalizeMetricValue('response_time', 2500)).toBeCloseTo(0.5);
      expect(normalizeMetricValue('requests', 500)).toBeCloseTo(0.5);
    });

    it('should evaluate thresholds correctly', () => {
      const evaluateThreshold = (autoScaling as any).evaluateThreshold;

      expect(evaluateThreshold(0.8, { threshold: 0.7, comparison: 'gt' })).toBe(true);
      expect(evaluateThreshold(0.6, { threshold: 0.7, comparison: 'gt' })).toBe(false);
      expect(evaluateThreshold(0.8, { threshold: 0.8, comparison: 'gte' })).toBe(true);
      expect(evaluateThreshold(0.6, { threshold: 0.7, comparison: 'lt' })).toBe(true);
      expect(evaluateThreshold(0.6, { threshold: 0.6, comparison: 'lte' })).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('Database error'));

      const policy = await autoScaling.getScalingPolicy('test-deployment');

      expect(policy).toBeNull();
    });

    it('should handle metrics collection errors', async () => {
      mockMetrics.getCurrentMetrics.mockImplementation(() => {
        throw new Error('Metrics error');
      });

      const decision = await autoScaling.evaluateDeploymentScaling('test-deployment');

      expect(decision.action).toBe('no_change');
      expect(decision.reason).toContain('Unable to collect metrics');
    });

    it('should handle scaling execution failures', async () => {
      // Mock AgentSphere failure by overriding the mock method
      (autoScaling as any).mockAgentSphereScaling = jest.fn().mockResolvedValue(false);

      const success = await autoScaling.manualScale('test-deployment', 5, 'Test scaling');

      expect(success).toBe(false);
    });
  });

  describe('Service Lifecycle', () => {
    it('should start and stop evaluation', () => {
      autoScaling.startEvaluation();
      expect((autoScaling as any).evaluationInterval).toBeDefined();

      autoScaling.stopEvaluation();
      expect((autoScaling as any).evaluationInterval).toBeUndefined();
    });

    it('should cleanup resources properly', async () => {
      autoScaling.startEvaluation();
      await autoScaling.cleanup();

      expect((autoScaling as any).evaluationInterval).toBeUndefined();
      expect((autoScaling as any).activePolicies.size).toBe(0);
      expect((autoScaling as any).cooldownTracker.size).toBe(0);
    });
  });
});