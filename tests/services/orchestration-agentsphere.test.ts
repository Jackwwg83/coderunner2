/**
 * Comprehensive unit tests for AgentSphere-specific orchestration methods
 * Focuses on testing new methods: listActiveSandboxes, connectToSandbox, findUserSandbox
 * and enhanced sandbox management functionality
 */

import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { OrchestrationService } from '../../src/services/orchestration';
import { DatabaseService } from '../../src/services/database';
import { ConfigurationService } from '../../src/services/configuration';
import { DeploymentStatus } from '../../src/types/index';
import {
  MockSandboxClass,
  MockSandbox,
  TestDataGenerator,
  DatabaseMockHelper,
  ConfigurationMockHelper,
  ErrorSimulator,
  TestAssertions,
  PerformanceTestHelper,
  TestSetupHelper
} from '../helpers/agentsphere-test-helper';

// Mock AgentSphere SDK
jest.mock('agentsphere', () => ({
  Sandbox: MockSandboxClass
}), { virtual: true });

describe('OrchestrationService - AgentSphere Integration', () => {
  let orchestrationService: OrchestrationService;
  let mockDb: any;
  let mockConfig: any;
  let testEnv: any;

  beforeAll(() => {
    TestSetupHelper.setupBeforeAll();
  });

  afterAll(() => {
    TestSetupHelper.setupAfterAll();
  });

  beforeEach(() => {
    TestSetupHelper.setupBeforeEach();
    
    // Create test environment
    testEnv = TestSetupHelper.createTestEnvironment();
    mockDb = testEnv.mockDb;
    mockConfig = testEnv.mockConfig;

    // Mock service instances
    jest.spyOn(DatabaseService, 'getInstance').mockReturnValue(mockDb as any);
    jest.spyOn(ConfigurationService, 'getInstance').mockReturnValue(mockConfig as any);

    orchestrationService = OrchestrationService.getInstance();
  });

  afterEach(() => {
    TestSetupHelper.setupAfterEach();
  });

  describe('listActiveSandboxes()', () => {
    it('should return empty array when no sandboxes exist', async () => {
      MockSandboxClass.list.mockResolvedValue([]);
      
      const result = await orchestrationService.listActiveSandboxes();
      
      expect(result).toEqual([]);
      expect(MockSandboxClass.list).toHaveBeenCalledTimes(1);
    });

    it('should return formatted sandbox list with correct structure', async () => {
      const mockSandboxes = [
        {
          sandbox_id: 'sb-1',
          metadata: { userId: 'user1', projectId: 'proj1' },
          started_at: new Date('2024-01-01T10:00:00Z'),
          end_at: new Date('2024-01-01T11:00:00Z')
        },
        {
          sandbox_id: 'sb-2',
          metadata: { userId: 'user2', projectId: 'proj2' },
          started_at: new Date('2024-01-01T10:30:00Z'),
          end_at: new Date('2024-01-01T11:30:00Z')
        }
      ];
      
      MockSandboxClass.list.mockResolvedValue(mockSandboxes);
      
      const result = await orchestrationService.listActiveSandboxes();
      
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        sandboxId: 'sb-1',
        metadata: { userId: 'user1', projectId: 'proj1' },
        startedAt: new Date('2024-01-01T10:00:00Z'),
        endAt: new Date('2024-01-01T11:00:00Z')
      });
      
      TestAssertions.assertSandboxListStructure(result);
    });

    it('should handle API errors gracefully', async () => {
      const error = ErrorSimulator.createNetworkError('sandbox listing');
      MockSandboxClass.list.mockRejectedValue(error);
      
      const result = await orchestrationService.listActiveSandboxes();
      
      expect(result).toEqual([]);
      expect(MockSandboxClass.list).toHaveBeenCalledTimes(1);
    });

    it('should measure performance within acceptable limits', async () => {
      const mockSandboxes = Array.from({ length: 50 }, (_, i) => ({
        sandbox_id: `sb-${i}`,
        metadata: { userId: `user${i}`, projectId: `proj${i}` },
        started_at: new Date(),
        end_at: new Date()
      }));
      
      MockSandboxClass.list.mockResolvedValue(mockSandboxes);
      
      const { result, executionTime } = await PerformanceTestHelper.measureExecutionTime(
        () => orchestrationService.listActiveSandboxes()
      );
      
      expect(result).toHaveLength(50);
      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('connectToSandbox()', () => {
    const testSandboxId = 'test-sandbox-123';

    it('should successfully connect to existing sandbox', async () => {
      const mockSandbox = new MockSandbox();
      MockSandboxClass.connect.mockResolvedValue(mockSandbox);
      
      const result = await orchestrationService.connectToSandbox(testSandboxId);
      
      expect(result).toBeDefined();
      expect(MockSandboxClass.connect).toHaveBeenCalledWith(testSandboxId);
      expect(result).toBe(mockSandbox);
    });

    it('should track connected sandbox in internal state', async () => {
      const mockSandbox = new MockSandbox();
      mockSandbox.getInfo = jest.fn().mockReturnValue({
        sandbox_id: testSandboxId,
        status: 'running',
        started_at: new Date(),
        metadata: {
          userId: testEnv.testUserId,
          projectId: testEnv.testProjectId
        }
      });
      
      MockSandboxClass.connect.mockResolvedValue(mockSandbox);
      
      const result = await orchestrationService.connectToSandbox(testSandboxId);
      
      expect(result).toBeDefined();
      
      // Verify internal tracking
      const activeSandboxes = (orchestrationService as any).activeSandboxes;
      const sandboxMetadata = (orchestrationService as any).sandboxMetadata;
      
      expect(activeSandboxes.has(testSandboxId)).toBe(true);
      expect(sandboxMetadata.has(testSandboxId)).toBe(true);
    });

    it('should handle connection failures gracefully', async () => {
      const error = ErrorSimulator.createNetworkError('sandbox connection');
      MockSandboxClass.connect.mockRejectedValue(error);
      
      const result = await orchestrationService.connectToSandbox(testSandboxId);
      
      expect(result).toBeNull();
      expect(MockSandboxClass.connect).toHaveBeenCalledWith(testSandboxId);
    });

    it('should handle sandbox with missing metadata', async () => {
      const mockSandbox = new MockSandbox();
      mockSandbox.getInfo = jest.fn().mockReturnValue({
        sandbox_id: testSandboxId,
        status: 'running',
        started_at: new Date(),
        metadata: null // Missing metadata
      });
      
      MockSandboxClass.connect.mockResolvedValue(mockSandbox);
      
      const result = await orchestrationService.connectToSandbox(testSandboxId);
      
      expect(result).toBeDefined();
      
      // Should still track sandbox with default metadata
      const sandboxMetadata = (orchestrationService as any).sandboxMetadata;
      expect(sandboxMetadata.has(testSandboxId)).toBe(true);
    });

    it('should measure connection performance', async () => {
      const mockSandbox = new MockSandbox();
      MockSandboxClass.connect.mockResolvedValue(mockSandbox);
      
      const { result, executionTime } = await PerformanceTestHelper.measureExecutionTime(
        () => orchestrationService.connectToSandbox(testSandboxId)
      );
      
      expect(result).toBeDefined();
      expect(executionTime).toBeLessThan(500); // Should connect within 500ms
    });
  });

  describe('findUserSandbox()', () => {
    const testUserId = 'test-user-456';
    const testProjectId = 'test-project-789';

    it('should find sandbox by userId only', async () => {
      const mockSandboxes = [
        {
          sandbox_id: 'sb-1',
          metadata: { userId: 'other-user', projectId: 'proj1' },
          started_at: new Date(),
          end_at: new Date()
        },
        {
          sandbox_id: 'sb-2',
          metadata: { userId: testUserId, projectId: 'proj2' },
          started_at: new Date(),
          end_at: new Date()
        }
      ];
      
      const mockSandbox = new MockSandbox();
      MockSandboxClass.list.mockResolvedValue(mockSandboxes);
      MockSandboxClass.connect.mockResolvedValue(mockSandbox);
      
      const result = await orchestrationService.findUserSandbox(testUserId);
      
      expect(result).toBeDefined();
      expect(result?.sandboxId).toBe('sb-2');
      expect(result?.sandbox).toBe(mockSandbox);
      expect(MockSandboxClass.connect).toHaveBeenCalledWith('sb-2');
    });

    it('should find sandbox by userId and projectId', async () => {
      const mockSandboxes = [
        {
          sandbox_id: 'sb-1',
          metadata: { userId: testUserId, projectId: 'other-project' },
          started_at: new Date(),
          end_at: new Date()
        },
        {
          sandbox_id: 'sb-2',
          metadata: { userId: testUserId, projectId: testProjectId },
          started_at: new Date(),
          end_at: new Date()
        }
      ];
      
      const mockSandbox = new MockSandbox();
      MockSandboxClass.list.mockResolvedValue(mockSandboxes);
      MockSandboxClass.connect.mockResolvedValue(mockSandbox);
      
      const result = await orchestrationService.findUserSandbox(testUserId, testProjectId);
      
      expect(result).toBeDefined();
      expect(result?.sandboxId).toBe('sb-2');
      expect(MockSandboxClass.connect).toHaveBeenCalledWith('sb-2');
    });

    it('should return null when no matching sandbox found', async () => {
      const mockSandboxes = [
        {
          sandbox_id: 'sb-1',
          metadata: { userId: 'other-user', projectId: 'proj1' },
          started_at: new Date(),
          end_at: new Date()
        }
      ];
      
      MockSandboxClass.list.mockResolvedValue(mockSandboxes);
      
      const result = await orchestrationService.findUserSandbox('non-existent-user');
      
      expect(result).toBeNull();
      expect(MockSandboxClass.connect).not.toHaveBeenCalled();
    });

    it('should return null when projectId filter excludes matches', async () => {
      const mockSandboxes = [
        {
          sandbox_id: 'sb-1',
          metadata: { userId: testUserId, projectId: 'different-project' },
          started_at: new Date(),
          end_at: new Date()
        }
      ];
      
      MockSandboxClass.list.mockResolvedValue(mockSandboxes);
      
      const result = await orchestrationService.findUserSandbox(testUserId, testProjectId);
      
      expect(result).toBeNull();
    });

    it('should handle sandbox connection failure gracefully', async () => {
      const mockSandboxes = [
        {
          sandbox_id: 'sb-1',
          metadata: { userId: testUserId, projectId: testProjectId },
          started_at: new Date(),
          end_at: new Date()
        }
      ];
      
      MockSandboxClass.list.mockResolvedValue(mockSandboxes);
      MockSandboxClass.connect.mockResolvedValue(null);
      
      const result = await orchestrationService.findUserSandbox(testUserId, testProjectId);
      
      expect(result).toBeNull();
    });

    it('should handle sandbox listing errors', async () => {
      const error = ErrorSimulator.createNetworkError('sandbox listing');
      MockSandboxClass.list.mockRejectedValue(error);
      
      const result = await orchestrationService.findUserSandbox(testUserId);
      
      expect(result).toBeNull();
    });

    it('should handle sandboxes with missing metadata', async () => {
      const mockSandboxes = [
        {
          sandbox_id: 'sb-1',
          metadata: null, // Missing metadata
          started_at: new Date(),
          end_at: new Date()
        },
        {
          sandbox_id: 'sb-2',
          metadata: { userId: testUserId, projectId: testProjectId },
          started_at: new Date(),
          end_at: new Date()
        }
      ];
      
      const mockSandbox = new MockSandbox();
      MockSandboxClass.list.mockResolvedValue(mockSandboxes);
      MockSandboxClass.connect.mockResolvedValue(mockSandbox);
      
      const result = await orchestrationService.findUserSandbox(testUserId);
      
      expect(result).toBeDefined();
      expect(result?.sandboxId).toBe('sb-2');
    });
  });

  describe('Enhanced Deployment with AgentSphere', () => {
    it('should deploy project and integrate with new sandbox methods', async () => {
      // Setup mocks
      const deployment = DatabaseMockHelper.createMockDeployment();
      mockDb.createDeployment.mockResolvedValue(deployment);
      mockDb.updateDeployment.mockResolvedValue({ ...deployment, status: DeploymentStatus.RUNNING });
      
      const mockSandbox = new MockSandbox();
      MockSandboxClass.mockReturnValue(mockSandbox);
      
      const result = await orchestrationService.deployProject(
        testEnv.testUserId,
        testEnv.sampleFiles
      );
      
      expect(result.status).toBe('running');
      expect(result.url).toBeDefined();
      expect(result.sandboxId).toBeDefined();
      
      // Verify sandbox is tracked
      const activeSandboxes = (orchestrationService as any).activeSandboxes;
      expect(activeSandboxes.size).toBeGreaterThan(0);
    });

    it('should enforce user sandbox limits using new methods', async () => {
      // Create multiple existing sandboxes for user
      const existingSandboxes = Array.from({ length: 3 }, (_, i) => ({
        sandbox_id: `existing-sb-${i}`,
        metadata: { userId: testEnv.testUserId, projectId: `proj-${i}` },
        started_at: new Date(Date.now() - (i + 1) * 60000), // Different ages
        end_at: new Date()
      }));
      
      MockSandboxClass.list.mockResolvedValue(existingSandboxes);
      
      // Mock internal tracking
      const orchestrationInstance = orchestrationService as any;
      existingSandboxes.forEach((sb, i) => {
        const mockSandbox = new MockSandbox();
        orchestrationInstance.activeSandboxes.set(sb.sandbox_id, mockSandbox);
        orchestrationInstance.sandboxMetadata.set(sb.sandbox_id, {
          userId: testEnv.testUserId,
          projectId: `proj-${i}`,
          createdAt: sb.started_at,
          lastActivity: sb.started_at
        });
      });
      
      // Setup deployment
      const deployment = DatabaseMockHelper.createMockDeployment();
      mockDb.createDeployment.mockResolvedValue(deployment);
      mockDb.updateDeployment.mockResolvedValue({ ...deployment, status: DeploymentStatus.RUNNING });
      mockDb.query.mockResolvedValue({ rows: [] });
      
      const mockSandbox = new MockSandbox();
      MockSandboxClass.mockReturnValue(mockSandbox);
      
      const result = await orchestrationService.deployProject(
        testEnv.testUserId,
        testEnv.sampleFiles
      );
      
      expect(result.status).toBe('running');
      
      // Verify oldest sandbox was cleaned up
      expect(mockSandbox.kill).toHaveBeenCalled();
    });
  });

  describe('Enhanced Monitoring with New Methods', () => {
    it('should integrate findUserSandbox with monitoring', async () => {
      const deploymentId = TestDataGenerator.generateDeploymentId();
      const sandboxId = TestDataGenerator.generateSandboxId();
      const deployment = DatabaseMockHelper.createMockRunningDeployment({
        id: deploymentId,
        app_sandbox_id: sandboxId
      });
      
      mockDb.getDeploymentById.mockResolvedValue(deployment);
      
      const mockSandbox = new MockSandbox();
      const orchestrationInstance = orchestrationService as any;
      orchestrationInstance.activeSandboxes.set(sandboxId, mockSandbox);
      orchestrationInstance.sandboxMetadata.set(sandboxId, {
        userId: testEnv.testUserId,
        projectId: testEnv.testProjectId,
        createdAt: new Date(),
        lastActivity: new Date()
      });
      
      // Mock health check to return healthy
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200
      } as Response);
      
      const result = await orchestrationService.monitorDeployment(deploymentId);
      
      expect(result.status).toBe(DeploymentStatus.RUNNING);
      expect(result.health).toBe('healthy');
      TestAssertions.assertMonitoringStructure(result);
    });
  });

  describe('Enhanced Cleanup with New Methods', () => {
    it('should use listActiveSandboxes for comprehensive cleanup', async () => {
      // Setup tracked sandboxes
      const trackedSandboxes = [
        { id: 'sb-1', age: 7200000, idle: 3600000 }, // Old and idle
        { id: 'sb-2', age: 1800000, idle: 300000 },  // Recent and active
        { id: 'sb-3', age: 3600000, idle: 7200000 }  // Medium age but very idle
      ];
      
      const orchestrationInstance = orchestrationService as any;
      trackedSandboxes.forEach(({ id, age, idle }) => {
        const mockSandbox = new MockSandbox();
        orchestrationInstance.activeSandboxes.set(id, mockSandbox);
        orchestrationInstance.sandboxMetadata.set(id, {
          userId: testEnv.testUserId,
          projectId: testEnv.testProjectId,
          createdAt: new Date(Date.now() - age),
          lastActivity: new Date(Date.now() - idle)
        });
      });
      
      mockDb.query.mockResolvedValue({ rows: [] });
      
      const result = await orchestrationService.cleanupSandboxes({
        maxAge: 3600000, // 1 hour
        maxIdle: 1800000 // 30 minutes
      });
      
      expect(result.cleaned).toBe(2); // sb-1 (old) and sb-3 (idle)
      expect(result.details).toHaveLength(2);
      TestAssertions.assertCleanupResultStructure(result);
    });
  });

  describe('Performance and Stress Testing', () => {
    it('should handle concurrent sandbox operations', async () => {
      const operations = Array.from({ length: 10 }, (_, i) => 
        () => orchestrationService.listActiveSandboxes()
      );
      
      MockSandboxClass.list.mockResolvedValue([]);
      
      const { results, errors, executionTime } = await PerformanceTestHelper.runConcurrentTests(
        operations,
        5 // Max concurrency
      );
      
      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(10);
      expect(executionTime).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should handle high-frequency findUserSandbox calls', async () => {
      const mockSandboxes = Array.from({ length: 100 }, (_, i) => ({
        sandbox_id: `sb-${i}`,
        metadata: { userId: `user-${i % 10}`, projectId: `proj-${i}` },
        started_at: new Date(),
        end_at: new Date()
      }));
      
      MockSandboxClass.list.mockResolvedValue(mockSandboxes);
      const mockSandbox = new MockSandbox();
      MockSandboxClass.connect.mockResolvedValue(mockSandbox);
      
      const operations = Array.from({ length: 20 }, (_, i) =>
        () => orchestrationService.findUserSandbox(`user-${i % 10}`)
      );
      
      const { results, errors, executionTime } = await PerformanceTestHelper.runConcurrentTests(
        operations,
        5
      );
      
      expect(errors).toHaveLength(0);
      expect(results.filter(r => r !== null)).toHaveLength(20);
      expect(executionTime).toBeLessThan(3000);
    });

    it('should maintain performance under memory pressure', async () => {
      // Create many sandbox references to test memory management
      const orchestrationInstance = orchestrationService as any;
      
      for (let i = 0; i < 1000; i++) {
        const mockSandbox = new MockSandbox();
        orchestrationInstance.activeSandboxes.set(`sb-${i}`, mockSandbox);
        orchestrationInstance.sandboxMetadata.set(`sb-${i}`, {
          userId: `user-${i}`,
          projectId: `proj-${i}`,
          createdAt: new Date(),
          lastActivity: new Date()
        });
      }
      
      const { executionTime } = await PerformanceTestHelper.measureExecutionTime(
        () => orchestrationService.cleanupSandboxes({ force: true })
      );
      
      expect(executionTime).toBeLessThan(5000); // Should cleanup within 5 seconds
      expect(orchestrationInstance.activeSandboxes.size).toBe(0);
      expect(orchestrationInstance.sandboxMetadata.size).toBe(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle cascading failures in sandbox operations', async () => {
      // Simulate AgentSphere API down
      MockSandboxClass.list.mockRejectedValue(new Error('AgentSphere API unavailable'));
      MockSandboxClass.connect.mockRejectedValue(new Error('AgentSphere API unavailable'));
      
      const results = await Promise.allSettled([
        orchestrationService.listActiveSandboxes(),
        orchestrationService.connectToSandbox('sb-123'),
        orchestrationService.findUserSandbox('user-123')
      ]);
      
      // All operations should handle errors gracefully
      expect(results[0].status).toBe('fulfilled');
      expect((results[0] as PromiseFulfilledResult<any>).value).toEqual([]);
      
      expect(results[1].status).toBe('fulfilled');
      expect((results[1] as PromiseFulfilledResult<any>).value).toBeNull();
      
      expect(results[2].status).toBe('fulfilled');
      expect((results[2] as PromiseFulfilledResult<any>).value).toBeNull();
    });

    it('should recover from intermittent failures', async () => {
      let attemptCount = 0;
      MockSandboxClass.list.mockImplementation(() => {
        attemptCount++;
        if (attemptCount <= 2) {
          throw new Error('Temporary failure');
        }
        return Promise.resolve([]);
      });
      
      // First attempts should fail, but eventual success
      await expect(orchestrationService.listActiveSandboxes()).resolves.toEqual([]);
      await expect(orchestrationService.listActiveSandboxes()).resolves.toEqual([]);
      await expect(orchestrationService.listActiveSandboxes()).resolves.toEqual([]);
      
      expect(attemptCount).toBe(3);
    });
  });

  describe('Integration with Configuration Service', () => {
    it('should use environment configuration in deployment with new methods', async () => {
      // Setup configuration with AgentSphere-specific settings
      mockConfig.getConfigurationForDeployment.mockResolvedValue({
        variables: {
          NODE_ENV: 'production',
          AGENTSPHERE_TIMEOUT: '600',
          AGENTSPHERE_REGION: 'us-east-1'
        }
      });
      
      const deployment = DatabaseMockHelper.createMockDeployment();
      mockDb.createDeployment.mockResolvedValue(deployment);
      mockDb.updateDeployment.mockResolvedValue({ ...deployment, status: DeploymentStatus.RUNNING });
      
      const mockSandbox = new MockSandbox();
      MockSandboxClass.mockReturnValue(mockSandbox);
      
      await orchestrationService.deployProject(testEnv.testUserId, testEnv.sampleFiles);
      
      expect(mockSandbox.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          envs: expect.objectContaining({
            NODE_ENV: 'production',
            AGENTSPHERE_TIMEOUT: '600',
            AGENTSPHERE_REGION: 'us-east-1'
          })
        })
      );
    });
  });
});