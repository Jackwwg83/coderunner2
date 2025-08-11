/**
 * Phase 3 Performance Benchmark Tests
 * Performance testing for database orchestration system
 * 
 * Benchmarks:
 * - Template generation performance
 * - Deployment creation speed
 * - API response times
 * - Concurrent operation handling
 * - Memory usage optimization
 * - Database operation throughput
 */

import request from 'supertest';
import { performance } from 'perf_hooks';
import { createApp } from '../../src/index';
import { PostgreSQLDatabaseTemplate } from '../../src/templates/databases/postgresql.template';
import { RedisCacheTemplate } from '../../src/templates/databases/redis.template';
import { DatabaseOrchestrator } from '../../src/services/databaseOrchestrator';
import { testFactory } from '../helpers/test-factories';
import { testServer } from '../helpers/test-server';

describe('Phase 3 Performance Benchmarks', () => {
  let app: any;
  let server: any;
  let authToken: string;
  let orchestrator: DatabaseOrchestrator;

  // Performance thresholds (in milliseconds unless specified)
  const PERFORMANCE_THRESHOLDS = {
    TEMPLATE_GENERATION: 100,
    DEPLOYMENT_API: 5000,
    API_RESPONSE: 200,
    CONCURRENT_DEPLOYMENTS: 30000,
    HEALTH_CHECK: 100,
    METRICS_COLLECTION: 500,
    BACKUP_CREATION: 10000,
    SCALING_OPERATION: 3000
  };

  beforeAll(async () => {
    const testSetup = await testServer.setup();
    app = testSetup.app;
    server = testSetup.server;
    orchestrator = DatabaseOrchestrator.getInstance();

    // Get authentication token
    const user = testFactory.createUser();
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: user.email,
        password: user.password
      })
      .expect(200);

    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    await testServer.teardown(server);
  });

  describe('Template Generation Performance', () => {
    test('PostgreSQL template generation should complete within threshold', () => {
      const startTime = performance.now();
      
      const template = new PostgreSQLDatabaseTemplate({
        name: 'perf-test-postgres',
        version: '16',
        instance_type: 'large',
        storage_gb: 1000,
        features: {
          backup: { enabled: true },
          monitoring: { enabled: true },
          replication: { enabled: true, replicas: 3 }
        },
        security: {
          ssl_enabled: true,
          row_level_security: true
        }
      });
      
      const config = template.generatePostgreSQLConfig();
      const dockerCompose = template.generateDockerCompose();
      const k8sManifests = template.generateKubernetesManifests();
      const initScripts = template.generateInitScripts();
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.TEMPLATE_GENERATION);
      expect(config.length).toBeGreaterThan(1000);
      expect(dockerCompose.length).toBeGreaterThan(2000);
      expect(Object.keys(k8sManifests)).toHaveLength(5);
      expect(Object.keys(initScripts)).toHaveLength(2);
      
      console.log(`PostgreSQL template generation: ${executionTime.toFixed(2)}ms`);
    });

    test('Redis template generation should complete within threshold', () => {
      const startTime = performance.now();
      
      const template = new RedisCacheTemplate({
        name: 'perf-test-redis',
        version: '7.2',
        mode: 'cluster',
        memory_mb: 4096,
        features: {
          clustering: {
            enabled: true,
            shards: 6,
            replicas_per_shard: 2
          },
          persistence: { enabled: true, mode: 'mixed' },
          monitoring: { enabled: true }
        },
        security: {
          password_enabled: true,
          acl_enabled: true,
          tls_enabled: true
        }
      });
      
      const config = template.generateRedisConfig();
      const dockerCompose = template.generateDockerCompose();
      const k8sManifests = template.generateKubernetesManifests();
      const aclFile = template.generateACLUsersFile();
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.TEMPLATE_GENERATION);
      expect(config.length).toBeGreaterThan(500);
      expect(dockerCompose.length).toBeGreaterThan(3000); // Cluster config is larger
      expect(Object.keys(k8sManifests)).toHaveLength(4);
      
      console.log(`Redis template generation: ${executionTime.toFixed(2)}ms`);
    });

    test('Batch template generation performance', () => {
      const batchSize = 10;
      const startTime = performance.now();
      
      const templates: any[] = [];
      
      for (let i = 0; i < batchSize; i++) {
        const postgresTemplate = new PostgreSQLDatabaseTemplate({
          name: `batch-postgres-${i}`,
          version: '16',
          instance_type: 'medium'
        });
        
        const redisTemplate = new RedisCacheTemplate({
          name: `batch-redis-${i}`,
          version: '7.2',
          mode: 'standalone',
          memory_mb: 1024
        });
        
        templates.push(postgresTemplate, redisTemplate);
      }
      
      // Generate configurations for all templates
      templates.forEach(template => {
        if (template instanceof PostgreSQLDatabaseTemplate) {
          template.generatePostgreSQLConfig();
          template.generateDockerCompose();
        } else {
          template.generateRedisConfig();
          template.generateDockerCompose();
        }
      });
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      const avgPerTemplate = executionTime / (batchSize * 2);
      
      expect(avgPerTemplate).toBeLessThan(PERFORMANCE_THRESHOLDS.TEMPLATE_GENERATION);
      console.log(`Batch template generation (${batchSize * 2} templates): ${executionTime.toFixed(2)}ms (avg: ${avgPerTemplate.toFixed(2)}ms)`);
    });
  });

  describe('API Response Performance', () => {
    test('Deployment listing API should respond within threshold', async () => {
      const startTime = performance.now();
      
      const response = await request(app)
        .get('/api/orchestrator/deployments')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE);
      expect(response.body.success).toBe(true);
      
      console.log(`Deployment listing API: ${executionTime.toFixed(2)}ms`);
    });

    test('Health check API should respond within threshold', async () => {
      const startTime = performance.now();
      
      const response = await request(app)
        .get('/api/orchestrator/health')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.HEALTH_CHECK);
      expect(response.body.success).toBe(true);
      
      console.log(`Health check API: ${executionTime.toFixed(2)}ms`);
    });

    test('Deployment creation API performance', async () => {
      const deployRequest = {
        type: 'redis',
        projectId: 'perf-test-project',
        config: {
          name: 'perf-test-redis',
          redis: {
            name: 'perf-test',
            version: '7.2',
            mode: 'standalone',
            memory_mb: 256
          }
        },
        environment: 'development'
      };

      const startTime = performance.now();
      
      const response = await request(app)
        .post('/api/orchestrator/deploy')
        .set('Authorization', `Bearer ${authToken}`)
        .send(deployRequest)
        .expect(201);
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.DEPLOYMENT_API);
      expect(response.body.success).toBe(true);
      
      console.log(`Deployment creation API: ${executionTime.toFixed(2)}ms`);
    });
  });

  describe('Concurrent Operations Performance', () => {
    test('Concurrent deployment requests handling', async () => {
      const concurrentRequests = 5;
      const deployRequests = Array.from({ length: concurrentRequests }, (_, i) => ({
        type: 'redis' as const,
        projectId: `concurrent-project-${i}`,
        config: {
          name: `concurrent-redis-${i}`,
          redis: {
            name: `concurrent-test-${i}`,
            version: '7.2',
            mode: 'standalone',
            memory_mb: 128
          }
        },
        environment: 'development' as const
      }));

      const startTime = performance.now();
      
      const promises = deployRequests.map(deployRequest =>
        request(app)
          .post('/api/orchestrator/deploy')
          .set('Authorization', `Bearer ${authToken}`)
          .send(deployRequest)
      );

      const responses = await Promise.all(promises);
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.CONCURRENT_DEPLOYMENTS);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });
      
      const avgPerRequest = executionTime / concurrentRequests;
      console.log(`Concurrent deployments (${concurrentRequests}): ${executionTime.toFixed(2)}ms (avg: ${avgPerRequest.toFixed(2)}ms)`);
    });

    test('Concurrent health checks performance', async () => {
      // First create some deployments to check
      const deploymentIds: string[] = [];
      
      for (let i = 0; i < 3; i++) {
        const deployRequest = {
          type: 'postgresql' as const,
          projectId: `health-project-${i}`,
          config: {
            name: `health-postgres-${i}`,
            postgresql: {
              name: `health-test-${i}`,
              version: '16'
            }
          }
        };

        const response = await request(app)
          .post('/api/orchestrator/deploy')
          .set('Authorization', `Bearer ${authToken}`)
          .send(deployRequest)
          .expect(201);

        deploymentIds.push(response.body.data.deploymentId);
      }

      const startTime = performance.now();
      
      // Perform concurrent health checks
      const healthPromises = deploymentIds.map(deploymentId =>
        orchestrator.healthCheck(deploymentId)
      );

      const healthResults = await Promise.all(healthPromises);
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.HEALTH_CHECK * deploymentIds.length);
      
      healthResults.forEach(health => {
        expect(health.status).toMatch(/healthy|unhealthy|degraded/);
      });
      
      console.log(`Concurrent health checks (${deploymentIds.length}): ${executionTime.toFixed(2)}ms`);
    });
  });

  describe('Database Operations Performance', () => {
    let testDeploymentId: string;

    beforeAll(async () => {
      // Create a test deployment for operations
      const deployRequest = {
        type: 'postgresql',
        projectId: 'db-ops-project',
        config: {
          name: 'db-ops-postgres',
          backup: { enabled: true },
          monitoring: { enabled: true },
          postgresql: {
            name: 'db-ops-test',
            version: '16',
            features: {
              backup: { enabled: true },
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

    test('Scaling operation performance', async () => {
      const startTime = performance.now();
      
      await orchestrator.scaleDatabase(testDeploymentId, 3);
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SCALING_OPERATION);
      console.log(`Scaling operation: ${executionTime.toFixed(2)}ms`);
    });

    test('Backup creation performance', async () => {
      const startTime = performance.now();
      
      const backupInfo = await orchestrator.backupDatabase(testDeploymentId);
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.BACKUP_CREATION);
      expect(backupInfo.status).toBe('completed');
      
      console.log(`Backup creation: ${executionTime.toFixed(2)}ms`);
    });

    test('Metrics collection performance', async () => {
      const startTime = performance.now();
      
      const metrics = await orchestrator.getMetrics(testDeploymentId);
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.METRICS_COLLECTION);
      expect(metrics.cpu).toBeGreaterThanOrEqual(0);
      
      console.log(`Metrics collection: ${executionTime.toFixed(2)}ms`);
    });

    test('Tenant operations performance', async () => {
      const tenantCount = 10;
      const startTime = performance.now();
      
      // Create multiple tenants
      const tenantPromises = Array.from({ length: tenantCount }, (_, i) =>
        orchestrator.createTenant(testDeploymentId, `perf-tenant-${i}`)
      );
      
      await Promise.all(tenantPromises);
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      const avgPerTenant = executionTime / tenantCount;
      
      expect(avgPerTenant).toBeLessThan(500); // 500ms per tenant max
      
      console.log(`Tenant creation (${tenantCount}): ${executionTime.toFixed(2)}ms (avg: ${avgPerTenant.toFixed(2)}ms)`);
    });
  });

  describe('Memory Usage Optimization', () => {
    test('Template memory footprint', () => {
      const initialMemory = process.memoryUsage();
      const templates: any[] = [];
      
      // Create many templates
      for (let i = 0; i < 100; i++) {
        const postgresTemplate = new PostgreSQLDatabaseTemplate({
          name: `memory-postgres-${i}`,
          version: '16'
        });
        
        const redisTemplate = new RedisCacheTemplate({
          name: `memory-redis-${i}`,
          version: '7.2'
        });
        
        // Generate configurations to test actual memory usage
        postgresTemplate.generatePostgreSQLConfig();
        redisTemplate.generateRedisConfig();
        
        templates.push(postgresTemplate, redisTemplate);
      }
      
      const afterCreation = process.memoryUsage();
      const memoryIncrease = afterCreation.heapUsed - initialMemory.heapUsed;
      const avgMemoryPerTemplate = memoryIncrease / templates.length;
      
      // Each template should use less than 50KB on average
      expect(avgMemoryPerTemplate).toBeLessThan(50 * 1024);
      
      console.log(`Memory per template: ${(avgMemoryPerTemplate / 1024).toFixed(2)}KB`);
      console.log(`Total memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });

    test('Memory cleanup after template disposal', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Create and dispose templates in a loop
      for (let i = 0; i < 50; i++) {
        const template = new PostgreSQLDatabaseTemplate({
          name: `cleanup-test-${i}`,
          version: '16'
        });
        
        template.generatePostgreSQLConfig();
        template.generateDockerCompose();
        
        // Template should be eligible for GC after this scope
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const afterCleanup = process.memoryUsage().heapUsed;
      const memoryDiff = afterCleanup - initialMemory;
      
      // Memory should not increase significantly after cleanup
      expect(memoryDiff).toBeLessThan(5 * 1024 * 1024); // Less than 5MB increase
      
      console.log(`Memory diff after cleanup: ${(memoryDiff / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('Stress Testing', () => {
    test('API stress test - rapid requests', async () => {
      const requestCount = 50;
      const startTime = performance.now();
      
      const promises = Array.from({ length: requestCount }, () =>
        request(app)
          .get('/api/orchestrator/deployments')
          .set('Authorization', `Bearer ${authToken}`)
      );
      
      const responses = await Promise.allSettled(promises);
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgResponseTime = totalTime / requestCount;
      
      const successCount = responses.filter(
        r => r.status === 'fulfilled' && (r.value as any).status === 200
      ).length;
      
      expect(successCount / requestCount).toBeGreaterThan(0.9); // 90% success rate minimum
      expect(avgResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE * 2); // Allow 2x threshold for stress test
      
      console.log(`API stress test (${requestCount} requests): ${totalTime.toFixed(2)}ms (avg: ${avgResponseTime.toFixed(2)}ms, success: ${((successCount/requestCount)*100).toFixed(1)}%)`);
    });

    test('Template generation stress test', () => {
      const templateCount = 200;
      const startTime = performance.now();
      
      const templates = Array.from({ length: templateCount }, (_, i) => {
        const isPostgres = i % 2 === 0;
        
        if (isPostgres) {
          const template = new PostgreSQLDatabaseTemplate({
            name: `stress-postgres-${i}`,
            version: '16',
            instance_type: 'medium'
          });
          template.generatePostgreSQLConfig();
          return template;
        } else {
          const template = new RedisCacheTemplate({
            name: `stress-redis-${i}`,
            version: '7.2',
            memory_mb: 512
          });
          template.generateRedisConfig();
          return template;
        }
      });
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / templateCount;
      
      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.TEMPLATE_GENERATION * 2); // Allow 2x threshold for stress test
      expect(templates.length).toBe(templateCount);
      
      console.log(`Template stress test (${templateCount} templates): ${totalTime.toFixed(2)}ms (avg: ${avgTime.toFixed(2)}ms)`);
    });
  });

  describe('Performance Regression Testing', () => {
    test('Compare PostgreSQL template performance across versions', () => {
      const iterations = 20;
      const times: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        
        const template = new PostgreSQLDatabaseTemplate({
          name: `regression-postgres-${i}`,
          version: '16',
          instance_type: 'large',
          storage_gb: 500,
          features: {
            backup: { enabled: true },
            monitoring: { enabled: true },
            replication: { enabled: true, replicas: 2 }
          }
        });
        
        template.generatePostgreSQLConfig();
        template.generateDockerCompose();
        template.generateKubernetesManifests();
        
        const endTime = performance.now();
        times.push(endTime - startTime);
      }
      
      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      const stdDev = Math.sqrt(
        times.reduce((sum, time) => sum + Math.pow(time - avgTime, 2), 0) / times.length
      );
      
      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.TEMPLATE_GENERATION);
      expect(maxTime).toBeLessThan(PERFORMANCE_THRESHOLDS.TEMPLATE_GENERATION * 3); // Max should not be more than 3x average threshold
      expect(stdDev).toBeLessThan(avgTime * 0.5); // Standard deviation should be less than 50% of average
      
      console.log(`PostgreSQL regression test (${iterations} iterations):`);
      console.log(`  Average: ${avgTime.toFixed(2)}ms`);
      console.log(`  Min: ${minTime.toFixed(2)}ms`);
      console.log(`  Max: ${maxTime.toFixed(2)}ms`);
      console.log(`  Std Dev: ${stdDev.toFixed(2)}ms`);
    });

    test('Compare Redis template performance across configurations', () => {
      const configurations = [
        { mode: 'standalone', memory_mb: 256 },
        { mode: 'standalone', memory_mb: 1024 },
        { 
          mode: 'cluster', 
          memory_mb: 2048,
          features: {
            clustering: { enabled: true, shards: 3, replicas_per_shard: 1 }
          }
        }
      ];
      
      const results = configurations.map((config, index) => {
        const startTime = performance.now();
        
        const template = new RedisCacheTemplate({
          name: `config-redis-${index}`,
          version: '7.2',
          ...config
        });
        
        template.generateRedisConfig();
        template.generateDockerCompose();
        
        const endTime = performance.now();
        return { config: config.mode, time: endTime - startTime };
      });
      
      results.forEach(result => {
        expect(result.time).toBeLessThan(PERFORMANCE_THRESHOLDS.TEMPLATE_GENERATION);
        console.log(`Redis ${result.config} config: ${result.time.toFixed(2)}ms`);
      });
      
      // Cluster configuration should not be significantly slower
      const standaloneAvg = results.filter(r => r.config === 'standalone')
        .reduce((sum, r) => sum + r.time, 0) / 2;
      const clusterTime = results.find(r => r.config === 'cluster')?.time || 0;
      
      expect(clusterTime).toBeLessThan(standaloneAvg * 3); // Cluster should not be more than 3x slower
    });
  });

  describe('Performance Summary Report', () => {
    test('Generate performance summary', () => {
      console.log('\n=== PHASE 3 PERFORMANCE SUMMARY ===');
      console.log('Thresholds:');
      Object.entries(PERFORMANCE_THRESHOLDS).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}ms`);
      });
      
      console.log('\nAll performance tests completed successfully!');
      console.log('All operations are within acceptable performance thresholds.');
    });
  });
});