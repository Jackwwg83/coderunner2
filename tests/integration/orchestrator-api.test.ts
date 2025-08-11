/**
 * Orchestrator API Integration Tests
 * Tests for database orchestration REST API endpoints
 * 
 * Tests:
 * - Deployment CRUD operations
 * - Multi-tenant management
 * - Scaling and backup operations
 * - Health monitoring and metrics
 * - Authentication and authorization
 * - Error handling and validation
 */

import request from 'supertest';
import { createApp } from '../../src/index';
import { testFactory } from '../helpers/test-factories';
import { testServer } from '../helpers/test-server';

describe('Orchestrator API Integration Tests', () => {
  let app: any;
  let server: any;
  let authToken: string;
  let testUser: any;

  beforeAll(async () => {
    // Initialize test server
    const testSetup = await testServer.setup();
    app = testSetup.app;
    server = testSetup.server;

    // Create test user and get auth token
    testUser = testFactory.createUser();
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: testUser.email,
        password: testUser.password,
        name: testUser.name
      })
      .expect(201);

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password
      })
      .expect(200);

    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    await testServer.teardown(server);
  });

  describe('Authentication and Authorization', () => {
    test('should reject requests without authentication', async () => {
      await request(app)
        .get('/api/orchestrator/deployments')
        .expect(401);

      await request(app)
        .post('/api/orchestrator/deploy')
        .send({
          type: 'postgresql',
          config: { name: 'test' }
        })
        .expect(401);
    });

    test('should reject requests with invalid token', async () => {
      await request(app)
        .get('/api/orchestrator/deployments')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    test('should accept requests with valid authentication', async () => {
      const response = await request(app)
        .get('/api/orchestrator/deployments')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Deployment Management', () => {
    describe('POST /api/orchestrator/deploy', () => {
      test('should create PostgreSQL deployment', async () => {
        const deployRequest = {
          type: 'postgresql',
          projectId: 'test-project-123',
          config: {
            name: 'test-postgres-api',
            version: '16',
            instanceClass: 'medium',
            allocatedStorage: 100,
            postgresql: {
              name: 'api-test-postgres',
              version: '16',
              instance_type: 'medium',
              storage_gb: 100,
              environment: 'development',
              tenant_isolation: 'schema'
            }
          },
          environment: 'development',
          tags: {
            purpose: 'api-testing',
            owner: 'test-team'
          }
        };

        const response = await request(app)
          .post('/api/orchestrator/deploy')
          .set('Authorization', `Bearer ${authToken}`)
          .send(deployRequest)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.deploymentId).toBeDefined();
        expect(response.body.data.type).toBe('postgresql');
        expect(response.body.data.status).toBe('running');
        expect(response.body.data.connectionString).toBeDefined();
      });

      test('should create Redis deployment', async () => {
        const deployRequest = {
          type: 'redis',
          projectId: 'test-project-456',
          config: {
            name: 'test-redis-api',
            version: '7.2',
            redis: {
              name: 'api-test-redis',
              version: '7.2',
              mode: 'standalone',
              memory_mb: 512,
              environment: 'development'
            }
          },
          environment: 'development'
        };

        const response = await request(app)
          .post('/api/orchestrator/deploy')
          .set('Authorization', `Bearer ${authToken}`)
          .send(deployRequest)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.deploymentId).toBeDefined();
        expect(response.body.data.type).toBe('redis');
        expect(response.body.data.publicUrl).toBeDefined();
      });

      test('should validate deployment request', async () => {
        const invalidRequest = {
          type: 'invalid-type',
          config: {}
        };

        const response = await request(app)
          .post('/api/orchestrator/deploy')
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidRequest)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Validation failed');
        expect(response.body.details).toBeInstanceOf(Array);
      });

      test('should require project ID', async () => {
        const requestWithoutProject = {
          type: 'postgresql',
          config: {
            name: 'missing-project-postgres'
          }
        };

        const response = await request(app)
          .post('/api/orchestrator/deploy')
          .set('Authorization', `Bearer ${authToken}`)
          .send(requestWithoutProject)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.details.some((d: any) => d.path === 'projectId')).toBe(true);
      });

      test('should handle deployment failures gracefully', async () => {
        const failingRequest = {
          type: 'postgresql',
          projectId: 'invalid-project',
          config: {
            name: 'failing-deployment',
            postgresql: {
              name: 'invalid-config',
              version: 'non-existent-version'
            }
          }
        };

        const response = await request(app)
          .post('/api/orchestrator/deploy')
          .set('Authorization', `Bearer ${authToken}`)
          .send(failingRequest)
          .expect(500);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBeDefined();
      });
    });

    describe('GET /api/orchestrator/deployments', () => {
      let testDeployments: string[] = [];

      beforeAll(async () => {
        // Create test deployments
        const deployRequests = [
          {
            type: 'postgresql',
            projectId: 'list-test-project',
            config: {
              name: 'list-postgres-1',
              postgresql: { name: 'list-pg-1', version: '16' }
            },
            environment: 'development'
          },
          {
            type: 'redis',
            projectId: 'list-test-project',
            config: {
              name: 'list-redis-1',
              redis: { name: 'list-redis-1', version: '7.2' }
            },
            environment: 'staging'
          }
        ];

        for (const deployRequest of deployRequests) {
          const response = await request(app)
            .post('/api/orchestrator/deploy')
            .set('Authorization', `Bearer ${authToken}`)
            .send(deployRequest)
            .expect(201);
          
          testDeployments.push(response.body.data.deploymentId);
        }
      });

      test('should list user deployments', async () => {
        const response = await request(app)
          .get('/api/orchestrator/deployments')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.deployments).toBeInstanceOf(Array);
        expect(response.body.data.deployments.length).toBeGreaterThanOrEqual(2);
        expect(response.body.data.pagination).toBeDefined();
      });

      test('should filter deployments by type', async () => {
        const response = await request(app)
          .get('/api/orchestrator/deployments?type=postgresql')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        response.body.data.deployments.forEach((deployment: any) => {
          expect(deployment.type).toBe('postgresql');
        });
      });

      test('should filter deployments by environment', async () => {
        const response = await request(app)
          .get('/api/orchestrator/deployments?environment=staging')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        response.body.data.deployments.forEach((deployment: any) => {
          expect(deployment.environment).toBe('staging');
        });
      });

      test('should support pagination', async () => {
        const response = await request(app)
          .get('/api/orchestrator/deployments?limit=1&offset=0')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.deployments.length).toBe(1);
        expect(response.body.data.pagination.limit).toBe(1);
        expect(response.body.data.pagination.offset).toBe(0);
      });

      test('should validate query parameters', async () => {
        const response = await request(app)
          .get('/api/orchestrator/deployments?type=invalid&limit=invalid')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Validation failed');
      });
    });

    describe('GET /api/orchestrator/deployments/:id', () => {
      let testDeploymentId: string;

      beforeAll(async () => {
        // Create a test deployment
        const deployRequest = {
          type: 'postgresql',
          projectId: 'detail-test-project',
          config: {
            name: 'detail-postgres',
            monitoring: { enabled: true },
            postgresql: {
              name: 'detail-test',
              version: '16',
              features: {
                monitoring: { enabled: true }
              }
            }
          }
        };

        const response = await request(app)
          .post('/api/orchestrator/deploy')
          .set('Authorization', `Bearer ${authToken}`)
          .send(deployRequest)
          .expect(201);

        testDeploymentId = response.body.data.deploymentId;
      });

      test('should get deployment details', async () => {
        const response = await request(app)
          .get(`/api/orchestrator/deployments/${testDeploymentId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.deployment).toBeDefined();
        expect(response.body.data.deployment.id).toBe(testDeploymentId);
        expect(response.body.data.health).toBeDefined();
        expect(response.body.data.scheduledTasks).toBeInstanceOf(Array);
      });

      test('should return 404 for non-existent deployment', async () => {
        const response = await request(app)
          .get('/api/orchestrator/deployments/non-existent-id')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Deployment not found');
      });

      test('should deny access to other user deployments', async () => {
        // Create another user
        const otherUser = testFactory.createUser();
        const registerResponse = await request(app)
          .post('/api/auth/register')
          .send({
            email: otherUser.email,
            password: otherUser.password,
            name: otherUser.name
          })
          .expect(201);

        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: otherUser.email,
            password: otherUser.password
          })
          .expect(200);

        const otherUserToken = loginResponse.body.token;

        // Try to access original user's deployment
        const response = await request(app)
          .get(`/api/orchestrator/deployments/${testDeploymentId}`)
          .set('Authorization', `Bearer ${otherUserToken}`)
          .expect(403);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Access denied');
      });
    });

    describe('DELETE /api/orchestrator/:id', () => {
      let destroyTestDeploymentId: string;

      beforeEach(async () => {
        // Create a deployment to destroy
        const deployRequest = {
          type: 'redis',
          projectId: 'destroy-test-project',
          config: {
            name: 'destroy-redis',
            redis: {
              name: 'destroy-test',
              version: '7.2'
            }
          }
        };

        const response = await request(app)
          .post('/api/orchestrator/deploy')
          .set('Authorization', `Bearer ${authToken}`)
          .send(deployRequest)
          .expect(201);

        destroyTestDeploymentId = response.body.data.deploymentId;
      });

      test('should destroy deployment', async () => {
        const response = await request(app)
          .delete(`/api/orchestrator/${destroyTestDeploymentId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Deployment destroyed successfully');

        // Verify deployment is no longer accessible
        await request(app)
          .get(`/api/orchestrator/deployments/${destroyTestDeploymentId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);
      });

      test('should handle destruction of non-existent deployment', async () => {
        const response = await request(app)
          .delete('/api/orchestrator/non-existent-id')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Deployment not found');
      });
    });
  });

  describe('Scaling Operations', () => {
    let scalingTestDeploymentId: string;

    beforeAll(async () => {
      // Create a deployment for scaling tests
      const deployRequest = {
        type: 'postgresql',
        projectId: 'scaling-test-project',
        config: {
          name: 'scaling-postgres',
          postgresql: {
            name: 'scaling-test',
            version: '16',
            scaling: {
              auto_scaling: false
            }
          }
        }
      };

      const response = await request(app)
        .post('/api/orchestrator/deploy')
        .set('Authorization', `Bearer ${authToken}`)
        .send(deployRequest)
        .expect(201);

      scalingTestDeploymentId = response.body.data.deploymentId;
    });

    describe('POST /api/orchestrator/:id/scale', () => {
      test('should scale deployment', async () => {
        const scaleRequest = { replicas: 3 };

        const response = await request(app)
          .post(`/api/orchestrator/${scalingTestDeploymentId}/scale`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(scaleRequest)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('scaled to 3 replicas');
      });

      test('should validate scaling parameters', async () => {
        const invalidScaleRequest = { replicas: 0 };

        const response = await request(app)
          .post(`/api/orchestrator/${scalingTestDeploymentId}/scale`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidScaleRequest)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Validation failed');
      });

      test('should reject scaling beyond limits', async () => {
        const excessiveScaleRequest = { replicas: 20 };

        const response = await request(app)
          .post(`/api/orchestrator/${scalingTestDeploymentId}/scale`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(excessiveScaleRequest)
          .expect(400);

        expect(response.body.success).toBe(false);
      });
    });

    describe('POST /api/orchestrator/:id/auto-scale', () => {
      test('should configure auto-scaling', async () => {
        const autoScaleConfig = {
          enabled: true,
          minReplicas: 2,
          maxReplicas: 8,
          targetCPU: 75,
          targetMemory: 85
        };

        const response = await request(app)
          .post(`/api/orchestrator/${scalingTestDeploymentId}/auto-scale`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(autoScaleConfig)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.enabled).toBe(true);
        expect(response.body.data.minReplicas).toBe(2);
        expect(response.body.data.maxReplicas).toBe(8);
      });

      test('should validate auto-scaling configuration', async () => {
        const invalidConfig = {
          enabled: 'not-boolean',
          targetCPU: 150
        };

        const response = await request(app)
          .post(`/api/orchestrator/${scalingTestDeploymentId}/auto-scale`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidConfig)
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      test('should disable auto-scaling', async () => {
        const disableConfig = { enabled: false };

        const response = await request(app)
          .post(`/api/orchestrator/${scalingTestDeploymentId}/auto-scale`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(disableConfig)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.enabled).toBe(false);
      });
    });
  });

  describe('Backup Operations', () => {
    let backupTestDeploymentId: string;

    beforeAll(async () => {
      // Create a deployment for backup tests
      const deployRequest = {
        type: 'postgresql',
        projectId: 'backup-test-project',
        config: {
          name: 'backup-postgres',
          backup: { enabled: true },
          postgresql: {
            name: 'backup-test',
            version: '16',
            features: {
              backup: { enabled: true }
            }
          }
        }
      };

      const response = await request(app)
        .post('/api/orchestrator/deploy')
        .set('Authorization', `Bearer ${authToken}`)
        .send(deployRequest)
        .expect(201);

      backupTestDeploymentId = response.body.data.deploymentId;
    });

    describe('POST /api/orchestrator/:id/backup', () => {
      test('should create manual backup', async () => {
        const backupRequest = {
          type: 'manual',
          compression: true,
          encryption: true
        };

        const response = await request(app)
          .post(`/api/orchestrator/${backupTestDeploymentId}/backup`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(backupRequest)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.backupId).toBeDefined();
        expect(response.body.data.type).toBe('manual');
        expect(response.body.data.createdAt).toBeDefined();
      });

      test('should validate backup options', async () => {
        const invalidBackupRequest = {
          type: 'invalid-type',
          compression: 'not-boolean'
        };

        const response = await request(app)
          .post(`/api/orchestrator/${backupTestDeploymentId}/backup`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidBackupRequest)
          .expect(400);

        expect(response.body.success).toBe(false);
      });
    });

    describe('POST /api/orchestrator/:id/restore', () => {
      let testBackupId: string;

      beforeAll(async () => {
        // Create a backup to restore from
        const backupResponse = await request(app)
          .post(`/api/orchestrator/${backupTestDeploymentId}/backup`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({})
          .expect(200);

        testBackupId = backupResponse.body.data.backupId;
      });

      test('should restore from backup', async () => {
        const restoreRequest = { backupId: testBackupId };

        const response = await request(app)
          .post(`/api/orchestrator/${backupTestDeploymentId}/restore`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(restoreRequest)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Database restored successfully');
      });

      test('should validate restore request', async () => {
        const invalidRestoreRequest = {};

        const response = await request(app)
          .post(`/api/orchestrator/${backupTestDeploymentId}/restore`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidRestoreRequest)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.details.some((d: any) => d.path === 'backupId')).toBe(true);
      });

      test('should handle invalid backup ID', async () => {
        const restoreRequest = { backupId: 'non-existent-backup' };

        const response = await request(app)
          .post(`/api/orchestrator/${backupTestDeploymentId}/restore`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(restoreRequest)
          .expect(500);

        expect(response.body.success).toBe(false);
      });
    });

    describe('POST /api/orchestrator/:id/auto-backup', () => {
      test('should configure auto-backup', async () => {
        const autoBackupConfig = {
          enabled: true,
          frequency: '0 3 * * *',
          retention: 14,
          type: 'full',
          compression: true,
          encryption: true
        };

        const response = await request(app)
          .post(`/api/orchestrator/${backupTestDeploymentId}/auto-backup`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(autoBackupConfig)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.enabled).toBe(true);
        expect(response.body.data.frequency).toBe('0 3 * * *');
        expect(response.body.data.retention).toBe(14);
      });

      test('should validate auto-backup configuration', async () => {
        const invalidConfig = {
          enabled: 'not-boolean',
          retention: -5,
          type: 'invalid-type'
        };

        const response = await request(app)
          .post(`/api/orchestrator/${backupTestDeploymentId}/auto-backup`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidConfig)
          .expect(400);

        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('Tenant Management', () => {
    let tenantTestDeploymentId: string;

    beforeAll(async () => {
      // Create a multi-tenant deployment
      const deployRequest = {
        type: 'postgresql',
        projectId: 'tenant-test-project',
        config: {
          name: 'tenant-postgres',
          postgresql: {
            name: 'tenant-test',
            version: '16',
            tenant_isolation: 'schema',
            max_tenants: 100
          }
        }
      };

      const response = await request(app)
        .post('/api/orchestrator/deploy')
        .set('Authorization', `Bearer ${authToken}`)
        .send(deployRequest)
        .expect(201);

      tenantTestDeploymentId = response.body.data.deploymentId;
    });

    describe('POST /api/orchestrator/:id/tenants', () => {
      test('should create tenant', async () => {
        const tenantRequest = { tenantId: 'api-tenant-create' };

        const response = await request(app)
          .post(`/api/orchestrator/${tenantTestDeploymentId}/tenants`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(tenantRequest)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.tenantId).toBe('api-tenant-create');
        expect(response.body.data.connectionString).toBeDefined();
      });

      test('should validate tenant ID', async () => {
        const invalidTenantRequest = {};

        const response = await request(app)
          .post(`/api/orchestrator/${tenantTestDeploymentId}/tenants`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidTenantRequest)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.details.some((d: any) => d.path === 'tenantId')).toBe(true);
      });

      test('should handle duplicate tenant creation', async () => {
        const tenantRequest = { tenantId: 'duplicate-tenant' };

        // Create tenant first time
        await request(app)
          .post(`/api/orchestrator/${tenantTestDeploymentId}/tenants`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(tenantRequest)
          .expect(201);

        // Try to create same tenant again
        const response = await request(app)
          .post(`/api/orchestrator/${tenantTestDeploymentId}/tenants`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(tenantRequest)
          .expect(500);

        expect(response.body.success).toBe(false);
      });
    });

    describe('DELETE /api/orchestrator/:id/tenants/:tenantId', () => {
      beforeEach(async () => {
        // Create a tenant to delete
        await request(app)
          .post(`/api/orchestrator/${tenantTestDeploymentId}/tenants`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ tenantId: 'api-tenant-delete' })
          .expect(201);
      });

      test('should remove tenant', async () => {
        const response = await request(app)
          .delete(`/api/orchestrator/${tenantTestDeploymentId}/tenants/api-tenant-delete`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Tenant removed successfully');
      });

      test('should handle removal of non-existent tenant', async () => {
        const response = await request(app)
          .delete(`/api/orchestrator/${tenantTestDeploymentId}/tenants/non-existent-tenant`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(500);

        expect(response.body.success).toBe(false);
      });

      test('should validate tenant ID parameter', async () => {
        const response = await request(app)
          .delete(`/api/orchestrator/${tenantTestDeploymentId}/tenants/`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404); // Route not found due to empty parameter
      });
    });
  });

  describe('Monitoring and Health', () => {
    let monitoringTestDeploymentId: string;

    beforeAll(async () => {
      // Create a deployment with monitoring enabled
      const deployRequest = {
        type: 'redis',
        projectId: 'monitoring-test-project',
        config: {
          name: 'monitoring-redis',
          monitoring: {
            enabled: true,
            metricsRetention: 7,
            alerting: {
              enabled: true,
              channels: ['webhook://test-url'],
              thresholds: {
                cpu: 80,
                memory: 85,
                errorRate: 5
              }
            }
          },
          redis: {
            name: 'monitoring-test',
            version: '7.2',
            features: {
              monitoring: { enabled: true }
            }
          }
        }
      };

      const response = await request(app)
        .post('/api/orchestrator/deploy')
        .set('Authorization', `Bearer ${authToken}`)
        .send(deployRequest)
        .expect(201);

      monitoringTestDeploymentId = response.body.data.deploymentId;
    });

    describe('GET /api/orchestrator/health', () => {
      test('should return system health status', async () => {
        const response = await request(app)
          .get('/api/orchestrator/health')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.system).toBeDefined();
        expect(response.body.data.system.status).toMatch(/healthy|degraded|unhealthy/);
        expect(response.body.data.system.deployments).toBeGreaterThanOrEqual(0);
        expect(response.body.data.registry).toBeDefined();
        expect(response.body.data.scheduler).toBeDefined();
        expect(response.body.data.timestamp).toBeDefined();
      });
    });

    describe('GET /api/orchestrator/:id/metrics', () => {
      test('should return deployment metrics', async () => {
        const response = await request(app)
          .get(`/api/orchestrator/${monitoringTestDeploymentId}/metrics`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.metrics).toBeDefined();
        expect(response.body.data.metrics.cpu).toBeGreaterThanOrEqual(0);
        expect(response.body.data.metrics.memory).toBeGreaterThanOrEqual(0);
        expect(response.body.data.metrics.throughput).toBeDefined();
        expect(response.body.data.metrics.performance).toBeDefined();
        expect(response.body.data.health).toBeDefined();
        expect(response.body.data.timestamp).toBeDefined();
      });

      test('should handle metrics for non-existent deployment', async () => {
        const response = await request(app)
          .get('/api/orchestrator/non-existent-deployment/metrics')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Deployment not found');
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/api/orchestrator/deploy')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('invalid-json')
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    test('should handle requests with missing Content-Type', async () => {
      const response = await request(app)
        .post('/api/orchestrator/deploy')
        .set('Authorization', `Bearer ${authToken}`)
        .send('some data')
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    test('should handle very large request payloads', async () => {
      const largeConfig = {
        type: 'postgresql',
        projectId: 'large-request-project',
        config: {
          name: 'large-config-postgres',
          postgresql: {
            name: 'large-test',
            version: '16'
          }
        },
        metadata: 'x'.repeat(100000) // 100KB of metadata
      };

      const response = await request(app)
        .post('/api/orchestrator/deploy')
        .set('Authorization', `Bearer ${authToken}`)
        .send(largeConfig)
        .expect(413); // Payload too large

      expect(response.body.error).toBeDefined();
    });

    test('should handle concurrent requests gracefully', async () => {
      const deployRequests = Array.from({ length: 5 }, (_, i) => ({
        type: 'redis' as const,
        projectId: `concurrent-project-${i}`,
        config: {
          name: `concurrent-redis-${i}`,
          redis: {
            name: `concurrent-test-${i}`,
            version: '7.2'
          }
        }
      }));

      const promises = deployRequests.map(deployRequest =>
        request(app)
          .post('/api/orchestrator/deploy')
          .set('Authorization', `Bearer ${authToken}`)
          .send(deployRequest)
      );

      const responses = await Promise.allSettled(promises);

      // At least some requests should succeed
      const successCount = responses.filter(
        r => r.status === 'fulfilled' && r.value.status === 201
      ).length;

      expect(successCount).toBeGreaterThanOrEqual(1);
    });

    test('should handle rate limiting gracefully', async () => {
      // Send many requests rapidly
      const promises = Array.from({ length: 50 }, () =>
        request(app)
          .get('/api/orchestrator/deployments')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.allSettled(promises);

      // Some requests might be rate limited (429) but system should remain stable
      const statusCodes = responses
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as any).value.status);

      expect(statusCodes).toContain(200); // At least some should succeed
      // If rate limiting is implemented, some might be 429
    });

    test('should validate deployment ID format in URL parameters', async () => {
      const invalidIds = [
        '../../../etc/passwd',
        '<script>alert(1)</script>',
        'id with spaces',
        'id/with/slashes'
      ];

      for (const invalidId of invalidIds) {
        const response = await request(app)
          .get(`/api/orchestrator/deployments/${encodeURIComponent(invalidId)}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);

        expect(response.body.success).toBe(false);
      }
    });

    test('should handle database connection failures', async () => {
      // This test would require mocking database failures
      // For now, we ensure error responses are properly formatted
      const deployRequest = {
        type: 'postgresql',
        projectId: 'db-error-project',
        config: {
          name: 'db-error-postgres',
          postgresql: {
            name: 'error-test',
            version: 'invalid-version' // This should cause an error
          }
        }
      };

      const response = await request(app)
        .post('/api/orchestrator/deploy')
        .set('Authorization', `Bearer ${authToken}`)
        .send(deployRequest)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(typeof response.body.error).toBe('string');
    });
  });
});