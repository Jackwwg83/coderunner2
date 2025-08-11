import { ResourceOptimizerService, ResourceUsage, CostAnalytics, OptimizationRecommendation } from '../../src/services/resourceOptimizer';
import { DatabaseService } from '../../src/services/database';
import { MetricsService } from '../../src/services/metrics';
import { AutoScalingService } from '../../src/services/autoScaling';
import { WebSocketService } from '../../src/services/websocket';

// Mock dependencies
jest.mock('../../src/services/database');
jest.mock('../../src/services/metrics');
jest.mock('../../src/services/autoScaling');
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

const mockAutoScaling = {
  getScalingStatus: jest.fn()
} as any;

const mockWebsocket = {
  broadcastToDeploymentChannel: jest.fn()
} as any;

describe('ResourceOptimizerService', () => {
  let resourceOptimizer: ResourceOptimizerService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    (DatabaseService.getInstance as jest.Mock).mockReturnValue(mockDb);
    (MetricsService.getInstance as jest.Mock).mockReturnValue(mockMetrics);
    (AutoScalingService.getInstance as jest.Mock).mockReturnValue(mockAutoScaling);
    (WebSocketService.getInstance as jest.Mock).mockReturnValue(mockWebsocket);

    resourceOptimizer = ResourceOptimizerService.getInstance();
  });

  afterEach(async () => {
    await resourceOptimizer.cleanup();
  });

  describe('Resource Usage Tracking', () => {
    beforeEach(() => {
      mockMetrics.getCurrentMetrics.mockReturnValue({
        system: {
          cpu: { usage: 75 },
          memory: { usagePercent: 80 }
        }
      });

      mockAutoScaling.getScalingStatus.mockReturnValue({
        currentInstances: 2
      });
    });

    it('should track resource usage', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await resourceOptimizer.trackResourceUsage('test-deployment');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO resource_usage'),
        expect.arrayContaining([
          'test-deployment',
          75, // CPU usage
          80, // Memory usage
          expect.any(Number), // Network I/O
          expect.any(Number), // Disk I/O
          expect.any(Number), // Cost estimate
          expect.any(Date) // Timestamp
        ])
      );
    });

    it('should store resource usage in memory history', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await resourceOptimizer.trackResourceUsage('test-deployment');

      const usage = resourceOptimizer.getResourceUsage('test-deployment');
      expect(usage).toHaveLength(1);
      expect(usage[0].cpuUsage).toBe(75);
      expect(usage[0].memoryUsage).toBe(80);
    });

    it('should limit memory history to 288 entries', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      // Add 300 entries
      for (let i = 0; i < 300; i++) {
        await resourceOptimizer.trackResourceUsage('test-deployment');
      }

      const usage = resourceOptimizer.getResourceUsage('test-deployment');
      expect(usage).toHaveLength(288);
    });
  });

  describe('Cost Analytics', () => {
    it('should generate cost analytics', async () => {
      const mockUsageData = [
        {
          avg_cpu: '70.5',
          avg_memory: '65.2',
          avg_network: '500000',
          avg_disk: '200000',
          total_cost_per_hour: '2.50',
          data_points: '24'
        }
      ];

      mockDb.query.mockResolvedValueOnce({ rows: mockUsageData });

      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (7 * 24 * 60 * 60 * 1000));
      
      const analytics = await resourceOptimizer.generateCostAnalytics('test-deployment', startDate, endDate);

      expect(analytics).toBeDefined();
      expect(analytics.deploymentId).toBe('test-deployment');
      expect(analytics.utilizationMetrics.avgCpuUsage).toBe(70.5);
      expect(analytics.utilizationMetrics.avgMemoryUsage).toBe(65.2);
      expect(analytics.totalCost).toBeGreaterThan(0);
      expect(analytics.efficiency).toBeGreaterThan(0);
    });

    it('should calculate efficiency score correctly', () => {
      const calculateEfficiency = (resourceOptimizer as any).calculateEfficiency;

      // Perfect efficiency around 75%
      expect(calculateEfficiency({
        avgCpuUsage: 75,
        avgMemoryUsage: 75,
        avgNetworkIO: 0,
        avgDiskIO: 0
      })).toBeCloseTo(1, 1);

      // Low efficiency for very low usage
      expect(calculateEfficiency({
        avgCpuUsage: 10,
        avgMemoryUsage: 15,
        avgNetworkIO: 0,
        avgDiskIO: 0
      })).toBeLessThan(0.5);

      // Lower efficiency for very high usage
      expect(calculateEfficiency({
        avgCpuUsage: 95,
        avgMemoryUsage: 90,
        avgNetworkIO: 0,
        avgDiskIO: 0
      })).toBeLessThan(0.8);
    });

    it('should handle missing cost analytics data', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (7 * 24 * 60 * 60 * 1000));

      await expect(
        resourceOptimizer.generateCostAnalytics('test-deployment', startDate, endDate)
      ).rejects.toThrow('No resource usage data found');
    });
  });

  describe('Cost Calculation', () => {
    it('should calculate hourly cost correctly', () => {
      mockAutoScaling.getScalingStatus.mockReturnValue({
        currentInstances: 3
      });

      const calculateHourlyCost = (resourceOptimizer as any).calculateHourlyCost;
      const cost = calculateHourlyCost('test-deployment', {
        cpuUsage: 75,
        memoryUsage: 80
      });

      expect(cost).toBeGreaterThan(0);
      expect(typeof cost).toBe('number');
    });

    it('should scale cost with instance count', () => {
      const calculateHourlyCost = (resourceOptimizer as any).calculateHourlyCost;

      mockAutoScaling.getScalingStatus.mockReturnValue({
        currentInstances: 1
      });
      const cost1 = calculateHourlyCost('test-deployment', {
        cpuUsage: 75,
        memoryUsage: 80
      });

      mockAutoScaling.getScalingStatus.mockReturnValue({
        currentInstances: 3
      });
      const cost3 = calculateHourlyCost('test-deployment', {
        cpuUsage: 75,
        memoryUsage: 80
      });

      expect(cost3).toBeGreaterThan(cost1);
      expect(cost3 / cost1).toBeCloseTo(3, 1);
    });
  });

  describe('Optimization Recommendations', () => {
    beforeEach(() => {
      // Mock cost analytics data
      const mockAnalytics = {
        deploymentId: 'test-deployment',
        periodStart: new Date(),
        periodEnd: new Date(),
        totalCost: 100,
        utilizationMetrics: {
          avgCpuUsage: 25, // Low CPU usage
          avgMemoryUsage: 35, // Low memory usage
          avgNetworkIO: 0,
          avgDiskIO: 0
        },
        efficiency: 0.4 // Low efficiency
      };

      mockDb.query.mockResolvedValue({ rows: [
        {
          avg_cpu: '25',
          avg_memory: '35',
          avg_network: '0',
          avg_disk: '0',
          total_cost_per_hour: '4.17',
          data_points: '168'
        }
      ]});
    });

    it('should generate CPU downsizing recommendation for low usage', async () => {
      const recommendations = await resourceOptimizer.generateOptimizationRecommendations('test-deployment');

      const cpuRec = recommendations.find(r => r.title.includes('CPU Over-provisioning'));
      expect(cpuRec).toBeDefined();
      expect(cpuRec?.type).toBe('right_sizing');
      expect(cpuRec?.priority).toBe('medium');
      expect(cpuRec?.impact.costSavings).toBeGreaterThan(0);
    });

    it('should generate memory downsizing recommendation for low usage', async () => {
      const recommendations = await resourceOptimizer.generateOptimizationRecommendations('test-deployment');

      const memoryRec = recommendations.find(r => r.title.includes('Memory Over-provisioning'));
      expect(memoryRec).toBeDefined();
      expect(memoryRec?.type).toBe('right_sizing');
      expect(memoryRec?.priority).toBe('medium');
    });

    it('should generate efficiency improvement recommendation', async () => {
      const recommendations = await resourceOptimizer.generateOptimizationRecommendations('test-deployment');

      const efficiencyRec = recommendations.find(r => r.title.includes('Low Resource Efficiency'));
      expect(efficiencyRec).toBeDefined();
      expect(efficiencyRec?.type).toBe('cost_reduction');
      expect(efficiencyRec?.priority).toBe('high');
    });

    it('should generate performance recommendations for high usage', async () => {
      // Override mock for high CPU usage
      mockDb.query.mockResolvedValueOnce({ rows: [
        {
          avg_cpu: '88', // High CPU usage
          avg_memory: '75',
          avg_network: '0',
          avg_disk: '0',
          total_cost_per_hour: '4.17',
          data_points: '168'
        }
      ]});

      const recommendations = await resourceOptimizer.generateOptimizationRecommendations('test-deployment');

      const perfRec = recommendations.find(r => r.title.includes('CPU Bottleneck'));
      expect(perfRec).toBeDefined();
      expect(perfRec?.type).toBe('performance_improvement');
      expect(perfRec?.priority).toBe('high');
    });

    it('should store recommendations in database', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [
          {
            avg_cpu: '25',
            avg_memory: '35',
            avg_network: '0',
            avg_disk: '0',
            total_cost_per_hour: '4.17',
            data_points: '168'
          }
        ]})
        .mockResolvedValue({ rows: [] }); // For INSERT operations

      await resourceOptimizer.generateOptimizationRecommendations('test-deployment');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO optimization_recommendations'),
        expect.arrayContaining([
          expect.any(String), // id
          'test-deployment',
          expect.any(String), // recommendation_type
          expect.any(String), // priority
          expect.any(String), // title
          expect.any(String), // description
          expect.any(String), // impact_data JSON
          expect.any(String), // implementation_data JSON
          expect.any(Date), // created_at
          false // is_implemented
        ])
      );
    });
  });

  describe('Budget Management', () => {
    it('should set budget configuration', async () => {
      const budgetConfig = {
        deploymentId: 'test-deployment',
        monthlyLimit: 500,
        alertThresholds: {
          warning: 75,
          critical: 90
        },
        isEnabled: true
      };

      await resourceOptimizer.setBudgetConfig(budgetConfig);

      // Verify internal state (budget configs are stored in memory)
      const configs = (resourceOptimizer as any).budgetConfigs;
      expect(configs.get('test-deployment')).toEqual(budgetConfig);
    });

    it('should check budget alerts for warning threshold', async () => {
      // Set up budget config
      await resourceOptimizer.setBudgetConfig({
        deploymentId: 'test-deployment',
        monthlyLimit: 100,
        alertThresholds: {
          warning: 75,
          critical: 90
        },
        isEnabled: true
      });

      // Mock spending at 80% of limit
      mockDb.query.mockResolvedValueOnce({ rows: [
        {
          total_spent_per_hour: '3.33', // $80 total if 24 hours
          hours: '24'
        }
      ]});

      const usage: ResourceUsage = {
        deploymentId: 'test-deployment',
        timestamp: new Date(),
        cpuUsage: 50,
        memoryUsage: 60,
        networkIO: 100000,
        diskIO: 50000,
        costEstimate: 3.33
      };

      // Mock the checkBudgetAlerts method by calling trackResourceUsage
      await resourceOptimizer.trackResourceUsage('test-deployment');

      expect(mockWebsocket.broadcastToDeploymentChannel).toHaveBeenCalledWith(
        'test-deployment',
        'budget:alert',
        expect.objectContaining({
          level: expect.any(String),
          percentage: expect.any(Number),
          spent: expect.any(Number),
          limit: 100
        })
      );
    });

    it('should not alert when spending is below thresholds', async () => {
      await resourceOptimizer.setBudgetConfig({
        deploymentId: 'test-deployment',
        monthlyLimit: 100,
        alertThresholds: {
          warning: 75,
          critical: 90
        },
        isEnabled: true
      });

      // Mock low spending (50% of limit)
      mockDb.query.mockResolvedValueOnce({ rows: [
        {
          total_spent_per_hour: '2.08', // $50 total if 24 hours
          hours: '24'
        }
      ]});

      await resourceOptimizer.trackResourceUsage('test-deployment');

      expect(mockWebsocket.broadcastToDeploymentChannel).not.toHaveBeenCalledWith(
        'test-deployment',
        'budget:alert',
        expect.anything()
      );
    });
  });

  describe('Service Lifecycle', () => {
    it('should start and stop optimization analysis', () => {
      resourceOptimizer.startOptimization();
      expect((resourceOptimizer as any).analysisInterval).toBeDefined();

      resourceOptimizer.stopOptimization();
      expect((resourceOptimizer as any).analysisInterval).toBeUndefined();
    });

    it('should cleanup resources properly', async () => {
      resourceOptimizer.startOptimization();

      // Add some test data
      await resourceOptimizer.setBudgetConfig({
        deploymentId: 'test-deployment',
        monthlyLimit: 100,
        alertThresholds: { warning: 75, critical: 90 },
        isEnabled: true
      });

      await resourceOptimizer.cleanup();

      expect((resourceOptimizer as any).analysisInterval).toBeUndefined();
      expect((resourceOptimizer as any).budgetConfigs.size).toBe(0);
      expect((resourceOptimizer as any).resourceUsageHistory.size).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully in cost analytics', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('Database error'));

      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (7 * 24 * 60 * 60 * 1000));

      await expect(
        resourceOptimizer.generateCostAnalytics('test-deployment', startDate, endDate)
      ).rejects.toThrow('Database error');
    });

    it('should handle metrics collection errors', async () => {
      mockMetrics.getCurrentMetrics.mockImplementation(() => {
        throw new Error('Metrics error');
      });

      // Should not throw, but should log error
      await expect(
        resourceOptimizer.trackResourceUsage('test-deployment')
      ).resolves.not.toThrow();
    });

    it('should return empty recommendations on database error', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('Database error'));

      const recommendations = await resourceOptimizer.generateOptimizationRecommendations('test-deployment');

      expect(recommendations).toEqual([]);
    });
  });

  describe('Data Retrieval', () => {
    it('should get resource usage from memory', () => {
      // Add some test usage data
      const usage: ResourceUsage = {
        deploymentId: 'test-deployment',
        timestamp: new Date(),
        cpuUsage: 50,
        memoryUsage: 60,
        networkIO: 100000,
        diskIO: 50000,
        costEstimate: 2.5
      };

      (resourceOptimizer as any).resourceUsageHistory.set('test-deployment', [usage]);

      const retrieved = resourceOptimizer.getResourceUsage('test-deployment');
      expect(retrieved).toHaveLength(1);
      expect(retrieved[0]).toEqual(usage);
    });

    it('should return empty array for unknown deployment', () => {
      const usage = resourceOptimizer.getResourceUsage('unknown-deployment');
      expect(usage).toEqual([]);
    });

    it('should get cached cost analytics', async () => {
      const analytics: CostAnalytics = {
        deploymentId: 'test-deployment',
        periodStart: new Date(),
        periodEnd: new Date(),
        totalCost: 100,
        costBreakdown: {
          compute: 70,
          storage: 15,
          network: 10,
          other: 5
        },
        utilizationMetrics: {
          avgCpuUsage: 50,
          avgMemoryUsage: 60,
          avgNetworkIO: 100000,
          avgDiskIO: 50000
        },
        efficiency: 0.8
      };

      (resourceOptimizer as any).costAnalytics.set('test-deployment', analytics);

      const retrieved = resourceOptimizer.getCostAnalytics('test-deployment');
      expect(retrieved).toEqual(analytics);
    });

    it('should return null for missing cost analytics', () => {
      const analytics = resourceOptimizer.getCostAnalytics('unknown-deployment');
      expect(analytics).toBeNull();
    });
  });
});