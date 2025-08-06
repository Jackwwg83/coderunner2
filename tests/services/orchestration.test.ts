import { OrchestrationService } from '../../src/services/orchestration';
import { ExecutionRequest, ExecutionStatus } from '../../src/types';

/**
 * OrchestrationService Unit Tests
 * 
 * Tests basic functionality of the OrchestrationService class.
 * Since this is currently a mock implementation, tests focus on:
 * - Method signatures and return types
 * - Queue management operations
 * - Mock execution workflow
 * - Basic state management
 */

describe('OrchestrationService', () => {
  let orchestrationService: OrchestrationService;
  let consoleSpy: jest.SpyInstance;

  beforeAll(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';
  });

  beforeEach(() => {
    // Mock console.log to avoid test output pollution
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    // Get OrchestrationService instance
    orchestrationService = OrchestrationService.getInstance();
    
    // Clean up any existing state
    orchestrationService.cleanup();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('Initialization', () => {
    it('should be a singleton', () => {
      const instance1 = OrchestrationService.getInstance();
      const instance2 = OrchestrationService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should log initialization message', () => {
      // Reset singleton to force re-creation
      (OrchestrationService as any).instance = null;
      
      OrchestrationService.getInstance();
      
      expect(consoleSpy).toHaveBeenCalledWith('OrchestrationService initialized');
    });
  });

  describe('submitExecution()', () => {
    const validExecutionRequest: ExecutionRequest = {
      userId: 'user_123',
      projectId: 'proj_456',
      files: [
        { path: 'index.js', content: 'console.log("Hello World");' }
      ],
      entryPoint: 'index.js',
      environment: 'node'
    };

    it('should submit execution request and return execution ID', async () => {
      const executionId = await orchestrationService.submitExecution(validExecutionRequest);
      
      expect(executionId).toBeDefined();
      expect(executionId).toMatch(/^exec_\d+_[a-z0-9]{9}$/);
      expect(typeof executionId).toBe('string');
    });

    it('should log execution submission', async () => {
      const executionId = await orchestrationService.submitExecution(validExecutionRequest);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        `Execution request submitted with ID: ${executionId}`
      );
    });

    it('should generate unique execution IDs', async () => {
      const id1 = await orchestrationService.submitExecution(validExecutionRequest);
      const id2 = await orchestrationService.submitExecution(validExecutionRequest);
      const id3 = await orchestrationService.submitExecution(validExecutionRequest);
      
      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });

    it('should handle different execution requests', async () => {
      const requests = [
        { 
          ...validExecutionRequest, 
          files: [{ path: 'script.py', content: 'print("Python code")' }],
          entryPoint: 'script.py',
          environment: 'python' 
        },
        { 
          ...validExecutionRequest, 
          files: [{ path: 'Main.java', content: 'System.out.println("Java code");' }],
          entryPoint: 'Main.java',
          environment: 'java' 
        },
        { 
          ...validExecutionRequest, 
          files: [{ path: 'script.rb', content: 'puts "Ruby code"' }],
          entryPoint: 'script.rb',
          environment: 'ruby' 
        }
      ];
      
      const executionIds = [];
      for (const request of requests) {
        const id = await orchestrationService.submitExecution(request);
        executionIds.push(id);
      }
      
      // All should be unique
      expect(new Set(executionIds).size).toBe(requests.length);
    });

    it('should handle execution request with optional fields', async () => {
      const minimalRequest: ExecutionRequest = {
        userId: 'user_123',
        projectId: 'proj_456',
        files: [
          { path: 'test.js', content: 'console.log("test");' }
        ]
      };
      
      const executionId = await orchestrationService.submitExecution(minimalRequest);
      expect(executionId).toBeDefined();
      expect(executionId).toMatch(/^exec_\d+_[a-z0-9]{9}$/);
    });
  });

  describe('getExecutionStatus()', () => {
    it('should return null for non-existent execution', async () => {
      const result = await orchestrationService.getExecutionStatus('non_existent_id');
      expect(result).toBeNull();
    });

    it('should return execution result for valid execution ID', async () => {
      const request: ExecutionRequest = {
        userId: 'user_123',
        projectId: 'proj_456',
        files: [
          { path: 'test.js', content: 'console.log("test");' }
        ]
      };
      
      const executionId = await orchestrationService.submitExecution(request);
      const result = await orchestrationService.getExecutionStatus(executionId);
      
      expect(result).toBeDefined();
      expect(result?.id).toBe(executionId);
      expect(result?.status).toBe(ExecutionStatus.PENDING);
      expect(result?.output).toBe('');
      expect(result?.error).toBe('');
      expect(result?.executionTime).toBe(0);
      expect(result?.createdAt).toBeInstanceOf(Date);
      expect(result?.updatedAt).toBeInstanceOf(Date);
    });

    it('should return consistent results for same execution ID', async () => {
      const request: ExecutionRequest = {
        userId: 'user_123',
        projectId: 'proj_456',
        files: [
          { path: 'test.js', content: 'console.log("test");' }
        ]
      };
      
      const executionId = await orchestrationService.submitExecution(request);
      const result1 = await orchestrationService.getExecutionStatus(executionId);
      const result2 = await orchestrationService.getExecutionStatus(executionId);
      
      expect(result1?.id).toBe(result2?.id);
      expect(result1?.status).toBe(result2?.status);
      expect(result1?.createdAt).toEqual(result2?.createdAt);
    });

    it('should handle multiple executions', async () => {
      const requests = [
        { userId: 'user_1', projectId: 'proj_1', files: [{ path: 'code1.js', content: 'code1' }] },
        { userId: 'user_2', projectId: 'proj_2', files: [{ path: 'code2.py', content: 'code2' }] }
      ];
      
      const executionIds = [];
      for (const request of requests) {
        const id = await orchestrationService.submitExecution(request);
        executionIds.push(id);
      }
      
      for (const id of executionIds) {
        const result = await orchestrationService.getExecutionStatus(id);
        expect(result).toBeDefined();
        expect(result?.id).toBe(id);
      }
    });
  });

  describe('cancelExecution()', () => {
    it('should return false for non-existent execution', async () => {
      const result = await orchestrationService.cancelExecution('non_existent_id');
      expect(result).toBe(false);
    });

    it('should cancel existing execution', async () => {
      const request: ExecutionRequest = {
        userId: 'user_123',
        projectId: 'proj_456',
        files: [
          { path: 'test.js', content: 'console.log("test");' }
        ]
      };
      
      const executionId = await orchestrationService.submitExecution(request);
      const cancelResult = await orchestrationService.cancelExecution(executionId);
      
      expect(cancelResult).toBe(true);
    });

    it('should log cancellation', async () => {
      const request: ExecutionRequest = {
        userId: 'user_123',
        projectId: 'proj_456',
        files: [
          { path: 'test.js', content: 'console.log("test");' }
        ]
      };
      
      const executionId = await orchestrationService.submitExecution(request);
      await orchestrationService.cancelExecution(executionId);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        `Execution ${executionId} cancelled`
      );
    });

    it('should remove execution from queue after cancellation', async () => {
      const request: ExecutionRequest = {
        userId: 'user_123',
        projectId: 'proj_456',
        files: [
          { path: 'test.js', content: 'console.log("test");' }
        ]
      };
      
      const executionId = await orchestrationService.submitExecution(request);
      await orchestrationService.cancelExecution(executionId);
      
      // Should return null after cancellation
      const status = await orchestrationService.getExecutionStatus(executionId);
      expect(status).toBeNull();
    });

    it('should return false when trying to cancel already cancelled execution', async () => {
      const request: ExecutionRequest = {
        userId: 'user_123',
        projectId: 'proj_456',
        files: [
          { path: 'test.js', content: 'console.log("test");' }
        ]
      };
      
      const executionId = await orchestrationService.submitExecution(request);
      await orchestrationService.cancelExecution(executionId);
      
      // Try to cancel again
      const secondCancelResult = await orchestrationService.cancelExecution(executionId);
      expect(secondCancelResult).toBe(false);
    });
  });

  describe('getExecutionHistory()', () => {
    it('should return empty array (mock implementation)', async () => {
      const result = await orchestrationService.getExecutionHistory('user_123');
      expect(result).toEqual([]);
    });

    it('should log history request with default limit', async () => {
      const userId = 'user_123';
      
      await orchestrationService.getExecutionHistory(userId);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        `Getting execution history for user ${userId} (limit: 10)`
      );
    });

    it('should log history request with custom limit', async () => {
      const userId = 'user_123';
      const limit = 25;
      
      await orchestrationService.getExecutionHistory(userId, limit);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        `Getting execution history for user ${userId} (limit: ${limit})`
      );
    });

    it('should handle different user IDs', async () => {
      const userIds = ['user_1', 'user_2', 'user_3'];
      
      for (const userId of userIds) {
        const result = await orchestrationService.getExecutionHistory(userId);
        expect(result).toEqual([]);
      }
    });

    it('should handle various limit values', async () => {
      const limits = [5, 10, 20, 50, 100];
      
      for (const limit of limits) {
        const result = await orchestrationService.getExecutionHistory('user_test', limit);
        expect(result).toEqual([]);
      }
    });
  });

  describe('getExecutionStats()', () => {
    it('should return zero stats when no executions', async () => {
      const stats = await orchestrationService.getExecutionStats();
      
      expect(stats).toEqual({
        totalExecutions: 0,
        activeExecutions: 0,
        queuedExecutions: 0,
        averageExecutionTime: 0
      });
    });

    it('should return updated stats after submitting executions', async () => {
      const request: ExecutionRequest = {
        userId: 'user_123',
        projectId: 'proj_456',
        files: [
          { path: 'test.js', content: 'console.log("test");' }
        ]
      };
      
      await orchestrationService.submitExecution(request);
      await orchestrationService.submitExecution(request);
      
      const stats = await orchestrationService.getExecutionStats();
      
      expect(stats.totalExecutions).toBe(2);
      expect(stats.queuedExecutions).toBe(2);
      expect(stats.activeExecutions).toBe(0);
      expect(stats.averageExecutionTime).toBe(0);
    });

    it('should return correct queue count after cancellations', async () => {
      const request: ExecutionRequest = {
        userId: 'user_123',
        projectId: 'proj_456',
        files: [
          { path: 'test.js', content: 'console.log("test");' }
        ]
      };
      
      await orchestrationService.submitExecution(request);
      const id2 = await orchestrationService.submitExecution(request);
      await orchestrationService.submitExecution(request);
      
      await orchestrationService.cancelExecution(id2);
      
      const stats = await orchestrationService.getExecutionStats();
      
      expect(stats.totalExecutions).toBe(2); // Should be 2 after cancellation
      expect(stats.queuedExecutions).toBe(2);
    });
  });

  describe('initializeAgentSphere()', () => {
    it('should log TODO message', async () => {
      await orchestrationService.initializeAgentSphere();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'TODO: Initialize AgentSphere SDK connection'
      );
    });

    it('should complete without errors', async () => {
      await expect(orchestrationService.initializeAgentSphere()).resolves.toBeUndefined();
    });
  });

  describe('cleanup()', () => {
    it('should clear all queues and log completion', async () => {
      // Add some executions first
      const request: ExecutionRequest = {
        userId: 'user_123',
        projectId: 'proj_456',
        files: [
          { path: 'test.js', content: 'console.log("test");' }
        ]
      };
      
      await orchestrationService.submitExecution(request);
      await orchestrationService.submitExecution(request);
      
      // Verify they exist
      let stats = await orchestrationService.getExecutionStats();
      expect(stats.totalExecutions).toBe(2);
      
      // Cleanup
      await orchestrationService.cleanup();
      
      // Verify cleanup
      stats = await orchestrationService.getExecutionStats();
      expect(stats.totalExecutions).toBe(0);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'OrchestrationService cleanup completed'
      );
    });

    it('should handle cleanup when queues are already empty', async () => {
      await orchestrationService.cleanup();
      
      const stats = await orchestrationService.getExecutionStats();
      expect(stats.totalExecutions).toBe(0);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'OrchestrationService cleanup completed'
      );
    });
  });

  describe('generateExecutionId() (private method behavior)', () => {
    it('should generate unique IDs through submitExecution', async () => {
      const request: ExecutionRequest = {
        userId: 'user_123',
        projectId: 'proj_456',
        files: [
          { path: 'test.js', content: 'console.log("test");' }
        ]
      };
      
      const ids = new Set();
      const iterations = 10;
      
      for (let i = 0; i < iterations; i++) {
        const id = await orchestrationService.submitExecution(request);
        ids.add(id);
      }
      
      // All IDs should be unique
      expect(ids.size).toBe(iterations);
    });

    it('should generate IDs with correct format', async () => {
      const request: ExecutionRequest = {
        userId: 'user_test',
        projectId: 'proj_test',
        files: [
          { path: 'test.js', content: 'test code' }
        ]
      };
      
      const executionId = await orchestrationService.submitExecution(request);
      
      expect(executionId).toMatch(/^exec_\d+_[a-z0-9]{9}$/);
      expect(executionId.startsWith('exec_')).toBe(true);
    });
  });
});