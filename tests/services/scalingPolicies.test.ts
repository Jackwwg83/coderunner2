import { ScalingPolicyService } from '../../src/services/scalingPolicies';
import { DatabaseService } from '../../src/services/database';
import { MetricsService } from '../../src/services/metrics';
import { 
  ScalingPolicy, 
  ScalingPolicyType, 
  ScalingMetricType, 
  DeploymentMetrics,
  ScalingDecision 
} from '../../src/types/autoScaling';

// Mock dependencies
jest.mock('../../src/services/database');
jest.mock('../../src/services/metrics');

describe('ScalingPolicyService', () => {
  let scalingService: ScalingPolicyService;
  let mockDb: jest.Mocked<DatabaseService>;
  let mockMetrics: jest.Mocked<MetricsService>;

  const testDeploymentId = 'test-deployment-id';
  const testUserId = 'test-user-id';

  const mockPolicy: ScalingPolicy = {
    id: 'policy-1',
    deployment_id: testDeploymentId,
    name: 'Test Auto Scaling Policy',
    policy_type: ScalingPolicyType.TARGET_TRACKING,
    target_metric: ScalingMetricType.CPU_UTILIZATION,
    target_value: 75,
    min_instances: 1,
    max_instances: 5,
    scale_up_cooldown: 300000,
    scale_down_cooldown: 300000,
    enabled: true,
    created_at: new Date(),
    updated_at: new Date()
  };

  const mockMetrics: DeploymentMetrics = {
    deployment_id: testDeploymentId,
    timestamp: new Date(),
    cpu_utilization: 85.5,
    memory_utilization: 65.2,
    request_rate: 150.3,
    response_time: 250.7,
    error_rate: 2.1,
    active_connections: 125
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock DatabaseService
    mockDb = {
      getInstance: jest.fn(),
      query: jest.fn(),
      createScalingPolicy: jest.fn(),
      updateScalingPolicy: jest.fn(),
      deleteScalingPolicy: jest.fn(),
      getScalingPoliciesByDeployment: jest.fn(),
      getScalingPolicyById: jest.fn(),
    } as any;

    (DatabaseService.getInstance as jest.Mock).mockReturnValue(mockDb);

    // Mock MetricsService
    mockMetrics = {
      getInstance: jest.fn(),
      getLatestMetrics: jest.fn(),
      getHistoricalMetrics: jest.fn(),
    } as any;

    (MetricsService.getInstance as jest.Mock).mockReturnValue(mockMetrics);

    scalingService = ScalingPolicyService.getInstance();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Policy Management', () => {
    test('should create scaling policy successfully', async () => {
      const policyInput = {
        deployment_id: testDeploymentId,
        name: 'Test Policy',
        policy_type: ScalingPolicyType.TARGET_TRACKING,
        target_metric: ScalingMetricType.CPU_UTILIZATION,
        target_value: 70,
        min_instances: 1,
        max_instances: 3
      };

      mockDb.createScalingPolicy.mockResolvedValue(mockPolicy);

      const result = await scalingService.createPolicy(policyInput);

      expect(result).toEqual(mockPolicy);
      expect(mockDb.createScalingPolicy).toHaveBeenCalledWith(policyInput);
    });

    test('should get policies for deployment', async () => {
      const policies = [mockPolicy];
      mockDb.getScalingPoliciesByDeployment.mockResolvedValue(policies);

      const result = await scalingService.getPoliciesForDeployment(testDeploymentId);

      expect(result).toEqual(policies);
      expect(mockDb.getScalingPoliciesByDeployment).toHaveBeenCalledWith(testDeploymentId);
    });

    test('should update policy successfully', async () => {
      const updates = { target_value: 80, enabled: false };
      const updatedPolicy = { ...mockPolicy, ...updates };

      mockDb.updateScalingPolicy.mockResolvedValue(updatedPolicy);

      const result = await scalingService.updatePolicy(mockPolicy.id, updates);

      expect(result).toEqual(updatedPolicy);
      expect(mockDb.updateScalingPolicy).toHaveBeenCalledWith(mockPolicy.id, updates);
    });

    test('should delete policy successfully', async () => {
      mockDb.deleteScalingPolicy.mockResolvedValue(true);

      const result = await scalingService.deletePolicy(mockPolicy.id);

      expect(result).toBe(true);
      expect(mockDb.deleteScalingPolicy).toHaveBeenCalledWith(mockPolicy.id);
    });
  });

  describe('Scaling Decision Making', () => {
    test('should make scale up decision when CPU exceeds target', async () => {
      const highCpuMetrics = { ...mockMetrics, cpu_utilization: 90 };
      
      mockDb.getScalingPoliciesByDeployment.mockResolvedValue([mockPolicy]);
      mockMetrics.getLatestMetrics.mockResolvedValue(highCpuMetrics);
      mockDb.query.mockResolvedValue({ rows: [] }); // No recent scaling events

      const decision = await scalingService.evaluateScaling(testDeploymentId);

      expect(decision).toMatchObject({
        deployment_id: testDeploymentId,
        action: 'scale_up',
        trigger_reason: expect.stringContaining('CPU utilization'),
        current_value: 90,
        target_value: 75
      });
    });

    test('should make scale down decision when CPU is below target', async () => {
      const lowCpuMetrics = { ...mockMetrics, cpu_utilization: 50 };
      
      mockDb.getScalingPoliciesByDeployment.mockResolvedValue([mockPolicy]);
      mockMetrics.getLatestMetrics.mockResolvedValue(lowCpuMetrics);
      mockDb.query.mockResolvedValue({ rows: [] }); // No recent scaling events

      const decision = await scalingService.evaluateScaling(testDeploymentId);

      expect(decision).toMatchObject({
        deployment_id: testDeploymentId,
        action: 'scale_down',
        trigger_reason: expect.stringContaining('CPU utilization'),
        current_value: 50,
        target_value: 75
      });
    });

    test('should not scale during cooldown period', async () => {
      const highCpuMetrics = { ...mockMetrics, cpu_utilization: 90 };
      const recentScalingEvent = {
        rows: [{ 
          action: 'scale_up', 
          created_at: new Date(Date.now() - 60000) // 1 minute ago
        }]
      };

      mockDb.getScalingPoliciesByDeployment.mockResolvedValue([mockPolicy]);
      mockMetrics.getLatestMetrics.mockResolvedValue(highCpuMetrics);
      mockDb.query.mockResolvedValue(recentScalingEvent);

      const decision = await scalingService.evaluateScaling(testDeploymentId);

      expect(decision).toMatchObject({
        deployment_id: testDeploymentId,
        action: 'no_action',
        trigger_reason: expect.stringContaining('cooldown')
      });
    });

    test('should handle memory-based scaling policy', async () => {
      const memoryPolicy = {
        ...mockPolicy,
        target_metric: ScalingMetricType.MEMORY_UTILIZATION,
        target_value: 80
      };

      const highMemoryMetrics = { ...mockMetrics, memory_utilization: 90 };
      
      mockDb.getScalingPoliciesByDeployment.mockResolvedValue([memoryPolicy]);
      mockMetrics.getLatestMetrics.mockResolvedValue(highMemoryMetrics);
      mockDb.query.mockResolvedValue({ rows: [] });

      const decision = await scalingService.evaluateScaling(testDeploymentId);

      expect(decision).toMatchObject({
        deployment_id: testDeploymentId,
        action: 'scale_up',
        trigger_reason: expect.stringContaining('Memory utilization'),
        current_value: 90,
        target_value: 80
      });
    });
  });

  describe('Policy Validation', () => {
    test('should validate policy configuration', async () => {
      const validPolicy = {
        deployment_id: testDeploymentId,
        name: 'Valid Policy',
        policy_type: ScalingPolicyType.TARGET_TRACKING,
        target_metric: ScalingMetricType.CPU_UTILIZATION,
        target_value: 70,
        min_instances: 1,
        max_instances: 5
      };

      const result = await scalingService.validatePolicy(validPolicy);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect invalid policy configuration', async () => {
      const invalidPolicy = {
        deployment_id: testDeploymentId,
        name: '',
        policy_type: ScalingPolicyType.TARGET_TRACKING,
        target_metric: ScalingMetricType.CPU_UTILIZATION,
        target_value: 150, // Invalid: over 100%
        min_instances: 5,
        max_instances: 2 // Invalid: min > max
      };

      const result = await scalingService.validatePolicy(invalidPolicy);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContain(expect.stringMatching(/name.*required/i));
      expect(result.errors).toContain(expect.stringMatching(/target.*100/i));
      expect(result.errors).toContain(expect.stringMatching(/min.*max/i));
    });
  });

  describe('Scaling History', () => {
    test('should get scaling history for deployment', async () => {
      const mockHistory = [
        {
          id: '1',
          deployment_id: testDeploymentId,
          action: 'scale_up',
          from_instances: 1,
          to_instances: 2,
          trigger_reason: 'CPU utilization exceeded 75%',
          created_at: new Date()
        }
      ];

      mockDb.query.mockResolvedValue({ rows: mockHistory });

      const result = await scalingService.getScalingHistory(testDeploymentId);

      expect(result).toEqual(mockHistory);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('scaling_events'),
        [testDeploymentId]
      );
    });

    test('should record scaling decision', async () => {
      const decision: ScalingDecision = {
        deployment_id: testDeploymentId,
        policy_id: mockPolicy.id,
        action: 'scale_up',
        current_instances: 1,
        target_instances: 2,
        trigger_reason: 'CPU utilization: 90% > 75%',
        current_value: 90,
        target_value: 75,
        timestamp: new Date()
      };

      mockDb.query.mockResolvedValue({ rows: [{ id: 'event-1' }] });

      await scalingService.recordScalingDecision(decision);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO scaling_events'),
        expect.arrayContaining([
          testDeploymentId,
          mockPolicy.id,
          'scale_up',
          1,
          2,
          'CPU utilization: 90% > 75%'
        ])
      );
    });
  });

  describe('Service Lifecycle', () => {
    test('should start monitoring successfully', async () => {
      const result = await scalingService.startMonitoring();
      expect(result).toBe(true);
    });

    test('should stop monitoring successfully', async () => {
      const result = await scalingService.stopMonitoring();
      expect(result).toBe(true);
    });

    test('should get service status', () => {
      const status = scalingService.getStatus();
      
      expect(status).toMatchObject({
        isRunning: expect.any(Boolean),
        lastEvaluation: expect.any(Date),
        activeDeployments: expect.any(Number),
        activePolicies: expect.any(Number)
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle missing metrics gracefully', async () => {
      mockDb.getScalingPoliciesByDeployment.mockResolvedValue([mockPolicy]);
      mockMetrics.getLatestMetrics.mockResolvedValue(null);

      const decision = await scalingService.evaluateScaling(testDeploymentId);

      expect(decision).toMatchObject({
        deployment_id: testDeploymentId,
        action: 'no_action',
        trigger_reason: expect.stringContaining('metrics not available')
      });
    });

    test('should handle database errors during evaluation', async () => {
      mockDb.getScalingPoliciesByDeployment.mockRejectedValue(new Error('Database connection failed'));

      await expect(scalingService.evaluateScaling(testDeploymentId))
        .rejects.toThrow('Database connection failed');
    });

    test('should handle disabled policies', async () => {
      const disabledPolicy = { ...mockPolicy, enabled: false };
      
      mockDb.getScalingPoliciesByDeployment.mockResolvedValue([disabledPolicy]);
      mockMetrics.getLatestMetrics.mockResolvedValue(mockMetrics);

      const decision = await scalingService.evaluateScaling(testDeploymentId);

      expect(decision).toMatchObject({
        deployment_id: testDeploymentId,
        action: 'no_action',
        trigger_reason: expect.stringContaining('No enabled')
      });
    });
  });
});