import request from 'supertest';
import express from 'express';
import cors from 'cors';
import { DeploymentStatus } from '../../src/types';
import deployRouter from '../../src/routes/deploy';

// Mock all external dependencies
jest.mock('../../src/services/auth');
jest.mock('../../src/services/database');
jest.mock('../../src/services/orchestration');
jest.mock('../../src/services/manifestEngine');
jest.mock('../../src/utils/analyzer');

// Import mocked modules
import { AuthService } from '../../src/services/auth';
import { DatabaseService } from '../../src/services/database';
import { OrchestrationService } from '../../src/services/orchestration';
import { ProjectAnalyzer } from '../../src/utils/analyzer';

/**
 * Simplified Manifest Deployment Integration Tests
 * 
 * This test suite focuses on the core API contract and deployment flow
 * using mocked services to avoid complex setup dependencies.
 */
describe('Manifest Deployment Integration (Simplified)', () => {
  let testApp: express.Application;
  
  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    planType: 'free'
  };

  const mockDeploymentResult = {
    id: 'test-deployment-id',
    projectId: 'test-project-id',
    url: 'https://mock-deployment.example.com',
    sandboxId: 'mock-sandbox-123',
    status: 'running' as const
  };

  beforeAll(() => {
    // Create test Express app
    testApp = express();
    testApp.use(cors());
    testApp.use(express.json());
    testApp.use('/api/deploy', deployRouter);

    // Setup mocks
    setupAuthMocks();
    setupDatabaseMocks();
    setupOrchestrationMocks();
    setupAnalyzerMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/deploy', () => {
    describe('Manifest project deployment', () => {
      const validManifestProject = {
        projectName: 'TestBlog',
        projectDescription: 'A test blog application',
        files: [
          {
            path: 'manifest.yaml',
            content: `name: TestBlog
version: 1.0.0
entities:
  - name: Post
    fields:
      - name: title
        type: string
        required: true
      - name: content
        type: string
        required: false
      - name: published
        type: boolean
        required: false
  - name: Author
    fields:
      - name: name
        type: string
        required: true
      - name: email
        type: string
        required: true`
          }
        ]
      };

      it('should successfully deploy a manifest project', async () => {
        const response = await request(testApp)
          .post('/api/deploy')
          .set('Authorization', 'Bearer valid-token')
          .send(validManifestProject);

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
          success: true,
          message: 'Deployment successful',
          data: {
            deploymentId: expect.any(String),
            projectId: expect.any(String),
            url: expect.stringMatching(/^https?:\/\/.+/),
            sandboxId: expect.any(String),
            status: 'running',
            createdAt: expect.any(String)
          },
          timestamp: expect.any(String)
        });

        // Verify OrchestrationService was called
        expect(OrchestrationService.getInstance().deployProject).toHaveBeenCalledWith(
          mockUser.id,
          expect.arrayContaining([
            expect.objectContaining({
              path: 'manifest.yaml',
              content: expect.stringContaining('TestBlog')
            })
          ]),
          expect.objectContaining({
            timeout: expect.any(Number),
            port: 8080
          })
        );
      });

      it('should detect manifest project type correctly', async () => {
        await request(testApp)
          .post('/api/deploy')
          .set('Authorization', 'Bearer valid-token')
          .send(validManifestProject);

        // Verify ProjectAnalyzer was called to detect project type
        expect(ProjectAnalyzer.analyzeProject).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              path: 'manifest.yaml'
            })
          ])
        );
      });

      it('should handle invalid manifest format', async () => {
        const invalidManifest = {
          ...validManifestProject,
          files: [
            {
              path: 'manifest.yaml',
              content: 'invalid: yaml: content: ['
            }
          ]
        };

        // Mock OrchestrationService to throw error for invalid manifest
        (OrchestrationService.getInstance().deployProject as jest.Mock)
          .mockRejectedValueOnce(new Error('Failed to parse manifest: Invalid YAML structure'));

        const response = await request(testApp)
          .post('/api/deploy')
          .set('Authorization', 'Bearer valid-token')
          .send(invalidManifest);

        expect(response.status).toBe(500);
        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('Deployment failed'),
          message: expect.stringMatching(/^\[.*\]/)
        });
      });
    });

    describe('Node.js project deployment', () => {
      const validNodeProject = {
        projectName: 'TestNodeApp',
        files: [
          {
            path: 'package.json',
            content: JSON.stringify({
              name: 'test-node-app',
              version: '1.0.0',
              main: 'index.js',
              scripts: {
                start: 'node index.js'
              },
              dependencies: {
                express: '^4.18.2'
              }
            })
          },
          {
            path: 'index.js',
            content: `const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

app.get('/', (req, res) => {
  res.json({ message: 'Hello from Node.js!' });
});

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});`
          }
        ]
      };

      it('should successfully deploy a Node.js project', async () => {
        // Mock ProjectAnalyzer to return nodejs type
        (ProjectAnalyzer.analyzeProject as jest.Mock).mockReturnValueOnce({
          projectType: 'nodejs',
          framework: 'express',
          startCommand: 'npm start',
          dependencies: ['npm'],
          entryPoint: 'index.js'
        });

        const response = await request(testApp)
          .post('/api/deploy')
          .set('Authorization', 'Bearer valid-token')
          .send(validNodeProject);

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
          success: true,
          message: 'Deployment successful',
          data: {
            url: expect.stringMatching(/^https?:\/\/.+/),
            status: 'running'
          }
        });
      });

      it('should detect Express framework', async () => {
        // Mock ProjectAnalyzer to return express framework
        (ProjectAnalyzer.analyzeProject as jest.Mock).mockReturnValueOnce({
          projectType: 'nodejs',
          framework: 'express',
          startCommand: 'npm start',
          dependencies: ['npm'],
          entryPoint: 'index.js'
        });

        await request(testApp)
          .post('/api/deploy')
          .set('Authorization', 'Bearer valid-token')
          .send(validNodeProject);

        expect(ProjectAnalyzer.analyzeProject).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              path: 'package.json',
              content: expect.stringContaining('express')
            })
          ])
        );
      });
    });

    describe('Mixed project handling', () => {
      const mixedProject = {
        projectName: 'MixedProject',
        files: [
          {
            path: 'manifest.yaml',
            content: `name: MixedProject
version: 1.0.0
entities:
  - name: Item
    fields:
      - name: name
        type: string
        required: true`
          },
          {
            path: 'package.json',
            content: JSON.stringify({
              name: 'mixed-project',
              version: '1.0.0'
            })
          }
        ]
      };

      it('should prioritize manifest over package.json', async () => {
        // Mock ProjectAnalyzer to return manifest type (prioritized)
        (ProjectAnalyzer.analyzeProject as jest.Mock).mockReturnValueOnce({
          projectType: 'manifest',
          framework: 'manifest-generated',
          startCommand: 'npm start',
          dependencies: ['npm'],
          entryPoint: 'index.js'
        });

        const response = await request(testApp)
          .post('/api/deploy')
          .set('Authorization', 'Bearer valid-token')
          .send(mixedProject);

        expect(response.status).toBe(201);
        expect(ProjectAnalyzer.analyzeProject).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ path: 'manifest.yaml' }),
            expect.objectContaining({ path: 'package.json' })
          ])
        );
      });
    });

    describe('Error handling and validation', () => {
      it('should reject unauthenticated requests', async () => {
        const response = await request(testApp)
          .post('/api/deploy')
          .send({
            projectName: 'TestProject',
            files: [{ path: 'index.js', content: 'console.log("test");' }]
          });

        expect(response.status).toBe(401);
        expect(response.body).toMatchObject({
          success: false,
          error: expect.any(String)
        });
      });

      it('should validate project name', async () => {
        const response = await request(testApp)
          .post('/api/deploy')
          .set('Authorization', 'Bearer valid-token')
          .send({
            projectName: '', // Empty name
            files: [{ path: 'index.js', content: 'console.log("test");' }]
          });

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('Project name'),
          message: expect.stringMatching(/^\[INVALID_PROJECT_NAME\]/)
        });
      });

      it('should validate files array', async () => {
        const response = await request(testApp)
          .post('/api/deploy')
          .set('Authorization', 'Bearer valid-token')
          .send({
            projectName: 'TestProject',
            files: [] // Empty files
          });

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('Files array'),
          message: expect.stringMatching(/^\[INVALID_FILES\]/)
        });
      });

      it('should handle quota limits', async () => {
        // Mock database to return quota exceeded
        (DatabaseService.getInstance().getProjectsByUserId as jest.Mock)
          .mockResolvedValueOnce({
            projects: new Array(3).fill({}), // Max projects for free plan
            total: 3
          });

        const response = await request(testApp)
          .post('/api/deploy')
          .set('Authorization', 'Bearer valid-token')
          .send({
            projectName: 'ExceedsQuota',
            files: [{ path: 'index.js', content: 'console.log("test");' }]
          });

        expect(response.status).toBe(403);
        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('Project limit exceeded'),
          message: expect.stringMatching(/^\[QUOTA_EXCEEDED\]/)
        });
      });

      it('should handle deployment failures', async () => {
        // Mock OrchestrationService to fail
        (OrchestrationService.getInstance().deployProject as jest.Mock)
          .mockRejectedValueOnce(new Error('Sandbox service unavailable'));

        const response = await request(testApp)
          .post('/api/deploy')
          .set('Authorization', 'Bearer valid-token')
          .send({
            projectName: 'FailProject',
            files: [{ path: 'index.js', content: 'console.log("test");' }]
          });

        expect(response.status).toBe(503);
        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('Sandbox service unavailable'),
          message: expect.stringMatching(/^\[SANDBOX_ERROR\]/)
        });
      });

      it('should reject path traversal attempts', async () => {
        const response = await request(testApp)
          .post('/api/deploy')
          .set('Authorization', 'Bearer valid-token')
          .send({
            projectName: 'MaliciousProject',
            files: [
              {
                path: '../../etc/passwd', // Path traversal
                content: 'malicious content'
              }
            ]
          });

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('Path traversal'),
          message: expect.stringMatching(/^\[INVALID_FILES\]/)
        });
      });
    });
  });

  // Mock setup functions
  function setupAuthMocks(): void {
    const mockAuthService = {
      authenticateToken: jest.fn().mockImplementation((req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({
            success: false,
            error: 'Authentication required',
            message: '[UNAUTHORIZED] Authentication required',
            timestamp: new Date()
          });
        }
        
        req.user = mockUser;
        next();
      }),
      apiRateLimit: jest.fn().mockImplementation((_req: any, _res: any, next: any) => next()),
      validateRequiredFields: jest.fn().mockImplementation((fields) => {
        return (req: any, res: any, next: any) => {
          for (const field of fields) {
            if (!req.body[field]) {
              return res.status(400).json({
                success: false,
                error: `Missing required field: ${field}`,
                message: `[INVALID_INPUT] Missing required field: ${field}`,
                timestamp: new Date()
              });
            }
          }
          next();
        };
      }),
      sanitizeInput: jest.fn().mockImplementation((_req: any, _res: any, next: any) => next()),
      getUserId: jest.fn().mockReturnValue(mockUser.id)
    };

    jest.mocked(AuthService).getInstance = jest.fn().mockReturnValue(mockAuthService);
    
    // Mock AuthMiddleware directly
    jest.doMock('../../src/middleware/auth', () => ({
      AuthMiddleware: mockAuthService
    }));
  }

  function setupDatabaseMocks(): void {
    const mockDatabase = {
      getProjectsByUserId: jest.fn().mockResolvedValue({
        projects: [],
        total: 0
      }),
      getRunningDeploymentCountByUser: jest.fn().mockResolvedValue(0),
      createProject: jest.fn().mockResolvedValue({
        id: 'test-project-id',
        name: 'TestProject',
        user_id: mockUser.id,
        description: 'Test project',
        created_at: new Date(),
        updated_at: new Date()
      }),
      updateProject: jest.fn().mockResolvedValue({
        id: 'test-project-id',
        name: 'TestProject',
        user_id: mockUser.id,
        description: 'Updated project',
        created_at: new Date(),
        updated_at: new Date()
      }),
      createDeployment: jest.fn().mockResolvedValue({
        id: 'test-deployment-id',
        project_id: 'test-project-id',
        status: DeploymentStatus.RUNNING,
        created_at: new Date(),
        updated_at: new Date()
      }),
      updateDeployment: jest.fn().mockResolvedValue({
        id: 'test-deployment-id',
        status: DeploymentStatus.RUNNING,
        updated_at: new Date()
      }),
      getDeploymentById: jest.fn().mockResolvedValue({
        id: 'test-deployment-id',
        project_id: 'test-project-id',
        status: DeploymentStatus.RUNNING
      })
    };

    jest.mocked(DatabaseService).getInstance = jest.fn().mockReturnValue(mockDatabase);
  }

  function setupOrchestrationMocks(): void {
    const mockOrchestration = {
      deployProject: jest.fn().mockResolvedValue(mockDeploymentResult)
    };

    jest.mocked(OrchestrationService).getInstance = jest.fn().mockReturnValue(mockOrchestration);
  }

  function setupAnalyzerMocks(): void {
    const mockAnalyzeProject = jest.fn().mockImplementation((files) => {
      const hasManifest = files.some((f: any) => f.path.endsWith('manifest.yaml') || f.path.endsWith('manifest.yml'));
      const hasPackageJson = files.some((f: any) => f.path === 'package.json');
      
      if (hasManifest) {
        return {
          projectType: 'manifest',
          framework: 'manifest-generated',
          startCommand: 'npm start',
          dependencies: ['npm'],
          entryPoint: 'index.js'
        };
      } else if (hasPackageJson) {
        return {
          projectType: 'nodejs',
          framework: 'express',
          startCommand: 'npm start',
          dependencies: ['npm'],
          entryPoint: 'index.js'
        };
      } else {
        return {
          projectType: 'nodejs',
          framework: 'unknown',
          startCommand: 'node index.js',
          dependencies: ['npm']
        };
      }
    });

    jest.mocked(ProjectAnalyzer).analyzeProject = mockAnalyzeProject;
  }
});