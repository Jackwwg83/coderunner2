import request from 'supertest';
import express from 'express';
import deployRoutes from '../../src/routes/deploy';
import { DatabaseService } from '../../src/services/database';
import { OrchestrationService } from '../../src/services/orchestration';
import jwt from 'jsonwebtoken';

// Mock dependencies
jest.mock('../../src/services/database');
jest.mock('../../src/services/orchestration');

describe('Deploy Routes', () => {
  let app: express.Application;
  let mockDb: jest.Mocked<DatabaseService>;
  let mockOrchestration: jest.Mocked<OrchestrationService>;
  let testToken: string;

  const testUser = {
    userId: 'test-user-id',
    email: 'test@example.com',
    plan: 'free'
  };

  beforeAll(() => {
    // Create test JWT token
    testToken = jwt.sign(testUser, process.env.JWT_SECRET || 'test-secret');
  });

  beforeEach(() => {
    // Create Express app with deploy routes
    app = express();
    app.use(express.json());
    app.use('/api/deploy', deployRoutes);

    // Clear mocks
    jest.clearAllMocks();

    // Mock DatabaseService
    mockDb = {
      getInstance: jest.fn(),
      getProjectsByUserId: jest.fn(),
      getProjectById: jest.fn(),
      createProject: jest.fn(),
      getDeploymentsByProjectId: jest.fn(),
      getDeploymentById: jest.fn(),
      getUserById: jest.fn(),
    } as any;

    (DatabaseService.getInstance as jest.Mock).mockReturnValue(mockDb);

    // Mock OrchestrationService
    mockOrchestration = {
      getInstance: jest.fn(),
      deployProject: jest.fn(),
      monitorDeployment: jest.fn(),
      cancelExecution: jest.fn(),
    } as any;

    (OrchestrationService.getInstance as jest.Mock).mockReturnValue(mockOrchestration);

    // Mock user lookup for auth middleware
    mockDb.getUserById.mockResolvedValue({
      id: testUser.userId,
      email: testUser.email,
      plan_type: testUser.plan
    });
  });

  describe('GET /api/deploy/projects', () => {
    test('should get user projects successfully', async () => {
      const mockProjects = [
        {
          id: 'project-1',
          name: 'Test Project',
          user_id: testUser.userId,
          created_at: new Date()
        }
      ];

      mockDb.getProjectsByUserId.mockResolvedValue(mockProjects);

      const response = await request(app)
        .get('/api/deploy/projects')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockProjects);
      expect(mockDb.getProjectsByUserId).toHaveBeenCalledWith(testUser.userId);
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/deploy/projects');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/deploy/project', () => {
    test('should create project successfully', async () => {
      const projectData = {
        name: 'New Project',
        description: 'Test project'
      };

      const mockProject = {
        id: 'new-project-id',
        ...projectData,
        user_id: testUser.userId,
        created_at: new Date()
      };

      mockDb.createProject.mockResolvedValue(mockProject);

      const response = await request(app)
        .post('/api/deploy/project')
        .set('Authorization', `Bearer ${testToken}`)
        .send(projectData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockProject);
    });

    test('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/deploy/project')
        .set('Authorization', `Bearer ${testToken}`)
        .send({}); // Missing name

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('name');
    });
  });

  describe('POST /api/deploy/project/:projectId', () => {
    test('should deploy project successfully', async () => {
      const projectId = 'test-project-id';
      const deploymentData = {
        files: [
          { path: 'index.js', content: 'console.log("Hello");' }
        ],
        config: {
          env: { NODE_ENV: 'production' }
        }
      };

      const mockProject = {
        id: projectId,
        user_id: testUser.userId,
        name: 'Test Project'
      };

      const mockDeploymentResult = {
        id: 'deployment-id',
        projectId,
        url: 'https://test-app.com',
        sandboxId: 'sandbox-id',
        status: 'running'
      };

      mockDb.getProjectById.mockResolvedValue(mockProject);
      mockOrchestration.deployProject.mockResolvedValue(mockDeploymentResult);

      const response = await request(app)
        .post(`/api/deploy/project/${projectId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(deploymentData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockDeploymentResult);
      
      expect(mockOrchestration.deployProject).toHaveBeenCalledWith(
        testUser.userId,
        deploymentData.files,
        deploymentData.config
      );
    });

    test('should handle unauthorized project access', async () => {
      const projectId = 'unauthorized-project';
      const mockProject = {
        id: projectId,
        user_id: 'different-user-id', // Different user
        name: 'Test Project'
      };

      mockDb.getProjectById.mockResolvedValue(mockProject);

      const response = await request(app)
        .post(`/api/deploy/project/${projectId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          files: [{ path: 'index.js', content: 'test' }]
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    test('should handle project not found', async () => {
      const projectId = 'non-existent-project';
      mockDb.getProjectById.mockResolvedValue(null);

      const response = await request(app)
        .post(`/api/deploy/project/${projectId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          files: [{ path: 'index.js', content: 'test' }]
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/deploy/deployment/:deploymentId/status', () => {
    test('should get deployment status successfully', async () => {
      const deploymentId = 'test-deployment-id';
      const mockDeployment = {
        id: deploymentId,
        project_id: 'project-id',
        status: 'running'
      };

      const mockProject = {
        id: 'project-id',
        user_id: testUser.userId,
        name: 'Test Project'
      };

      const mockStatus = {
        status: 'running',
        health: 'healthy',
        metrics: {
          uptime: 3600000,
          memoryUsage: 128,
          cpuUsage: 45
        },
        logs: ['App started', 'Listening on port 3000']
      };

      mockDb.getDeploymentById.mockResolvedValue(mockDeployment);
      mockDb.getProjectById.mockResolvedValue(mockProject);
      mockOrchestration.monitorDeployment.mockResolvedValue(mockStatus);

      const response = await request(app)
        .get(`/api/deploy/deployment/${deploymentId}/status`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStatus);
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors', async () => {
      mockDb.getProjectsByUserId.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/deploy/projects')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });
});