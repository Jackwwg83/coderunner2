import { OrchestrationService } from '../../src/services/orchestration';

// Mock dependencies at module level
jest.mock('../../src/services/database');
jest.mock('../../src/services/configuration');
jest.mock('agentsphere-js');

describe('OrchestrationService Basic Tests', () => {
  let orchestrationService: OrchestrationService;

  beforeEach(() => {
    jest.clearAllMocks();
    orchestrationService = OrchestrationService.getInstance();
  });

  describe('Service Initialization', () => {
    test('should create singleton instance', () => {
      const instance1 = OrchestrationService.getInstance();
      const instance2 = OrchestrationService.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(OrchestrationService);
    });
  });

  describe('Basic Service Methods', () => {
    test('should return execution statistics', async () => {
      const stats = await orchestrationService.getExecutionStats();
      
      expect(stats).toHaveProperty('totalExecutions');
      expect(stats).toHaveProperty('activeExecutions');
      expect(stats).toHaveProperty('queuedExecutions');
      expect(stats).toHaveProperty('averageExecutionTime');
      
      expect(typeof stats.totalExecutions).toBe('number');
      expect(typeof stats.activeExecutions).toBe('number');
      expect(typeof stats.queuedExecutions).toBe('number');
      expect(typeof stats.averageExecutionTime).toBe('number');
    });

    test('should return execution history', async () => {
      const userId = 'test-user';
      const history = await orchestrationService.getExecutionHistory(userId);
      
      expect(Array.isArray(history)).toBe(true);
    });

    test('should handle cleanup process', async () => {
      await expect(orchestrationService.cleanup()).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    test('should handle handleErrors method', async () => {
      const deploymentId = 'test-deployment-id';
      const error = new Error('Test error');
      const context = {
        stage: 'building' as const,
        retryCount: 0,
        maxRetries: 3
      };

      const result = await orchestrationService.handleErrors(deploymentId, error, context);

      expect(result).toHaveProperty('recovered');
      expect(result).toHaveProperty('action');
      expect(typeof result.recovered).toBe('boolean');
      expect(['retry', 'fallback', 'abort']).toContain(result.action);
    });
  });

  describe('Cleanup Operations', () => {
    test('should handle sandbox cleanup', async () => {
      const result = await orchestrationService.cleanupSandboxes({
        force: true,
        maxAge: 1000,
        maxIdle: 500
      });

      expect(result).toHaveProperty('cleaned');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('details');
      
      expect(typeof result.cleaned).toBe('number');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.details)).toBe(true);
    });
  });
});