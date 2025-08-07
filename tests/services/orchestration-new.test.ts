import { OrchestrationService } from '../../src/services/orchestration';
import { DatabaseService } from '../../src/services/database';
import { ProjectAnalyzer } from '../../src/utils/analyzer';
import { ManifestEngine } from '../../src/services/manifestEngine';
import { DeploymentStatus } from '../../src/types/index';

// Mock AgentSphere SDK
const mockSandbox = {
  files: {
    write: jest.fn().mockResolvedValue(true)
  },
  commands: {
    run: jest.fn().mockResolvedValue({ exitCode: 0, stdout: 'success' })
  },
  getHost: jest.fn().mockResolvedValue('https://test-app.agentsphere.com'),
  destroy: jest.fn().mockResolvedValue(true)
};

jest.mock('agentsphere-js', () => ({
  Sandbox: {
    create: jest.fn().mockResolvedValue(mockSandbox)
  },
  SandboxError: class SandboxError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'SandboxError';
    }
  },
  TimeoutError: class TimeoutError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'TimeoutError';
    }
  },
  NotFoundError: class NotFoundError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'NotFoundError';
    }
  }
}));

// Mock Database Service
const mockDatabaseService = {
  createDeployment: jest.fn().mockResolvedValue({
    id: 'deployment-123',
    project_id: 'project-123',
    status: DeploymentStatus.PENDING,
    created_at: new Date(),
    updated_at: new Date()
  }),
  updateDeployment: jest.fn().mockResolvedValue(true),
  getDeploymentById: jest.fn().mockResolvedValue({
    id: 'deployment-123',
    project_id: 'project-123',
    status: DeploymentStatus.RUNNING,
    public_url: 'https://test-app.agentsphere.com',
    created_at: new Date(),
    updated_at: new Date()
  })
};

jest.mock('../../src/services/database', () => ({
  DatabaseService: {
    getInstance: jest.fn(() => mockDatabaseService)
  }
}));

// Mock ProjectAnalyzer
jest.mock('../../src/utils/analyzer', () => ({
  ProjectAnalyzer: {
    analyzeProject: jest.fn().mockReturnValue({
      projectType: 'nodejs',
      startCommand: 'npm start',
      dependencies: ['express'],
      framework: 'express',
      version: '1.0.0',
      entryPoint: 'index.js'
    })
  }
}));

// Mock ManifestEngine
jest.mock('../../src/services/manifestEngine', () => ({
  ManifestEngine: {
    getInstance: jest.fn(() => ({
      generateProject: jest.fn().mockReturnValue([
        { path: 'package.json', content: '{"name": "test"}' },
        { path: 'index.js', content: 'console.log("test");' }
      ])
    }))
  }
}));

describe('OrchestrationService', () => {
  let orchestrationService: OrchestrationService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton
    (OrchestrationService as any).instance = null;
    orchestrationService = OrchestrationService.getInstance();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = OrchestrationService.getInstance();
      const instance2 = OrchestrationService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should initialize successfully', () => {
      expect(orchestrationService).toBeDefined();
      expect(orchestrationService).toBeInstanceOf(OrchestrationService);
    });
  });

  describe('deployProject', () => {
    const mockDeploymentRequest = {
      projectId: 'project-123',
      userId: 'user-123',
      name: 'Test Project',
      files: [
        { path: 'package.json', content: '{"name": "test", "main": "index.js"}' },
        { path: 'index.js', content: 'console.log("Hello World");' }
      ],
      environment: 'development'
    };

    it('should deploy Node.js project successfully', async () => {
      const result = await orchestrationService.deployProject(mockDeploymentRequest);
      
      expect(result).toBeDefined();
      expect(result.deploymentId).toBe('deployment-123');
      expect(mockDatabaseService.createDeployment).toHaveBeenCalledWith({
        project_id: mockDeploymentRequest.projectId,
        status: DeploymentStatus.PENDING
      });
    });

    it('should handle project analysis failure', async () => {
      (ProjectAnalyzer.analyzeProject as jest.Mock).mockImplementation(() => {
        throw new Error('Analysis failed');
      });

      await expect(orchestrationService.deployProject(mockDeploymentRequest))
        .rejects
        .toThrow('Analysis failed');
    });

    it('should handle sandbox creation failure', async () => {
      const { Sandbox } = require('agentsphere-js');
      Sandbox.create.mockRejectedValueOnce(new Error('Sandbox creation failed'));

      await expect(orchestrationService.deployProject(mockDeploymentRequest))
        .rejects
        .toThrow('Sandbox creation failed');
    });

    it('should deploy Manifest project successfully', async () => {
      const manifestRequest = {
        ...mockDeploymentRequest,
        files: [
          { 
            path: 'manifest.yaml', 
            content: 'name: Test App\nentities:\n  - name: User\n    fields:\n      - name: email\n        type: string' 
          }
        ]
      };

      const result = await orchestrationService.deployProject(manifestRequest);
      
      expect(result).toBeDefined();
      expect(result.deploymentId).toBe('deployment-123');
    });

    it('should handle mixed project (Manifest priority)', async () => {
      const mixedRequest = {
        ...mockDeploymentRequest,
        files: [
          { path: 'package.json', content: '{"name": "test"}' },
          { 
            path: 'manifest.yaml', 
            content: 'name: Test App\nentities:\n  - name: User\n    fields:\n      - name: email\n        type: string' 
          }
        ]
      };

      const result = await orchestrationService.deployProject(mixedRequest);
      
      expect(result).toBeDefined();
      expect(result.deploymentId).toBe('deployment-123');
    });

    it('should create deployment record', async () => {
      await orchestrationService.deployProject(mockDeploymentRequest);
      
      expect(mockDatabaseService.createDeployment).toHaveBeenCalledWith({
        project_id: mockDeploymentRequest.projectId,
        status: DeploymentStatus.PENDING
      });
    });

    it('should update deployment status correctly', async () => {
      await orchestrationService.deployProject(mockDeploymentRequest);
      
      // Should update status during deployment process
      expect(mockDatabaseService.updateDeployment).toHaveBeenCalledWith(
        'deployment-123',
        expect.objectContaining({
          status: expect.any(String)
        })
      );
    });
  });

  describe('stopDeployment', () => {
    it('should stop running deployment', async () => {
      mockDatabaseService.getDeploymentById.mockResolvedValueOnce({
        id: 'deployment-123',
        status: DeploymentStatus.RUNNING,
        app_sandbox_id: 'sandbox-123'
      });

      const result = await orchestrationService.stopDeployment('deployment-123');
      
      expect(result.success).toBe(true);
      expect(mockDatabaseService.updateDeployment).toHaveBeenCalledWith(
        'deployment-123',
        expect.objectContaining({
          status: DeploymentStatus.STOPPED
        })
      );
    });

    it('should handle non-existent deployment', async () => {
      mockDatabaseService.getDeploymentById.mockResolvedValueOnce(null);

      await expect(orchestrationService.stopDeployment('non-existent'))
        .rejects
        .toThrow('Deployment not found');
    });

    it('should cleanup sandbox resources', async () => {
      mockDatabaseService.getDeploymentById.mockResolvedValueOnce({
        id: 'deployment-123',
        status: DeploymentStatus.RUNNING,
        app_sandbox_id: 'sandbox-123'
      });

      await orchestrationService.stopDeployment('deployment-123');
      
      // Should call sandbox cleanup/destroy
      expect(mockSandbox.destroy).toHaveBeenCalled();
    });
  });

  describe('getDeploymentStatus', () => {
    it('should return deployment status', async () => {
      const expectedDeployment = {
        id: 'deployment-123',
        status: DeploymentStatus.RUNNING,
        public_url: 'https://test-app.agentsphere.com'
      };
      mockDatabaseService.getDeploymentById.mockResolvedValueOnce(expectedDeployment);

      const result = await orchestrationService.getDeploymentStatus('deployment-123');
      
      expect(result).toEqual(expectedDeployment);
      expect(mockDatabaseService.getDeploymentById).toHaveBeenCalledWith('deployment-123');
    });

    it('should handle non-existent deployment', async () => {
      mockDatabaseService.getDeploymentById.mockResolvedValueOnce(null);

      const result = await orchestrationService.getDeploymentStatus('non-existent');
      
      expect(result).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle deployment timeout', async () => {
      const { TimeoutError } = require('agentsphere-js');
      const { Sandbox } = require('agentsphere-js');
      Sandbox.create.mockRejectedValueOnce(new TimeoutError('Deployment timeout'));

      await expect(orchestrationService.deployProject({
        projectId: 'project-123',
        userId: 'user-123',
        name: 'Test Project',
        files: [{ path: 'index.js', content: 'console.log("test");' }],
        timeout: 1000 // 1 second timeout
      })).rejects.toThrow('Deployment timeout');
    });

    it('should handle manifest generation failure', async () => {
      const mockManifestEngine = ManifestEngine.getInstance();
      (mockManifestEngine.generateProject as jest.Mock).mockImplementation(() => {
        throw new Error('Manifest generation failed');
      });

      const manifestRequest = {
        projectId: 'project-123',
        userId: 'user-123',
        name: 'Test Project',
        files: [
          { 
            path: 'manifest.yaml', 
            content: 'invalid manifest content' 
          }
        ]
      };

      await expect(orchestrationService.deployProject(manifestRequest))
        .rejects
        .toThrow('Manifest generation failed');
    });
  });

  describe('Health and Monitoring', () => {
    it('should report service health', () => {
      const health = orchestrationService.getHealthStatus();
      
      expect(health).toBeDefined();
      expect(health.status).toBe('healthy');
      expect(health.activeSandboxes).toBeDefined();
    });

    it('should track active sandboxes', async () => {
      const beforeCount = orchestrationService.getHealthStatus().activeSandboxes;
      
      await orchestrationService.deployProject({
        projectId: 'project-123',
        userId: 'user-123',
        name: 'Test Project',
        files: [{ path: 'index.js', content: 'console.log("test");' }]
      });
      
      const afterCount = orchestrationService.getHealthStatus().activeSandboxes;
      expect(afterCount).toBeGreaterThanOrEqual(beforeCount);
    });
  });
});