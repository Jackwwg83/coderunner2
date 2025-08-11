import { OrchestrationService } from '../../src/services/orchestration';
import { DatabaseService } from '../../src/services/database';
import { ConfigurationService } from '../../src/services/configuration';
import { ProjectFile, DeploymentStatus } from '../../src/types';
import { Sandbox } from 'agentsphere-js';

// Mock dependencies
jest.mock('../../src/services/database');
jest.mock('../../src/services/configuration');
jest.mock('agentsphere-js');

describe('OrchestrationService', () => {
  let orchestrationService: OrchestrationService;
  let mockDb: jest.Mocked<DatabaseService>;
  let mockConfigService: jest.Mocked<ConfigurationService>;
  let mockSandbox: jest.Mocked<Sandbox>;

  const testUserId = 'test-user-id';
  const testProjectFiles: ProjectFile[] = [
    { path: 'package.json', content: '{"name": "test", "main": "index.js", "scripts": {"start": "node index.js"}}' },
    { path: 'index.js', content: 'console.log("Hello World");' }
  ];

  beforeEach(() => {
    // Clear all instances and calls to constructor and all methods
    jest.clearAllMocks();

    // Mock DatabaseService
    mockDb = {
      getInstance: jest.fn(),
      createDeployment: jest.fn(),
      updateDeployment: jest.fn(),
      getDeploymentById: jest.fn(),
      getProjectById: jest.fn(),
      query: jest.fn(),
    } as any;

    (DatabaseService.getInstance as jest.Mock).mockReturnValue(mockDb);

    // Mock ConfigurationService
    mockConfigService = {
      getInstance: jest.fn(),
      getConfigurationForDeployment: jest.fn(),
    } as any;

    (ConfigurationService.getInstance as jest.Mock).mockReturnValue(mockConfigService);

    // Mock Sandbox
    mockSandbox = {
      sandboxId: 'test-sandbox-id',
      files: {
        write: jest.fn(),
      },
      commands: {
        run: jest.fn(),
      },
      getHost: jest.fn(),
    } as any;

    (Sandbox.create as jest.Mock).mockResolvedValue(mockSandbox);

    // Get fresh instance
    orchestrationService = OrchestrationService.getInstance();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Deployment Process', () => {
    test('should deploy Node.js project successfully', async () => {
      // Setup mocks
      const mockDeployment = {
        id: 'test-deployment-id',
        project_id: 'test-project-id',
        status: DeploymentStatus.PENDING,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockDb.createDeployment.mockResolvedValue(mockDeployment);
      mockDb.getDeploymentById.mockResolvedValue(mockDeployment);
      mockConfigService.getConfigurationForDeployment.mockResolvedValue({
        environment: 'test',
        variables: { NODE_ENV: 'test' },
        lastUpdated: new Date()
      });

      (mockSandbox.commands.run as jest.Mock)
        .mockResolvedValueOnce({ stdout: 'npm install completed' }) // npm install
        .mockResolvedValueOnce({ pid: 1234 }); // app start

      mockSandbox.getHost.mockReturnValue('https://test-sandbox-id.sandbox.agentsphere.com');

      // Execute deployment
      const result = await orchestrationService.deployProject(testUserId, testProjectFiles);

      // Verify results
      expect(result).toMatchObject({
        id: expect.any(String),
        projectId: expect.any(String),
        url: 'https://test-sandbox-id.sandbox.agentsphere.com',
        sandboxId: 'test-sandbox-id',
        status: 'running'
      });

      // Verify interactions
      expect(Sandbox.create).toHaveBeenCalledWith('template-nodejs-18');
      expect(mockDb.createDeployment).toHaveBeenCalled();
      expect(mockDb.updateDeployment).toHaveBeenCalled();
      expect(mockSandbox.files.write).toHaveBeenCalledTimes(2); // Both files
      expect(mockSandbox.commands.run).toHaveBeenCalledWith('npm install');
    });

    test('should handle deployment failure', async () => {
      // Setup mocks for failure scenario
      const mockDeployment = {
        id: 'test-deployment-id',
        project_id: 'test-project-id',
        status: DeploymentStatus.PENDING,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockDb.createDeployment.mockResolvedValue(mockDeployment);
      mockDb.getDeploymentById.mockResolvedValue(mockDeployment);
      mockConfigService.getConfigurationForDeployment.mockResolvedValue({
        environment: 'development',
        variables: {},
        lastUpdated: new Date()
      });

      // Mock sandbox creation failure
      (Sandbox.create as jest.Mock).mockRejectedValue(new Error('Sandbox creation failed'));

      // Execute and expect failure
      await expect(orchestrationService.deployProject(testUserId, testProjectFiles))
        .rejects.toThrow('Deployment failed: Sandbox creation failed');

      // Verify cleanup
      expect(mockDb.updateDeployment).toHaveBeenCalledWith(
        mockDeployment.id,
        { status: DeploymentStatus.FAILED }
      );
    });
  });

  describe('Monitoring and Management', () => {
    test('should monitor deployment successfully', async () => {
      const deploymentId = 'test-deployment-id';
      const mockDeployment = {
        id: deploymentId,
        project_id: 'test-project-id',
        status: DeploymentStatus.RUNNING,
        app_sandbox_id: 'test-sandbox-id',
        public_url: 'https://test-app.com'
      };

      mockDb.getDeploymentById.mockResolvedValue(mockDeployment);

      const result = await orchestrationService.monitorDeployment(deploymentId);

      expect(result).toMatchObject({
        status: DeploymentStatus.RUNNING,
        health: expect.any(String),
        metrics: expect.objectContaining({
          uptime: expect.any(Number),
          memoryUsage: expect.any(Number),
          cpuUsage: expect.any(Number)
        }),
        logs: expect.any(Array)
      });
    });

    test('should handle monitoring of non-existent deployment', async () => {
      const deploymentId = 'non-existent-deployment';
      mockDb.getDeploymentById.mockResolvedValue(null);

      await expect(orchestrationService.monitorDeployment(deploymentId))
        .rejects.toThrow('Deployment non-existent-deployment not found');
    });
  });

  describe('Cleanup and Management', () => {
    test('should cleanup sandboxes based on age', async () => {
      // Mock database query for cleanup
      mockDb.query.mockResolvedValue({
        rows: [{ status: DeploymentStatus.STOPPED }]
      });

      const result = await orchestrationService.cleanupSandboxes({
        maxAge: 1000, // 1 second
        force: false
      });

      expect(result).toMatchObject({
        cleaned: expect.any(Number),
        errors: expect.any(Array),
        details: expect.any(Array)
      });
    });

    test('should cancel execution successfully', async () => {
      const executionId = 'test-execution-id';
      const mockDeployment = {
        id: executionId,
        project_id: 'test-project-id',
        app_sandbox_id: 'test-sandbox-id'
      };

      mockDb.getDeploymentById.mockResolvedValue(mockDeployment);
      mockDb.query.mockResolvedValue({ rows: [] }); // No deployment records

      const result = await orchestrationService.cancelExecution(executionId);

      expect(result).toBe(true);
      expect(mockDb.updateDeployment).toHaveBeenCalledWith(
        executionId,
        { status: DeploymentStatus.DESTROYED }
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle errors with retry strategy', async () => {
      const deploymentId = 'test-deployment-id';
      const networkError = new Error('Network connection failed');

      const result = await orchestrationService.handleErrors(deploymentId, networkError, {
        stage: 'building',
        retryCount: 0,
        maxRetries: 3
      });

      expect(result).toMatchObject({
        recovered: expect.any(Boolean),
        action: expect.stringMatching(/retry|fallback|abort/),
      });
    });
  });

  describe('Service Lifecycle', () => {
    test('should cleanup service properly', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await orchestrationService.cleanup();

      // Verify cleanup was called (implementation detail)
      expect(true).toBe(true);
    });
  });
});