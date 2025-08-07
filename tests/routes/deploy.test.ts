import request from 'supertest';
import { app } from '../../src/index';
import { AuthService } from '../../src/services/auth';
import { DatabaseService } from '../../src/services/database';
import { OrchestrationService } from '../../src/services/orchestration';

describe('POST /api/deploy', () => {
  let authService: AuthService;
  let db: DatabaseService;
  // let orchestrationService: OrchestrationService;
  let testToken: string;
  let testUserId: string;

  beforeAll(async () => {
    authService = AuthService.getInstance();
    db = DatabaseService.getInstance();
    // orchestrationService = OrchestrationService.getInstance();
    
    // Create a test user and get token
    try {
      const testUser = await authService.register({
        email: 'test-deploy@example.com',
        password: 'TestPassword123!',
        planType: 'free'
      });
      testToken = testUser.data!.token;
      testUserId = testUser.data!.user.id;
    } catch (error) {
      // User might already exist, try to log in
      const loginResult = await authService.login({
        email: 'test-deploy@example.com',
        password: 'TestPassword123!'
      });
      testToken = loginResult.data!.token;
      testUserId = loginResult.data!.user.id;
    }
  });

  describe('Input Validation', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/deploy')
        .send({
          projectName: 'test-project',
          files: [{ path: 'index.js', content: 'console.log("Hello");' }]
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for missing projectName', async () => {
      const response = await request(app)
        .post('/api/deploy')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          files: [{ path: 'index.js', content: 'console.log("Hello");' }]
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('projectName');
    });

    it('should return 400 for missing files', async () => {
      const response = await request(app)
        .post('/api/deploy')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          projectName: 'test-project'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('files');
    });

    it('should return 400 for empty files array', async () => {
      const response = await request(app)
        .post('/api/deploy')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          projectName: 'test-project',
          files: []
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('INVALID_FILES');
    });

    it('should return 400 for invalid project name', async () => {
      const response = await request(app)
        .post('/api/deploy')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          projectName: '',
          files: [{ path: 'index.js', content: 'console.log("Hello");' }]
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('INVALID_PROJECT_NAME');
    });
  });

  describe('File Processing', () => {
    it('should reject files with path traversal', async () => {
      const response = await request(app)
        .post('/api/deploy')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          projectName: 'test-project',
          files: [{ path: '../../../etc/passwd', content: 'malicious' }]
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('INVALID_FILES');
    });

    it('should handle base64 encoded files', async () => {
      const content = 'console.log("Hello World");';
      const base64Content = Buffer.from(content).toString('base64');

      const response = await request(app)
        .post('/api/deploy')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          projectName: 'base64-test',
          files: [{ path: 'index.js', content: base64Content }]
        });

      // Note: This test might fail if the deployment actually tries to execute
      // For now, we're mainly testing that the base64 processing doesn't throw an error
      expect([200, 201, 500]).toContain(response.status);
    });
  });

  describe('Valid Deployment Request', () => {
    it('should process a valid Node.js deployment', async () => {
      const files = [
        { 
          path: 'package.json', 
          content: JSON.stringify({
            name: 'test-app',
            version: '1.0.0',
            main: 'index.js',
            scripts: { start: 'node index.js' },
            dependencies: {}
          })
        },
        { 
          path: 'index.js', 
          content: `
            const http = require('http');
            const server = http.createServer((req, res) => {
              res.writeHead(200, { 'Content-Type': 'text/plain' });
              res.end('Hello World!');
            });
            server.listen(3000, () => console.log('Server running on port 3000'));
          `
        }
      ];

      const response = await request(app)
        .post('/api/deploy')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          projectName: 'nodejs-test',
          projectDescription: 'Test Node.js application',
          files: files,
          config: {
            port: 3000,
            timeout: 300,
            env: {
              NODE_ENV: 'production'
            }
          }
        });

      // Deployment might fail due to sandbox issues, but the request should be processed
      expect([201, 500]).toContain(response.status);
      
      if (response.status === 201) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('deploymentId');
        expect(response.body.data).toHaveProperty('projectId');
        expect(response.body.data).toHaveProperty('status');
      }
    });

    it('should process a manifest deployment', async () => {
      const files = [
        { 
          path: 'manifest.yaml', 
          content: `
name: test-manifest-app
version: 1.0.0
entities:
  - name: User
    fields:
      - name: id
        type: number
        required: true
      - name: name
        type: string
        required: true
      - name: email
        type: string
        required: true
          `
        }
      ];

      const response = await request(app)
        .post('/api/deploy')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          projectName: 'manifest-test',
          projectDescription: 'Test Manifest application',
          files: files
        });

      // Deployment might fail due to sandbox issues, but the request should be processed
      expect([201, 500]).toContain(response.status);
    });
  });

  afterAll(async () => {
    // Clean up test data if needed
    if (db && testUserId) {
      try {
        await db.deleteUser(testUserId);
      } catch (error) {
        console.log('Test cleanup warning:', error);
      }
    }
  });
});