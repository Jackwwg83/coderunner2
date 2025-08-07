import request from 'supertest';
import { Express } from 'express';
import { app } from '../../src/index';
import { AuthService } from '../../src/services/auth';
import { DatabaseService } from '../../src/services/database';
import { OrchestrationService } from '../../src/services/orchestration';
// import { ManifestEngine } from '../../src/services/manifestEngine';
import { ProjectAnalyzer } from '../../src/utils/analyzer';
import { DeploymentStatus } from '../../src/types';

/**
 * Manifest Deployment Integration Tests
 * 
 * Tests the complete end-to-end deployment flow for Manifest projects,
 * including project type detection, code generation, and deployment orchestration.
 */
describe('Manifest Deployment Integration', () => {
  let testApp: Express;
  let authService: AuthService;
  let db: DatabaseService;
  let orchestrationService: OrchestrationService;
  // let manifestEngine: ManifestEngine;
  
  // Test user accounts for different plan types
  let freeUserToken: string;
  let personalUserToken: string;
  let freeUserId: string;
  // let personalUserId: string;

  // Mock data for OrchestrationService to avoid real sandbox creation
  const mockDeploymentResult = {
    id: 'test-deployment-id',
    projectId: 'test-project-id',
    url: 'https://mock-deployment.example.com',
    sandboxId: 'mock-sandbox-123',
    status: 'running' as const
  };

  beforeAll(async () => {
    // Initialize services
    testApp = app;
    authService = AuthService.getInstance();
    db = DatabaseService.getInstance();
    orchestrationService = OrchestrationService.getInstance();
    // manifestEngine = ManifestEngine.getInstance();

    // Create test users for different plan types
    await createTestUsers();

    // Mock OrchestrationService to avoid real sandbox creation
    setupOrchestrationMocks();
  });

  beforeEach(() => {
    // Clear all mocks between tests
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Cleanup test users and close connections
    await cleanupTestData();
  });

  describe('POST /api/deploy', () => {
    describe('Manifest projects', () => {
      const validManifestProject = {
        projectName: 'TestBlog',
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

      it('should deploy manifest project successfully', async () => {
        const response = await request(testApp)
          .post('/api/deploy')
          .set('Authorization', `Bearer ${freeUserToken}`)
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
          }
        });

        // Verify OrchestrationService was called with correct parameters
        expect(orchestrationService.deployProject).toHaveBeenCalledWith(
          freeUserId,
          expect.any(Array), // Generated files array
          expect.objectContaining({
            timeout: expect.any(Number),
            port: 3000
          })
        );

        // Verify that project analysis detected manifest type
        const deployCall = (orchestrationService.deployProject as jest.Mock).mock.calls[0];
        const files = deployCall[1];
        
        // Should contain both user files and generated files
        expect(files).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ path: 'manifest.yaml' }),
            expect.objectContaining({ path: 'package.json' }),
            expect.objectContaining({ path: 'index.js' }),
            expect.objectContaining({ path: 'database.js' })
          ])
        );
      });

      it('should generate correct API endpoints from manifest', async () => {
        // Deploy the project
        const response = await request(testApp)
          .post('/api/deploy')
          .set('Authorization', `Bearer ${freeUserToken}`)
          .send(validManifestProject);

        expect(response.status).toBe(201);

        // Verify generated Express code contains expected endpoints
        const deployCall = (orchestrationService.deployProject as jest.Mock).mock.calls[0];
        const files = deployCall[1];
        const indexFile = files.find((f: any) => f.path === 'index.js');
        
        expect(indexFile.content).toContain('GET /api/posts');
        expect(indexFile.content).toContain('POST /api/posts');
        expect(indexFile.content).toContain('GET /api/authors');
        expect(indexFile.content).toContain('POST /api/authors');
        expect(indexFile.content).toContain('PUT /api/posts/:id');
        expect(indexFile.content).toContain('DELETE /api/posts/:id');
      });

      it('should handle invalid manifest format', async () => {
        const invalidManifestProject = {
          projectName: 'InvalidProject',
          files: [
            {
              path: 'manifest.yaml',
              content: `invalid yaml content: [unclosed bracket
                name: broken
                entities:`
            }
          ]
        };

        const response = await request(testApp)
          .post('/api/deploy')
          .set('Authorization', `Bearer ${freeUserToken}`)
          .send(invalidManifestProject);

        expect(response.status).toBe(500);
        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('Deployment failed'),
          message: expect.stringMatching(/^\[.*\]/),
          timestamp: expect.any(String)
        });
      });

      it('should handle manifest with missing required fields', async () => {
        const incompleteManifestProject = {
          projectName: 'IncompleteProject',
          files: [
            {
              path: 'manifest.yaml',
              content: `version: 1.0.0
entities:
  - name: Post
    fields: []`
            }
          ]
        };

        const response = await request(testApp)
          .post('/api/deploy')
          .set('Authorization', `Bearer ${freeUserToken}`)
          .send(incompleteManifestProject);

        expect(response.status).toBe(500);
        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('Deployment failed'),
          message: expect.stringMatching(/^\[.*\]/),
          timestamp: expect.any(String)
        });
      });

      it('should validate manifest field types', async () => {
        const invalidFieldsProject = {
          projectName: 'InvalidFieldsProject',
          files: [
            {
              path: 'manifest.yaml',
              content: `name: InvalidFields
version: 1.0.0
entities:
  - name: Post
    fields:
      - name: title
        type: invalid_type
        required: true`
            }
          ]
        };

        const response = await request(testApp)
          .post('/api/deploy')
          .set('Authorization', `Bearer ${freeUserToken}`)
          .send(invalidFieldsProject);

        expect(response.status).toBe(500);
        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('Deployment failed')
        });
      });
    });

    describe('Node.js projects', () => {
      const validNodeJsProject = {
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
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({ message: 'Hello from Node.js!' });
});

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});`
          }
        ]
      };

      it('should deploy Node.js project successfully', async () => {
        const response = await request(testApp)
          .post('/api/deploy')
          .set('Authorization', `Bearer ${freeUserToken}`)
          .send(validNodeJsProject);

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
          success: true,
          message: 'Deployment successful',
          data: {
            deploymentId: expect.any(String),
            projectId: expect.any(String),
            url: expect.stringMatching(/^https?:\/\/.+/),
            sandboxId: expect.any(String),
            status: 'running'
          }
        });

        // Verify project type was correctly detected as nodejs
        const deployCall = (orchestrationService.deployProject as jest.Mock).mock.calls[0];
        const files = deployCall[1];
        
        // Should contain only user files (no generated files for Node.js projects)
        expect(files).toHaveLength(validNodeJsProject.files.length);
        expect(files[0].path).toBe('package.json');
        expect(files[1].path).toBe('index.js');
      });

      it('should detect Express framework', async () => {
        const response = await request(testApp)
          .post('/api/deploy')
          .set('Authorization', `Bearer ${freeUserToken}`)
          .send(validNodeJsProject);

        expect(response.status).toBe(201);
        
        // Test the project analyzer functionality
        const analysis = ProjectAnalyzer.analyzeProject(validNodeJsProject.files as any);
        expect(analysis.projectType).toBe('nodejs');
        expect(analysis.framework).toBe('express');
        expect(analysis.startCommand).toBe('npm start');
      });
    });

    describe('Mixed projects (Manifest + Node.js)', () => {
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
              version: '1.0.0',
              main: 'custom.js',
              scripts: {
                start: 'node custom.js'
              }
            })
          },
          {
            path: 'custom.js',
            content: 'console.log("Custom Node.js app");'
          }
        ]
      };

      it('should prioritize manifest over package.json', async () => {
        const response = await request(testApp)
          .post('/api/deploy')
          .set('Authorization', `Bearer ${freeUserToken}`)
          .send(mixedProject);

        expect(response.status).toBe(201);

        // Verify it was treated as a manifest project
        const deployCall = (orchestrationService.deployProject as jest.Mock).mock.calls[0];
        const files = deployCall[1];
        
        // Should contain user files plus generated manifest files
        expect(files.length).toBeGreaterThan(mixedProject.files.length);
        expect(files).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ path: 'manifest.yaml' }),
            expect.objectContaining({ path: 'package.json' }),
            expect.objectContaining({ path: 'custom.js' }),
            expect.objectContaining({ path: 'index.js' }), // Generated
            expect.objectContaining({ path: 'database.js' }) // Generated
          ])
        );
      });
    });

    describe('Error handling', () => {
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
          error: expect.any(String),
          message: expect.stringMatching(/^\[.*\]/),
          timestamp: expect.any(String)
        });
      });

      it('should reject requests with invalid project name', async () => {
        const response = await request(testApp)
          .post('/api/deploy')
          .set('Authorization', `Bearer ${freeUserToken}`)
          .send({
            projectName: '', // Empty project name
            files: [{ path: 'index.js', content: 'console.log("test");' }]
          });

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('Project name'),
          message: expect.stringMatching(/^\[INVALID_PROJECT_NAME\]/),
          timestamp: expect.any(String)
        });
      });

      it('should reject requests with special characters in project name', async () => {
        const response = await request(testApp)
          .post('/api/deploy')
          .set('Authorization', `Bearer ${freeUserToken}`)
          .send({
            projectName: 'Test<>Project!@#', // Invalid characters
            files: [{ path: 'index.js', content: 'console.log("test");' }]
          });

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('invalid characters'),
          message: expect.stringMatching(/^\[INVALID_PROJECT_NAME\]/),
          timestamp: expect.any(String)
        });
      });

      it('should reject requests without files', async () => {
        const response = await request(testApp)
          .post('/api/deploy')
          .set('Authorization', `Bearer ${freeUserToken}`)
          .send({
            projectName: 'TestProject'
            // files: [] - Missing files
          });

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('Files array is required'),
          message: expect.stringMatching(/^\[INVALID_FILES\]/),
          timestamp: expect.any(String)
        });
      });

      it('should reject requests with empty files array', async () => {
        const response = await request(testApp)
          .post('/api/deploy')
          .set('Authorization', `Bearer ${freeUserToken}`)
          .send({
            projectName: 'TestProject',
            files: [] // Empty array
          });

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('Files array is required'),
          message: expect.stringMatching(/^\[INVALID_FILES\]/),
          timestamp: expect.any(String)
        });
      });

      it('should handle sandbox creation failures', async () => {
        // Mock OrchestrationService to throw an error
        const mockError = new Error('Sandbox service unavailable');
        jest.spyOn(orchestrationService, 'deployProject').mockRejectedValueOnce(mockError);

        const response = await request(testApp)
          .post('/api/deploy')
          .set('Authorization', `Bearer ${freeUserToken}`)
          .send({
            projectName: 'FailProject',
            files: [{ path: 'index.js', content: 'console.log("test");' }]
          });

        expect(response.status).toBe(503);
        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('Sandbox service unavailable'),
          message: expect.stringMatching(/^\[SANDBOX_ERROR\]/),
          timestamp: expect.any(String)
        });

        // Restore the mock
        setupOrchestrationMocks();
      });
    });

    describe('Quota and limits', () => {
      it('should respect free plan project limits', async () => {
        // Mock database to return max projects for free user
        const mockProjects = Array.from({ length: 3 }, (_, i) => ({
          id: `project-${i}`,
          name: `Project ${i}`,
          user_id: freeUserId,
          description: `Project ${i} description`,
          created_at: new Date(),
          updated_at: new Date()
        }));

        jest.spyOn(db, 'getProjectsByUserId').mockResolvedValueOnce({
          projects: mockProjects,
          total: 3
        });

        const response = await request(testApp)
          .post('/api/deploy')
          .set('Authorization', `Bearer ${freeUserToken}`)
          .send({
            projectName: 'ExceedsLimit',
            files: [{ path: 'index.js', content: 'console.log("test");' }]
          });

        expect(response.status).toBe(403);
        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('Project limit exceeded'),
          message: expect.stringMatching(/^\[QUOTA_EXCEEDED\]/),
          timestamp: expect.any(String)
        });
      });

      it('should respect free plan file size limits', async () => {
        const largeContent = 'x'.repeat(15 * 1024 * 1024); // 15MB file (exceeds 10MB limit)

        const response = await request(testApp)
          .post('/api/deploy')
          .set('Authorization', `Bearer ${freeUserToken}`)
          .send({
            projectName: 'LargeFileProject',
            files: [{ path: 'large.txt', content: largeContent }]
          });

        expect(response.status).toBe(403);
        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('exceeds the maximum file size limit'),
          message: expect.stringMatching(/^\[QUOTA_EXCEEDED\]/),
          timestamp: expect.any(String)
        });
      });

      it('should allow personal plan higher limits', async () => {
        // Mock fewer projects for personal user
        jest.spyOn(db, 'getProjectsByUserId').mockResolvedValueOnce({
          projects: [],
          total: 0
        });

        const response = await request(testApp)
          .post('/api/deploy')
          .set('Authorization', `Bearer ${personalUserToken}`)
          .send({
            projectName: 'PersonalProject',
            files: [{ path: 'index.js', content: 'console.log("personal");' }]
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });

      it('should respect deployment count limits', async () => {
        // Mock maximum running deployments for free user
        jest.spyOn(db, 'getRunningDeploymentCountByUser').mockResolvedValueOnce(10);

        const response = await request(testApp)
          .post('/api/deploy')
          .set('Authorization', `Bearer ${freeUserToken}`)
          .send({
            projectName: 'ExceedsDeployLimit',
            files: [{ path: 'index.js', content: 'console.log("test");' }]
          });

        expect(response.status).toBe(403);
        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('Deployment limit exceeded'),
          message: expect.stringMatching(/^\[QUOTA_EXCEEDED\]/),
          timestamp: expect.any(String)
        });
      });
    });

    describe('File validation and security', () => {
      it('should reject files with path traversal attempts', async () => {
        const response = await request(testApp)
          .post('/api/deploy')
          .set('Authorization', `Bearer ${freeUserToken}`)
          .send({
            projectName: 'MaliciousProject',
            files: [
              {
                path: '../../etc/passwd', // Path traversal attempt
                content: 'malicious content'
              }
            ]
          });

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('Path traversal'),
          message: expect.stringMatching(/^\[INVALID_FILES\]/),
          timestamp: expect.any(String)
        });
      });

      it('should reject files with absolute paths', async () => {
        const response = await request(testApp)
          .post('/api/deploy')
          .set('Authorization', `Bearer ${freeUserToken}`)
          .send({
            projectName: 'AbsolutePathProject',
            files: [
              {
                path: '/tmp/malicious.js', // Absolute path
                content: 'console.log("test");'
              }
            ]
          });

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('absolute paths are not allowed'),
          message: expect.stringMatching(/^\[INVALID_FILES\]/),
          timestamp: expect.any(String)
        });
      });

      it('should reject duplicate file paths', async () => {
        const response = await request(testApp)
          .post('/api/deploy')
          .set('Authorization', `Bearer ${freeUserToken}`)
          .send({
            projectName: 'DuplicateProject',
            files: [
              { path: 'index.js', content: 'console.log("first");' },
              { path: 'index.js', content: 'console.log("duplicate");' }
            ]
          });

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('Duplicate file path detected'),
          message: expect.stringMatching(/^\[INVALID_FILES\]/),
          timestamp: expect.any(String)
        });
      });

      it('should handle files with missing content', async () => {
        const response = await request(testApp)
          .post('/api/deploy')
          .set('Authorization', `Bearer ${freeUserToken}`)
          .send({
            projectName: 'MissingContentProject',
            files: [
              {
                path: 'empty.js'
                // content: undefined - Missing content
              }
            ]
          });

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('must have valid content property'),
          message: expect.stringMatching(/^\[INVALID_FILES\]/),
          timestamp: expect.any(String)
        });
      });
    });
  });

  // Helper functions for test setup
  async function createTestUsers(): Promise<void> {
    try {
      // Create free user
      const freeUser = await authService.register({
        email: 'free-user-manifest@example.com',
        password: 'TestPassword123!',
        planType: 'free'
      });
      
      if (freeUser.success && freeUser.data) {
        freeUserToken = freeUser.data.token;
        freeUserId = freeUser.data.user.id;
      }
    } catch (error) {
      // User might exist, try login
      const loginResult = await authService.login({
        email: 'free-user-manifest@example.com',
        password: 'TestPassword123!'
      });
      
      if (loginResult.success && loginResult.data) {
        freeUserToken = loginResult.data.token;
        freeUserId = loginResult.data.user.id;
      }
    }

    try {
      // Create personal user
      const personalUser = await authService.register({
        email: 'personal-user-manifest@example.com',
        password: 'TestPassword123!',
        planType: 'personal'
      });
      
      if (personalUser.success && personalUser.data) {
        personalUserToken = personalUser.data.token;
        // personalUserId = personalUser.data.user.id;
      }
    } catch (error) {
      // User might exist, try login
      const loginResult = await authService.login({
        email: 'personal-user-manifest@example.com',
        password: 'TestPassword123!'
      });
      
      if (loginResult.success && loginResult.data) {
        personalUserToken = loginResult.data.token;
        // personalUserId = loginResult.data.user.id;
      }
    }
  }

  function setupOrchestrationMocks(): void {
    // Mock OrchestrationService to avoid real sandbox creation
    jest.spyOn(orchestrationService, 'deployProject').mockResolvedValue(mockDeploymentResult);
    
    // Mock database methods to return predictable responses
    jest.spyOn(db, 'createProject').mockResolvedValue({
      id: 'test-project-id',
      name: 'TestProject',
      user_id: 'test-user-id',
      description: 'Test project',
      created_at: new Date(),
      updated_at: new Date()
    });

    jest.spyOn(db, 'getProjectsByUserId').mockResolvedValue({
      projects: [],
      total: 0
    });

    jest.spyOn(db, 'getRunningDeploymentCountByUser').mockResolvedValue(0);

    jest.spyOn(db, 'createDeployment').mockResolvedValue({
      id: 'test-deployment-id',
      project_id: 'test-project-id',
      app_sandbox_id: 'test-sandbox-id',
      public_url: 'https://test.example.com',
      status: DeploymentStatus.RUNNING,
      runtime_type: 'node',
      created_at: new Date(),
      updated_at: new Date()
    });

    jest.spyOn(db, 'updateProject').mockResolvedValue({
      id: 'test-project-id',
      name: 'TestProject',
      user_id: 'test-user-id',
      description: 'Updated project',
      created_at: new Date(),
      updated_at: new Date()
    });
  }

  async function cleanupTestData(): Promise<void> {
    try {
      // Clean up any test data if needed
      // Note: In a real test environment, you might want to clean up test users
      // For this mock setup, we'll just restore mocks
      jest.restoreAllMocks();
      
      // Close database connections
      if (db && db.isConnected()) {
        await db.disconnect();
      }
    } catch (error) {
      console.error('Error cleaning up test data:', error);
    }
  }
});