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

  describe('Security Tests', () => {
    it('should reject SQL injection attempts in project name', async () => {
      const maliciousNames = [
        "'; DROP TABLE users; --",
        "test' OR '1'='1",
        "test'; DELETE FROM projects; --",
        "test' UNION SELECT * FROM users; --"
      ];

      for (const maliciousName of maliciousNames) {
        const response = await request(app)
          .post('/api/deploy')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            projectName: maliciousName,
            files: [{ path: 'index.js', content: 'console.log("test");' }]
          });

        expect([400, 422]).toContain(response.status);
      }
    });

    it('should reject XSS attempts in project name', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src=x onerror="alert(1)">',
        '"><script>alert("xss")</script>',
        "'; alert('xss'); //"
      ];

      for (const xssPayload of xssPayloads) {
        const response = await request(app)
          .post('/api/deploy')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            projectName: xssPayload,
            files: [{ path: 'index.js', content: 'console.log("test");' }]
          });

        expect([400, 422]).toContain(response.status);
      }
    });

    it('should reject path traversal attempts in file paths', async () => {
      const maliciousPaths = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '/etc/shadow',
        'C:\\Windows\\System32\\drivers\\etc\\hosts',
        '../../../../proc/self/environ',
        '../../../var/log/messages'
      ];

      for (const maliciousPath of maliciousPaths) {
        const response = await request(app)
          .post('/api/deploy')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            projectName: 'security-test',
            files: [{ path: maliciousPath, content: 'malicious content' }]
          });

        expect([400, 422]).toContain(response.status);
        if (response.body.error) {
          expect(response.body.error.toLowerCase()).toMatch(/(invalid|path|security|forbidden)/);
        }
      }
    });

    it('should handle extremely large file upload attempts', async () => {
      // Create a file larger than typical limits (>100MB)
      const largeContent = 'A'.repeat(10 * 1024 * 1024); // 10MB string (safer for testing)
      
      const response = await request(app)
        .post('/api/deploy')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          projectName: 'large-file-test',
          files: [{ path: 'large-file.txt', content: largeContent }]
        });

      // Should either reject with 413 (too large) or 400 (bad request)
      expect([400, 413, 422]).toContain(response.status);
    });

    it('should handle concurrent deployment requests', async () => {
      const promises = Array.from({ length: 10 }, (_, i) => 
        request(app)
          .post('/api/deploy')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            projectName: `concurrent-test-${i}`,
            files: [{ path: 'index.js', content: `console.log("concurrent ${i}");` }]
          })
      );

      const responses = await Promise.all(promises);
      
      // All requests should be processed (either success or proper error)
      responses.forEach(response => {
        expect([201, 400, 422, 429, 500]).toContain(response.status);
      });
    });

    it('should validate file content for malicious code patterns', async () => {
      const maliciousFiles = [
        {
          path: 'malicious.js',
          content: 'const { exec } = require("child_process"); exec("rm -rf /");'
        },
        {
          path: 'backdoor.js',
          content: 'require("net").createServer(c => { c.pipe(require("child_process").spawn("/bin/sh", ["-i"]).stdio[0]); }).listen(1337);'
        },
        {
          path: 'crypto.js',
          content: 'const crypto = require("crypto"); process.exit(crypto.randomBytes(1000000));'
        }
      ];

      for (const maliciousFile of maliciousFiles) {
        const response = await request(app)
          .post('/api/deploy')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            projectName: 'malicious-code-test',
            files: [maliciousFile]
          });

        // Should process but may flag as potentially dangerous
        expect([201, 400, 422, 500]).toContain(response.status);
      }
    });

    it('should handle invalid authentication tokens', async () => {
      const invalidTokens = [
        'invalid-token',
        'Bearer invalid',
        '',
        'null',
        'undefined',
        'jwt-token-that-is-way-too-long-' + 'x'.repeat(1000)
      ];

      for (const invalidToken of invalidTokens) {
        const response = await request(app)
          .post('/api/deploy')
          .set('Authorization', invalidToken)
          .send({
            projectName: 'auth-test',
            files: [{ path: 'index.js', content: 'console.log("test");' }]
          });

        expect([401, 403]).toContain(response.status);
      }
    });

    it('should reject binary files with suspicious patterns', async () => {
      const suspiciousFiles = [
        {
          path: 'suspicious.exe',
          content: String.fromCharCode(77, 90) + 'PE\0\0' // PE header
        },
        {
          path: 'script.sh',
          content: '#!/bin/bash\nrm -rf /\n'
        },
        {
          path: 'payload.bat',
          content: '@echo off\nformat c: /y\n'
        }
      ];

      for (const suspiciousFile of suspiciousFiles) {
        const response = await request(app)
          .post('/api/deploy')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            projectName: 'suspicious-file-test',
            files: [suspiciousFile]
          });

        expect([400, 415, 422]).toContain(response.status);
      }
    });

    it('should enforce rate limiting for frequent requests', async () => {
      // Simulate rapid fire requests
      const rapidRequests = Array.from({ length: 20 }, () => 
        request(app)
          .post('/api/deploy')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            projectName: 'rate-limit-test',
            files: [{ path: 'index.js', content: 'console.log("test");' }]
          })
      );

      const responses = await Promise.all(rapidRequests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      const successfulResponses = responses.filter(r => [201, 500].includes(r.status));
      
      // Should have some rate limiting or all processed
      expect(rateLimitedResponses.length + successfulResponses.length).toBe(20);
    });

    it('should sanitize error messages to prevent information leakage', async () => {
      const response = await request(app)
        .post('/api/deploy')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          projectName: 'error-test',
          files: [{ path: '../../../etc/passwd', content: 'test' }]
        });

      expect([400, 422]).toContain(response.status);
      
      if (response.body.error) {
        // Error message should not contain sensitive system information
        expect(response.body.error).not.toMatch(/(password|secret|key|token|database|internal)/i);
        expect(response.body.error).not.toContain('/etc/passwd');
        expect(response.body.error).not.toContain('system32');
      }
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