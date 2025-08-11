import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { OrchestrationService } from '../../src/services/orchestration';
import { DatabaseService } from '../../src/services/database';
import { DeploymentStatus } from '../../src/types/index';

// Mock AgentSphere SDK
const mockSandbox = {
  initialize: jest.fn(),
  getInfo: jest.fn(),
  getHost: jest.fn(),
  kill: jest.fn(),
  files: {
    write: jest.fn()
  },
  commands: {
    run: jest.fn()
  }
};

const mockSandboxClass = jest.fn(() => mockSandbox);
mockSandboxClass.list = jest.fn();
mockSandboxClass.connect = jest.fn();

// Mock the AgentSphere SDK module loading
jest.mock('agentsphere', () => ({
  Sandbox: mockSandboxClass
}), { virtual: true });

describe('AgentSphere Integration Tests', () => {
  let orchestrationService: OrchestrationService;
  let dbService: DatabaseService;
  
  // Test data
  const testUserId = 'test-user-123';
  const testProjectId = 'test-project-456';
  const testSandboxId = 'sb-test-789';
  const testDeploymentId = 'dep-test-101';
  
  const sampleFiles = [
    {
      path: 'package.json',
      content: JSON.stringify({
        name: 'test-app',
        main: 'index.js',
        scripts: { start: 'node index.js' },
        dependencies: { express: '^4.18.0' }
      })
    },
    {
      path: 'index.js',
      content: `
        const express = require('express');
        const app = express();
        const port = process.env.PORT || 3000;
        
        app.get('/', (req, res) => res.send('Hello World!'));
        app.get('/health', (req, res) => res.json({ status: 'ok' }));
        
        app.listen(port, () => {
          console.log(\`Server running on port \${port}\`);
        });
      `
    }
  ];

  beforeAll(async () => {
    // Initialize services
    dbService = DatabaseService.getInstance();
    orchestrationService = OrchestrationService.getInstance();
    
    // Wait for services to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    // Cleanup
    try {
      await orchestrationService.cleanup();
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  });

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Set up default mock implementations
    mockSandbox.initialize.mockResolvedValue(undefined);
    mockSandbox.getInfo.mockReturnValue({
      sandbox_id: testSandboxId,
      status: 'running',
      started_at: new Date(),
      metadata: {
        userId: testUserId,
        projectId: testProjectId
      }
    });
    mockSandbox.getHost.mockReturnValue('test-host.agentsphere.dev');
    mockSandbox.kill.mockResolvedValue(undefined);
    mockSandbox.files.write.mockResolvedValue(undefined);
    mockSandbox.commands.run.mockResolvedValue({
      stdout: 'Command executed successfully',
      stderr: '',
      pid: 12345
    });
    
    mockSandboxClass.list.mockResolvedValue([]);
    mockSandboxClass.connect.mockResolvedValue(mockSandbox);
  });

  describe('Sandbox Lifecycle Management', () => {
    it('should list active sandboxes', async () => {
      const mockSandboxes = [
        {
          sandbox_id: 'sb-1',
          metadata: { userId: 'user1', projectId: 'proj1' },
          started_at: new Date(),
          end_at: new Date(Date.now() + 3600000) // 1 hour later
        },
        {
          sandbox_id: 'sb-2',
          metadata: { userId: 'user2', projectId: 'proj2' },
          started_at: new Date(),
          end_at: new Date(Date.now() + 3600000)
        }
      ];
      
      mockSandboxClass.list.mockResolvedValue(mockSandboxes);
      
      const result = await orchestrationService.listActiveSandboxes();
      
      expect(mockSandboxClass.list).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        sandboxId: 'sb-1',
        metadata: { userId: 'user1', projectId: 'proj1' }
      });
    });

    it('should handle listing sandboxes when API fails', async () => {
      mockSandboxClass.list.mockRejectedValue(new Error('API Error'));
      
      const result = await orchestrationService.listActiveSandboxes();
      
      expect(result).toEqual([]);
    });

    it('should connect to existing sandbox', async () => {
      mockSandboxClass.connect.mockResolvedValue(mockSandbox);
      
      const result = await orchestrationService.connectToSandbox(testSandboxId);
      
      expect(mockSandboxClass.connect).toHaveBeenCalledWith(testSandboxId);
      expect(result).toBeTruthy();
    });

    it('should handle connection failure gracefully', async () => {
      mockSandboxClass.connect.mockRejectedValue(new Error('Connection failed'));
      
      const result = await orchestrationService.connectToSandbox(testSandboxId);
      
      expect(result).toBeNull();
    });

    it('should find user sandbox by userId', async () => {
      const userSandboxes = [
        {
          sandbox_id: 'user-sb-1',
          metadata: { userId: testUserId, projectId: 'other-project' },
          started_at: new Date(),
          end_at: new Date(Date.now() + 3600000)
        }
      ];
      
      mockSandboxClass.list.mockResolvedValue(userSandboxes);
      mockSandboxClass.connect.mockResolvedValue(mockSandbox);
      
      const result = await orchestrationService.findUserSandbox(testUserId);
      
      expect(result).toBeTruthy();
      expect(result?.sandboxId).toBe('user-sb-1');
    });

    it('should find user sandbox by userId and projectId', async () => {
      const userSandboxes = [
        {
          sandbox_id: 'wrong-project',
          metadata: { userId: testUserId, projectId: 'different-project' },
          started_at: new Date(),
          end_at: new Date()
        },
        {
          sandbox_id: 'correct-sandbox',
          metadata: { userId: testUserId, projectId: testProjectId },
          started_at: new Date(),
          end_at: new Date()
        }
      ];
      
      mockSandboxClass.list.mockResolvedValue(userSandboxes);
      mockSandboxClass.connect.mockResolvedValue(mockSandbox);
      
      const result = await orchestrationService.findUserSandbox(testUserId, testProjectId);
      
      expect(result).toBeTruthy();
      expect(result?.sandboxId).toBe('correct-sandbox');
    });

    it('should return null when no user sandbox found', async () => {
      mockSandboxClass.list.mockResolvedValue([]);
      
      const result = await orchestrationService.findUserSandbox('non-existent-user');
      
      expect(result).toBeNull();
    });
  });

  describe('Project Deployment', () => {
    it('should deploy Node.js project successfully', async () => {
      // Mock database operations
      const mockDeployment = {
        id: testDeploymentId,
        project_id: testProjectId,
        status: DeploymentStatus.PENDING,
        runtime_type: 'template-nodejs-18',
        app_sandbox_id: null,
        public_url: null
      };
      
      jest.spyOn(dbService, 'createDeployment').mockResolvedValue(mockDeployment);
      jest.spyOn(dbService, 'updateDeployment').mockResolvedValue({ ...mockDeployment, status: DeploymentStatus.RUNNING });
      jest.spyOn(dbService, 'getDeploymentById').mockResolvedValue(mockDeployment);
      
      // Mock successful deployment process
      mockSandbox.commands.run
        .mockResolvedValueOnce({ stdout: 'npm install completed', stderr: '', pid: 1001 }) // npm install
        .mockResolvedValueOnce({ stdout: 'Server started', stderr: '', pid: 1002 }); // app start
      
      const result = await orchestrationService.deployProject(testUserId, sampleFiles);
      
      expect(result.status).toBe('running');
      expect(result.url).toBe('https://test-host.agentsphere.dev');
      expect(result.sandboxId).toBe(testSandboxId);
      expect(mockSandbox.initialize).toHaveBeenCalled();
      expect(mockSandbox.files.write).toHaveBeenCalled();
      expect(mockSandbox.commands.run).toHaveBeenCalledWith('npm install');
    });

    it('should deploy Manifest project successfully', async () => {
      const manifestFiles = [
        {
          path: 'manifest.yaml',
          content: `
name: test-app
description: Test application
routes:
  - path: /
    method: GET
    response: Hello World
  - path: /api/users
    method: GET
    response: []
          `
        }
      ];
      
      const mockDeployment = {
        id: testDeploymentId,
        project_id: testProjectId,
        status: DeploymentStatus.PENDING,
        runtime_type: 'template-nodejs-18'
      };
      
      jest.spyOn(dbService, 'createDeployment').mockResolvedValue(mockDeployment);
      jest.spyOn(dbService, 'updateDeployment').mockResolvedValue({ ...mockDeployment, status: DeploymentStatus.RUNNING });
      jest.spyOn(dbService, 'getDeploymentById').mockResolvedValue(mockDeployment);
      
      const result = await orchestrationService.deployProject(testUserId, manifestFiles);
      
      expect(result.status).toBe('running');
      expect(mockSandbox.initialize).toHaveBeenCalled();
    });

    it('should handle deployment timeout', async () => {
      mockSandbox.commands.run.mockImplementation(() => 
        new Promise((resolve) => setTimeout(resolve, 10000)) // Long-running command
      );
      
      jest.spyOn(dbService, 'createDeployment').mockResolvedValue({
        id: testDeploymentId,
        project_id: testProjectId,
        status: DeploymentStatus.PENDING,
        runtime_type: 'template-nodejs-18'
      });
      jest.spyOn(dbService, 'updateDeployment').mockResolvedValue({});
      jest.spyOn(dbService, 'getDeploymentById').mockResolvedValue(null);
      
      await expect(orchestrationService.deployProject(testUserId, sampleFiles, { timeout: 100 }))
        .rejects.toThrow();
    });

    it('should handle deployment failure and cleanup', async () => {
      mockSandbox.commands.run.mockRejectedValue(new Error('npm install failed'));
      
      jest.spyOn(dbService, 'createDeployment').mockResolvedValue({
        id: testDeploymentId,
        project_id: testProjectId,
        status: DeploymentStatus.PENDING,
        runtime_type: 'template-nodejs-18'
      });
      jest.spyOn(dbService, 'updateDeployment').mockResolvedValue({});
      jest.spyOn(dbService, 'getDeploymentById').mockResolvedValue(null);
      
      await expect(orchestrationService.deployProject(testUserId, sampleFiles))
        .rejects.toThrow('Deployment failed');
      
      expect(mockSandbox.kill).toHaveBeenCalled();
    });

    it('should enforce user sandbox limits', async () => {
      // Mock multiple existing sandboxes for user
      const userSandboxes = Array.from({ length: 5 }, (_, i) => ({
        sandbox_id: `sb-${i}`,
        metadata: { userId: testUserId, projectId: `proj-${i}` },
        started_at: new Date(Date.now() - i * 1000), // Different creation times
        end_at: new Date()
      }));
      
      mockSandboxClass.list.mockResolvedValue(userSandboxes);
      
      jest.spyOn(dbService, 'createDeployment').mockResolvedValue({
        id: testDeploymentId,
        project_id: testProjectId,
        status: DeploymentStatus.PENDING,
        runtime_type: 'template-nodejs-18'
      });
      jest.spyOn(dbService, 'updateDeployment').mockResolvedValue({});
      jest.spyOn(dbService, 'query').mockResolvedValue({ rows: [] });
      
      await orchestrationService.deployProject(testUserId, sampleFiles);
      
      // Should cleanup oldest sandbox when limit is exceeded
      expect(mockSandbox.kill).toHaveBeenCalled();
    });
  });

  describe('Monitoring and Health Checks', () => {
    beforeEach(() => {
      jest.spyOn(dbService, 'getDeploymentById').mockResolvedValue({
        id: testDeploymentId,
        project_id: testProjectId,
        status: DeploymentStatus.RUNNING,
        app_sandbox_id: testSandboxId,
        public_url: 'https://test-app.agentsphere.dev',
        runtime_type: 'template-nodejs-18'
      });
    });

    it('should monitor deployment successfully', async () => {
      // Mock successful health check
      global.fetch = jest.fn()
        .mockResolvedValueOnce({ ok: true, status: 200 } as Response);
      
      const result = await orchestrationService.monitorDeployment(testDeploymentId);
      
      expect(result.status).toBe(DeploymentStatus.RUNNING);
      expect(result.health).toBe('healthy');
      expect(result.metrics.uptime).toBeGreaterThan(0);
    });

    it('should detect unhealthy deployment', async () => {
      mockSandbox.getInfo.mockReturnValue({
        sandbox_id: testSandboxId,
        status: 'stopped',
        started_at: new Date(),
        metadata: {}
      });
      
      const result = await orchestrationService.monitorDeployment(testDeploymentId);
      
      expect(result.health).toBe('unhealthy');
    });

    it('should handle monitoring for non-existent deployment', async () => {
      jest.spyOn(dbService, 'getDeploymentById').mockResolvedValue(null);
      
      await expect(orchestrationService.monitorDeployment('non-existent'))
        .rejects.toThrow('not found');
    });

    it('should get sandbox logs', async () => {
      mockSandbox.commands.run
        .mockResolvedValueOnce({ stdout: 'log line 1\nlog line 2', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'npm debug info', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'system log entry', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'app log entry', stderr: '' });
      
      const result = await orchestrationService.monitorDeployment(testDeploymentId);
      
      expect(result.logs.length).toBeGreaterThan(0);
    });
  });

  describe('Sandbox Cleanup', () => {
    it('should cleanup idle sandboxes', async () => {
      const oldDate = new Date(Date.now() - 7200000); // 2 hours ago
      
      // Mock an idle sandbox in internal tracking
      (orchestrationService as any).activeSandboxes.set(testSandboxId, mockSandbox);
      (orchestrationService as any).sandboxMetadata.set(testSandboxId, {
        userId: testUserId,
        projectId: testProjectId,
        createdAt: oldDate,
        lastActivity: oldDate
      });
      
      jest.spyOn(dbService, 'query').mockResolvedValue({ rows: [] });
      
      const result = await orchestrationService.cleanupSandboxes({ maxIdle: 3600000 }); // 1 hour max idle
      
      expect(result.cleaned).toBe(1);
      expect(result.details[0].reason).toBe('idle_timeout');
    });

    it('should cleanup sandboxes exceeding max age', async () => {
      const oldDate = new Date(Date.now() - 86400000); // 24 hours ago
      
      (orchestrationService as any).activeSandboxes.set(testSandboxId, mockSandbox);
      (orchestrationService as any).sandboxMetadata.set(testSandboxId, {
        userId: testUserId,
        projectId: testProjectId,
        createdAt: oldDate,
        lastActivity: new Date()
      });
      
      jest.spyOn(dbService, 'query').mockResolvedValue({ rows: [] });
      
      const result = await orchestrationService.cleanupSandboxes({ maxAge: 43200000 }); // 12 hours max age
      
      expect(result.cleaned).toBe(1);
      expect(result.details[0].reason).toBe('max_age_exceeded');
    });

    it('should cleanup failed deployments', async () => {
      (orchestrationService as any).activeSandboxes.set(testSandboxId, mockSandbox);
      (orchestrationService as any).sandboxMetadata.set(testSandboxId, {
        userId: testUserId,
        projectId: testProjectId,
        createdAt: new Date(),
        lastActivity: new Date()
      });
      
      jest.spyOn(dbService, 'query').mockResolvedValue({
        rows: [{ status: DeploymentStatus.FAILED }]
      });
      
      const result = await orchestrationService.cleanupSandboxes();
      
      expect(result.cleaned).toBe(1);
      expect(result.details[0].reason).toBe('deployment_failed');
    });

    it('should cleanup orphaned sandboxes', async () => {
      (orchestrationService as any).activeSandboxes.set('orphaned-sandbox', mockSandbox);
      // No metadata for this sandbox (orphaned)
      
      const result = await orchestrationService.cleanupSandboxes();
      
      expect(result.cleaned).toBe(1);
      expect(result.details[0].reason).toBe('orphaned');
    });

    it('should handle cleanup errors gracefully', async () => {
      (orchestrationService as any).activeSandboxes.set(testSandboxId, mockSandbox);
      (orchestrationService as any).sandboxMetadata.set(testSandboxId, {
        userId: testUserId,
        projectId: testProjectId,
        createdAt: new Date(Date.now() - 7200000),
        lastActivity: new Date(Date.now() - 7200000)
      });
      
      mockSandbox.kill.mockRejectedValue(new Error('Kill failed'));
      jest.spyOn(dbService, 'query').mockResolvedValue({ rows: [] });
      
      const result = await orchestrationService.cleanupSandboxes({ force: true });
      
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should classify timeout errors correctly', async () => {
      const mockError = new Error('Operation timed out');
      mockError.name = 'TimeoutError';
      
      const result = await orchestrationService.handleErrors(testDeploymentId, mockError, {
        stage: 'building',
        retryCount: 0,
        maxRetries: 3
      });
      
      expect(result.action).toBe('retry');
      expect(result.nextRetryIn).toBeGreaterThan(0);
    });

    it('should abort after max retries', async () => {
      const mockError = new Error('Persistent error');
      
      jest.spyOn(dbService, 'updateDeployment').mockResolvedValue({});
      
      const result = await orchestrationService.handleErrors(testDeploymentId, mockError, {
        stage: 'building',
        retryCount: 3,
        maxRetries: 3
      });
      
      expect(result.action).toBe('abort');
    });

    it('should handle network errors with longer backoff', async () => {
      const mockError = new Error('Network connection failed');
      
      const result = await orchestrationService.handleErrors(testDeploymentId, mockError, {
        stage: 'deploying',
        retryCount: 1,
        maxRetries: 3
      });
      
      expect(result.action).toBe('retry');
      expect(result.nextRetryIn).toBeGreaterThan(1000);
    });
  });

  describe('Statistics and Reporting', () => {
    it('should get execution statistics', async () => {
      mockSandboxClass.list.mockResolvedValue([
        { sandbox_id: 'sb-1', metadata: {}, started_at: new Date(), end_at: new Date() },
        { sandbox_id: 'sb-2', metadata: {}, started_at: new Date(), end_at: new Date() }
      ]);
      
      const stats = await orchestrationService.getExecutionStats();
      
      expect(stats.activeExecutions).toBe(2);
      expect(typeof stats.totalExecutions).toBe('number');
    });

    it('should cancel execution and cleanup resources', async () => {
      jest.spyOn(dbService, 'getDeploymentById').mockResolvedValue({
        id: testDeploymentId,
        project_id: testProjectId,
        status: DeploymentStatus.RUNNING,
        app_sandbox_id: testSandboxId,
        runtime_type: 'template-nodejs-18'
      });
      jest.spyOn(dbService, 'updateDeployment').mockResolvedValue({});
      
      (orchestrationService as any).activeSandboxes.set(testSandboxId, mockSandbox);
      (orchestrationService as any).sandboxMetadata.set(testSandboxId, {
        userId: testUserId,
        projectId: testProjectId,
        createdAt: new Date(),
        lastActivity: new Date()
      });
      
      jest.spyOn(dbService, 'query').mockResolvedValue({ rows: [] });
      
      const result = await orchestrationService.cancelExecution(testDeploymentId);
      
      expect(result).toBe(true);
      expect(dbService.updateDeployment).toHaveBeenCalledWith(
        testDeploymentId,
        { status: DeploymentStatus.DESTROYED }
      );
    });
  });

  describe('Integration with Configuration Service', () => {
    it('should load environment configuration for deployment', async () => {
      jest.spyOn(dbService, 'createDeployment').mockResolvedValue({
        id: testDeploymentId,
        project_id: testProjectId,
        status: DeploymentStatus.PENDING,
        runtime_type: 'template-nodejs-18'
      });
      jest.spyOn(dbService, 'updateDeployment').mockResolvedValue({});
      
      // Mock configuration service
      const mockConfigService = {
        getConfigurationForDeployment: jest.fn().mockResolvedValue({
          variables: {
            NODE_ENV: 'development',
            API_KEY: 'test-key-123',
            DATABASE_URL: 'postgresql://test'
          }
        })
      };
      
      (orchestrationService as any).configService = mockConfigService;
      
      await orchestrationService.deployProject(testUserId, sampleFiles, {
        env: { CUSTOM_VAR: 'custom-value' }
      });
      
      expect(mockConfigService.getConfigurationForDeployment).toHaveBeenCalled();
      expect(mockSandbox.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          envs: expect.objectContaining({
            NODE_ENV: 'development',
            API_KEY: 'test-key-123',
            DATABASE_URL: 'postgresql://test',
            CUSTOM_VAR: 'custom-value' // User config should override
          })
        })
      );
    });
  });
});