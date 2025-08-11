import request from 'supertest';
import { Express } from 'express';
import { DatabaseService } from '../../src/services/database';
import { AuthService } from '../../src/services/auth';
import { createTestApp } from '../helpers/test-app';

describe('API Endpoints Integration', () => {
  let app: Express;
  let authToken: string;
  let testUserId: string;
  let db: DatabaseService;

  beforeAll(async () => {
    // Initialize test app and database
    app = createTestApp();
    db = DatabaseService.getInstance();
    await db.connect();
    
    // Create test user and get auth token
    const authService = new AuthService();
    const testUser = await authService.register(
      'integration-test@coderunner.io',
      'TestPassword123!',
      'Integration Test User'
    );
    testUserId = testUser.id;
    authToken = testUser.token;
  });

  afterAll(async () => {
    // Clean up test data
    if (testUserId) {
      await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
    }
    await db.disconnect();
  });

  describe('Authentication Endpoints', () => {
    describe('POST /api/auth/register', () => {
      it('should register new user successfully', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            name: 'New Test User',
            email: `new-user-${Date.now()}@example.com`,
            password: 'NewPassword123!'
          })
          .expect(201);

        expect(response.body).toHaveProperty('user');
        expect(response.body).toHaveProperty('token');
        expect(response.body.user.name).toBe('New Test User');
      });

      it('should reject weak passwords', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            name: 'Test User',
            email: 'test@example.com',
            password: '123'
          })
          .expect(400);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toContain('password');
      });

      it('should reject duplicate emails', async () => {
        const email = `duplicate-${Date.now()}@example.com`;
        
        // First registration
        await request(app)
          .post('/api/auth/register')
          .send({
            name: 'First User',
            email,
            password: 'Password123!'
          })
          .expect(201);

        // Duplicate registration
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            name: 'Second User',
            email,
            password: 'Password123!'
          })
          .expect(409);

        expect(response.body.error).toContain('already exists');
      });
    });

    describe('POST /api/auth/login', () => {
      it('should login with valid credentials', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'integration-test@coderunner.io',
            password: 'TestPassword123!'
          })
          .expect(200);

        expect(response.body).toHaveProperty('user');
        expect(response.body).toHaveProperty('token');
      });

      it('should reject invalid credentials', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'integration-test@coderunner.io',
            password: 'wrongpassword'
          })
          .expect(401);

        expect(response.body.error).toContain('Invalid credentials');
      });
    });

    describe('GET /api/auth/me', () => {
      it('should return user info with valid token', async () => {
        const response = await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('id', testUserId);
        expect(response.body).toHaveProperty('email', 'integration-test@coderunner.io');
      });

      it('should reject invalid token', async () => {
        const response = await request(app)
          .get('/api/auth/me')
          .set('Authorization', 'Bearer invalid-token')
          .expect(401);

        expect(response.body.error).toContain('Invalid token');
      });
    });
  });

  describe('Deployment Endpoints', () => {
    let testProjectId: string;

    beforeAll(async () => {
      // Create a test project
      const project = await db.query(
        'INSERT INTO projects (name, user_id) VALUES ($1, $2) RETURNING id',
        ['Integration Test Project', testUserId]
      );
      testProjectId = project.rows[0].id;
    });

    describe('GET /api/deployments', () => {
      it('should return user deployments', async () => {
        const response = await request(app)
          .get('/api/deployments')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(Array.isArray(response.body.deployments)).toBe(true);
        expect(response.body).toHaveProperty('total');
        expect(response.body).toHaveProperty('page');
        expect(response.body).toHaveProperty('limit');
      });

      it('should support pagination', async () => {
        const response = await request(app)
          .get('/api/deployments?page=1&limit=5')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.page).toBe(1);
        expect(response.body.limit).toBe(5);
        expect(response.body.deployments.length).toBeLessThanOrEqual(5);
      });

      it('should support filtering by status', async () => {
        const response = await request(app)
          .get('/api/deployments?status=running')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        response.body.deployments.forEach((deployment: any) => {
          expect(deployment.status).toBe('running');
        });
      });
    });

    describe('POST /api/deployments', () => {
      it('should create deployment with valid manifest', async () => {
        const manifest = {
          version: '1.0',
          name: 'integration-test-app',
          type: 'nodejs',
          runtime: { version: '18' },
          start: { command: 'npm start', port: 8080 },
          resources: { cpu: 0.5, memory: 512 }
        };

        const response = await request(app)
          .post('/api/deployments')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Integration Test Deployment',
            projectId: testProjectId,
            manifest
          })
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('status');
        expect(response.body.name).toBe('Integration Test Deployment');
        expect(response.body.manifest).toEqual(manifest);
      });

      it('should validate manifest format', async () => {
        const response = await request(app)
          .post('/api/deployments')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Invalid Manifest Test',
            projectId: testProjectId,
            manifest: { invalid: 'manifest' }
          })
          .expect(400);

        expect(response.body.error).toContain('Invalid manifest');
      });
    });

    describe('GET /api/deployments/:id', () => {
      let deploymentId: string;

      beforeAll(async () => {
        // Create a test deployment
        const manifest = {
          version: '1.0',
          name: 'test-detail-app',
          type: 'nodejs',
          start: { command: 'npm start', port: 3000 }
        };

        const deployment = await request(app)
          .post('/api/deployments')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Test Detail Deployment',
            projectId: testProjectId,
            manifest
          });

        deploymentId = deployment.body.id;
      });

      it('should return deployment details', async () => {
        const response = await request(app)
          .get(`/api/deployments/${deploymentId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('id', deploymentId);
        expect(response.body).toHaveProperty('name', 'Test Detail Deployment');
        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('manifest');
      });

      it('should return 404 for non-existent deployment', async () => {
        const fakeId = '00000000-0000-0000-0000-000000000000';
        const response = await request(app)
          .get(`/api/deployments/${fakeId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);

        expect(response.body.error).toContain('not found');
      });
    });

    describe('POST /api/deployments/:id/actions', () => {
      let deploymentId: string;

      beforeAll(async () => {
        const manifest = {
          version: '1.0',
          name: 'test-action-app',
          type: 'nodejs',
          start: { command: 'npm start', port: 3000 }
        };

        const deployment = await request(app)
          .post('/api/deployments')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Test Action Deployment',
            projectId: testProjectId,
            manifest
          });

        deploymentId = deployment.body.id;
      });

      it('should stop deployment', async () => {
        const response = await request(app)
          .post(`/api/deployments/${deploymentId}/actions`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ action: 'stop' })
          .expect(200);

        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('stopped');
      });

      it('should start deployment', async () => {
        const response = await request(app)
          .post(`/api/deployments/${deploymentId}/actions`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ action: 'start' })
          .expect(200);

        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('started');
      });

      it('should reject invalid actions', async () => {
        const response = await request(app)
          .post(`/api/deployments/${deploymentId}/actions`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ action: 'invalid-action' })
          .expect(400);

        expect(response.body.error).toContain('Invalid action');
      });
    });
  });

  describe('Configuration Endpoints', () => {
    let testProjectId: string;

    beforeAll(async () => {
      const project = await db.query(
        'INSERT INTO projects (name, user_id) VALUES ($1, $2) RETURNING id',
        ['Config Test Project', testUserId]
      );
      testProjectId = project.rows[0].id;
    });

    describe('GET /api/projects/:id/configurations', () => {
      it('should return project configurations', async () => {
        const response = await request(app)
          .get(`/api/projects/${testProjectId}/configurations`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('development');
        expect(response.body).toHaveProperty('staging');
        expect(response.body).toHaveProperty('production');
      });
    });

    describe('POST /api/projects/:id/configurations/:env/variables', () => {
      it('should create environment variable', async () => {
        const response = await request(app)
          .post(`/api/projects/${testProjectId}/configurations/development/variables`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            key: 'TEST_VAR',
            value: 'test-value-123',
            description: 'Test variable for integration tests',
            isRequired: false
          })
          .expect(201);

        expect(response.body).toHaveProperty('key', 'TEST_VAR');
        expect(response.body).toHaveProperty('value', 'test-value-123');
      });

      it('should handle secret variables', async () => {
        const response = await request(app)
          .post(`/api/projects/${testProjectId}/configurations/development/variables`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            key: 'SECRET_KEY',
            value: 'super-secret-value',
            isSecret: true,
            description: 'Secret test variable'
          })
          .expect(201);

        expect(response.body).toHaveProperty('key', 'SECRET_KEY');
        expect(response.body).toHaveProperty('isEncrypted', true);
        // Value should be encrypted/masked
        expect(response.body.value).not.toBe('super-secret-value');
      });
    });
  });

  describe('Scaling Endpoints', () => {
    let deploymentId: string;

    beforeAll(async () => {
      const manifest = {
        version: '1.0',
        name: 'scaling-test-app',
        type: 'nodejs',
        start: { command: 'npm start', port: 3000 },
        resources: { cpu: 0.5, memory: 512 }
      };

      const deployment = await request(app)
        .post('/api/deployments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Scaling Test Deployment',
          projectId: testProjectId,
          manifest
        });

      deploymentId = deployment.body.id;
    });

    describe('GET /api/deployments/:id/scaling', () => {
      it('should return scaling information', async () => {
        const response = await request(app)
          .get(`/api/deployments/${deploymentId}/scaling`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('currentInstances');
        expect(response.body).toHaveProperty('policies');
        expect(response.body).toHaveProperty('metrics');
        expect(response.body).toHaveProperty('history');
      });
    });

    describe('POST /api/deployments/:id/scaling/policies', () => {
      it('should create scaling policy', async () => {
        const policy = {
          name: 'CPU Scale Out Policy',
          metricType: 'cpu',
          threshold: 75,
          scaleDirection: 'out',
          scaleAmount: 2,
          cooldownPeriod: 300
        };

        const response = await request(app)
          .post(`/api/deployments/${deploymentId}/scaling/policies`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(policy)
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('name', policy.name);
        expect(response.body).toHaveProperty('threshold', policy.threshold);
      });

      it('should validate policy parameters', async () => {
        const invalidPolicy = {
          name: 'Invalid Policy',
          metricType: 'invalid-metric',
          threshold: 150, // Invalid: > 100%
          scaleDirection: 'out'
        };

        const response = await request(app)
          .post(`/api/deployments/${deploymentId}/scaling/policies`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidPolicy)
          .expect(400);

        expect(response.body.error).toContain('Invalid');
      });
    });

    describe('POST /api/deployments/:id/scaling/manual', () => {
      it('should scale deployment manually', async () => {
        const response = await request(app)
          .post(`/api/deployments/${deploymentId}/scaling/manual`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ targetInstances: 3 })
          .expect(200);

        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('Scaling initiated');
      });

      it('should validate instance limits', async () => {
        const response = await request(app)
          .post(`/api/deployments/${deploymentId}/scaling/manual`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ targetInstances: 0 })
          .expect(400);

        expect(response.body.error).toContain('minimum');
      });
    });
  });

  describe('Health Check Endpoints', () => {
    describe('GET /api/health', () => {
      it('should return system health status', async () => {
        const response = await request(app)
          .get('/api/health')
          .expect(200);

        expect(response.body).toHaveProperty('status', 'healthy');
        expect(response.body).toHaveProperty('timestamp');
        expect(response.body).toHaveProperty('services');
        expect(response.body.services).toHaveProperty('database');
      });
    });

    describe('GET /api/health/detailed', () => {
      it('should return detailed health information', async () => {
        const response = await request(app)
          .get('/api/health/detailed')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('system');
        expect(response.body).toHaveProperty('database');
        expect(response.body).toHaveProperty('dependencies');
        expect(response.body.database).toHaveProperty('connected', true);
      });
    });
  });

  describe('Metrics Endpoints', () => {
    describe('GET /api/metrics', () => {
      it('should return system metrics in Prometheus format', async () => {
        const response = await request(app)
          .get('/api/metrics')
          .expect(200);

        expect(response.headers['content-type']).toContain('text/plain');
        expect(response.text).toContain('# HELP');
        expect(response.text).toContain('# TYPE');
      });
    });

    describe('GET /api/deployments/:id/metrics', () => {
      it('should return deployment-specific metrics', async () => {
        // Create a deployment first
        const manifest = {
          version: '1.0',
          name: 'metrics-test-app',
          type: 'nodejs',
          start: { command: 'npm start', port: 3000 }
        };

        const deployment = await request(app)
          .post('/api/deployments')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Metrics Test Deployment',
            projectId: testProjectId,
            manifest
          });

        const deploymentId = deployment.body.id;

        const response = await request(app)
          .get(`/api/deployments/${deploymentId}/metrics`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('cpu');
        expect(response.body).toHaveProperty('memory');
        expect(response.body).toHaveProperty('requests');
        expect(response.body).toHaveProperty('timestamp');
      });
    });
  });
});