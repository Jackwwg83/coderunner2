/**
 * Redis Template Integration Tests
 * P3-T02 Implementation for CodeRunner v2.0
 * 
 * Integration tests for Redis template system including:
 * - Template API endpoints
 * - Redis deployment workflow
 * - Multi-tenant operations
 * - Performance and caching features
 */

import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import app from '../../src/index';
import { generateTestToken } from '../helpers/auth-helper';

describe('Redis Template Integration Tests', () => {
  let authToken: string;
  let deploymentId: string;

  beforeAll(async () => {
    // Generate test authentication token
    authToken = generateTestToken({
      userId: 'test-user-redis',
      email: 'redis.test@example.com',
      role: 'admin'
    });
  });

  afterAll(async () => {
    // Cleanup any created deployments
    if (deploymentId) {
      await request(app)
        .delete(`/api/templates/redis/${deploymentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ confirmation: 'DELETE_CONFIRMED' });
    }
  });

  describe('Redis Template API Endpoints', () => {
    it('should list Redis templates in template catalog', async () => {
      const response = await request(app)
        .get('/api/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ category: 'cache' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.templates).toBeDefined();
      
      // Find Redis template
      const redisTemplate = response.body.data.templates.find(
        (t: any) => t.id === 'redis-advanced'
      );
      expect(redisTemplate).toBeDefined();
      expect(redisTemplate.name).toBe('Redis Advanced Caching');
      expect(redisTemplate.category).toBe('cache');
    });

    it('should get Redis template details', async () => {
      const response = await request(app)
        .get('/api/templates/redis-advanced')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.template.id).toBe('redis-advanced');
      expect(response.body.data.environment_presets).toBeDefined();
      expect(response.body.data.environment_presets.development).toBeDefined();
      expect(response.body.data.environment_presets.production).toBeDefined();
    });
  });

  describe('Redis Deployment Workflow', () => {
    it('should deploy Redis template successfully', async () => {
      const deploymentConfig = {
        name: 'test-redis-integration',
        version: '7.2',
        mode: 'standalone',
        instance_type: 'cache.t3.small',
        memory_mb: 1024,
        environment: 'development',
        tenant_config: {
          isolation_type: 'key_prefix',
          key_prefix_pattern: 'tenant:{tenantId}:',
          max_tenants: 10
        },
        features: {
          persistence: {
            enabled: false,
            mode: 'rdb'
          },
          monitoring: {
            enabled: true,
            metrics: ['memory', 'ops'],
            collection_interval: 60,
            alert_rules: []
          }
        },
        security: {
          password_enabled: false,
          protected_mode: false
        }
      };

      const response = await request(app)
        .post('/api/templates/redis/deploy')
        .set('Authorization', `Bearer ${authToken}`)
        .send(deploymentConfig)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.deployment).toBeDefined();
      expect(response.body.data.deployment.status).toBe('success');
      expect(response.body.data.deployment.connection_url).toBeDefined();
      expect(response.body.data.template_summary).toBeDefined();
      expect(response.body.data.connection_info.primary_url).toBeDefined();

      deploymentId = response.body.data.deployment.instance_id;
      expect(deploymentId).toBeDefined();
    });

    it('should list Redis deployments', async () => {
      const response = await request(app)
        .get('/api/templates/redis/deployments')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.deployments).toBeDefined();
      expect(Array.isArray(response.body.data.deployments)).toBe(true);
      expect(response.body.data.total).toBeGreaterThan(0);
    });

    it('should get Redis deployment details', async () => {
      const response = await request(app)
        .get(`/api/templates/redis/${deploymentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.deployment.instance_id).toBe(deploymentId);
      expect(response.body.data.status).toBeDefined();
      expect(response.body.data.detailed_metrics).toBeDefined();
      expect(response.body.data.health_check).toBeDefined();
    });

    it('should fail deployment with invalid configuration', async () => {
      const invalidConfig = {
        name: '',  // Invalid name
        memory_mb: 50,  // Too small
        tenant_config: {
          isolation_type: 'key_prefix',
          key_prefix_pattern: 'invalid-pattern'  // Missing placeholder
        }
      };

      const response = await request(app)
        .post('/api/templates/redis/deploy')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidConfig)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('validation');
    });
  });

  describe('Multi-Tenant Operations', () => {
    let tenantId: string;

    it('should create a Redis tenant', async () => {
      tenantId = 'test-tenant-' + Date.now();
      
      const tenantConfig = {
        tenant_id: tenantId,
        maxMemoryMb: 100,
        maxConnections: 10,
        defaultTtl: 3600
      };

      const response = await request(app)
        .post(`/api/templates/redis/${deploymentId}/tenants`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(tenantConfig)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tenant).toBeDefined();
      expect(response.body.data.tenant.tenant_id).toBe(tenantId);
      expect(response.body.data.tenant.key_prefix).toBe(`tenant:${tenantId}:`);
      expect(response.body.data.connection_example).toBeDefined();
      expect(response.body.data.connection_example.sample_commands).toBeDefined();
    });

    it('should get tenant statistics', async () => {
      const response = await request(app)
        .get(`/api/templates/redis/${deploymentId}/tenants/${tenantId}/stats`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tenant_stats).toBeDefined();
      expect(response.body.data.tenant_stats.tenant_id).toBe(tenantId);
      expect(response.body.data.recommendations).toBeDefined();
    });

    it('should execute tenant-scoped Redis command', async () => {
      const command = `SET user:123 "test_data"`;
      
      const response = await request(app)
        .post(`/api/templates/redis/${deploymentId}/tenants/${tenantId}/execute`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ command })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.command).toBe(command);
      expect(response.body.data.result).toBeDefined();
      expect(response.body.data.execution_time_ms).toBeDefined();
    });

    it('should reject dangerous commands for tenant operations', async () => {
      const dangerousCommand = 'FLUSHALL';
      
      const response = await request(app)
        .post(`/api/templates/redis/${deploymentId}/tenants/${tenantId}/execute`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ command: dangerousCommand })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not allowed');
    });

    it('should remove Redis tenant', async () => {
      const response = await request(app)
        .delete(`/api/templates/redis/${deploymentId}/tenants/${tenantId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tenant_id).toBe(tenantId);
    });
  });

  describe('Redis Instance Operations', () => {
    it('should get Redis instance statistics', async () => {
      const response = await request(app)
        .get(`/api/templates/redis/${deploymentId}/stats`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ detailed: 'true' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.stats).toBeDefined();
      expect(response.body.data.stats.memory).toBeDefined();
      expect(response.body.data.stats.performance).toBeDefined();
      expect(response.body.data.stats.connections).toBeDefined();
      expect(response.body.data.key_analysis).toBeDefined();
    });

    it('should create Redis backup', async () => {
      const response = await request(app)
        .post(`/api/templates/redis/${deploymentId}/backup`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(202);

      expect(response.body.success).toBe(true);
      expect(response.body.data.backup).toBeDefined();
      expect(response.body.data.backup.backupId).toBeDefined();
      expect(response.body.data.estimated_completion_time).toBeDefined();
    });

    it('should optimize Redis memory', async () => {
      const response = await request(app)
        .post(`/api/templates/redis/${deploymentId}/optimize`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.optimization_result).toBeDefined();
      expect(response.body.data.recommendations).toBeDefined();
    });

    it('should warm Redis cache', async () => {
      const warmingConfig = {
        datasets: ['users', 'sessions'],
        batchSize: 100,
        keyPatterns: ['cache:*', 'user:*']
      };

      const response = await request(app)
        .post(`/api/templates/redis/${deploymentId}/warm-cache`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(warmingConfig)
        .expect(202);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('warming_started');
    });

    it('should scale Redis instance', async () => {
      const scalingConfig = {
        memory_mb: 2048,
        max_clients: 2000
      };

      const response = await request(app)
        .post(`/api/templates/redis/${deploymentId}/scale`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(scalingConfig)
        .expect(202);

      expect(response.body.success).toBe(true);
      expect(response.body.data.scaling_config).toBeDefined();
      expect(response.body.data.estimated_completion_time).toBeDefined();
    });

    it('should execute Redis commands (admin)', async () => {
      const command = 'INFO memory';

      const response = await request(app)
        .post(`/api/templates/redis/${deploymentId}/execute`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ command })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.result).toBeDefined();
    });

    it('should require confirmation for dangerous Redis commands', async () => {
      const dangerousCommand = 'FLUSHALL';

      // First, try without confirmation
      const response1 = await request(app)
        .post(`/api/templates/redis/${deploymentId}/execute`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ command: dangerousCommand })
        .expect(400);

      expect(response1.body.success).toBe(false);
      expect(response1.body.error).toContain('confirmation');

      // Then, try with confirmation
      const response2 = await request(app)
        .post(`/api/templates/redis/${deploymentId}/execute`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ 
          command: dangerousCommand,
          confirm_dangerous: true
        })
        .expect(200);

      expect(response2.body.success).toBe(true);
    });
  });

  describe('Redis Security and Validation', () => {
    it('should validate Redis flush operations', async () => {
      // Should fail without proper confirmation
      const response1 = await request(app)
        .post(`/api/templates/redis/${deploymentId}/flush`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          confirmation: 'INVALID',
          scope: 'all'
        })
        .expect(400);

      expect(response1.body.success).toBe(false);
      expect(response1.body.error).toContain('confirmation');

      // Should work with proper confirmation
      const response2 = await request(app)
        .post(`/api/templates/redis/${deploymentId}/flush`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          confirmation: 'FLUSH_CONFIRMED',
          scope: 'database',
          database_number: 0
        })
        .expect(200);

      expect(response2.body.success).toBe(true);
    });

    it('should require proper authentication', async () => {
      const response = await request(app)
        .get(`/api/templates/redis/${deploymentId}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should validate deployment destruction', async () => {
      // Should fail without proper confirmation
      const response1 = await request(app)
        .delete(`/api/templates/redis/${deploymentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ confirmation: 'INVALID' })
        .expect(400);

      expect(response1.body.success).toBe(false);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle non-existent deployment gracefully', async () => {
      const response = await request(app)
        .get('/api/templates/redis/non-existent-deployment')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });

    it('should validate required fields for deployment', async () => {
      const response = await request(app)
        .post('/api/templates/redis/deploy')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})  // Empty config
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle tenant operations on non-existent deployment', async () => {
      const response = await request(app)
        .post('/api/templates/redis/non-existent/tenants')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ tenant_id: 'test-tenant' })
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle multiple concurrent requests', async () => {
      const requests = Array(5).fill(null).map(() =>
        request(app)
          .get(`/api/templates/redis/${deploymentId}/stats`)
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    it('should respond quickly to health checks', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/health/quick')
        .expect(200);

      const responseTime = Date.now() - startTime;
      
      expect(responseTime).toBeLessThan(100); // Should respond in under 100ms
      expect(response.body.success).toBe(true);
    });
  });
});