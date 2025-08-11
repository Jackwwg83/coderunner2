/**
 * Redis Template System Tests
 * P3-T02 Implementation for CodeRunner v2.0
 * 
 * Test Coverage:
 * - Redis template creation and validation
 * - Multi-tenant key isolation
 * - Cluster configuration
 * - Persistence settings
 * - Performance benchmarks
 * - Security configuration
 * - Cache warming and strategies
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { RedisCacheTemplate, createRedisTemplate, createEnvironmentRedisTemplate } from '../../src/templates/databases/redis.template';
import { RedisService, RedisTenantManager } from '../../src/templates/databases/redis.service';
import { 
  RedisTemplate, 
  validateRedisTemplate, 
  DEFAULT_REDIS_TEMPLATE,
  REDIS_ENVIRONMENT_PRESETS 
} from '../../src/templates/databases/redis.config';

describe('Redis Template System', () => {
  let template: RedisCacheTemplate;
  let redisService: RedisService;
  let tenantManager: RedisTenantManager;

  beforeEach(() => {
    template = createRedisTemplate({
      name: 'test-redis',
      environment: 'development'
    });
    redisService = new RedisService();
    tenantManager = new RedisTenantManager(redisService);
  });

  afterEach(() => {
    // Cleanup any resources if needed
  });

  describe('Template Creation and Validation', () => {
    it('should create a Redis template with default settings', () => {
      const template = createRedisTemplate();
      const config = template.getTemplate();
      
      expect(config.version).toBe('7.2');
      expect(config.mode).toBe('standalone');
      expect(config.instance_type).toBe('cache.t3.small');
      expect(config.memory_mb).toBe(1024);
      expect(config.tenant_config.isolation_type).toBe('key_prefix');
    });

    it('should create environment-specific templates', () => {
      const devTemplate = createEnvironmentRedisTemplate('development', 'dev-redis');
      const prodTemplate = createEnvironmentRedisTemplate('production', 'prod-redis');
      
      const devConfig = devTemplate.getTemplate();
      const prodConfig = prodTemplate.getTemplate();
      
      expect(devConfig.environment).toBe('development');
      expect(devConfig.instance_type).toBe('cache.t3.micro');
      expect(devConfig.security.password_enabled).toBe(false);
      
      expect(prodConfig.environment).toBe('production');
      expect(prodConfig.instance_type).toBe('cache.m6i.large');
      expect(prodConfig.security.password_enabled).toBe(true);
      expect(prodConfig.security.tls_enabled).toBe(true);
      expect(prodConfig.features.clustering.enabled).toBe(true);
    });

    it('should validate Redis template configuration', () => {
      const validConfig: Partial<RedisTemplate> = {
        name: 'valid-redis',
        version: '7.2',
        mode: 'standalone',
        instance_type: 'cache.t3.small',
        memory_mb: 1024,
        tenant_config: {
          isolation_type: 'key_prefix',
          key_prefix_pattern: 'tenant:{tenantId}:',
          max_tenants: 100,
          tenant_resource_limits: {
            max_memory_per_tenant_mb: 100,
            max_connections_per_tenant: 10,
            max_ops_per_second_per_tenant: 1000
          },
          tenant_management: {
            auto_provisioning: true,
            resource_quotas: true,
            access_control: true
          }
        }
      };

      const template = createRedisTemplate(validConfig);
      const validation = template.validate();
      
      expect(validation.isValid).toBe(true);
      expect(Object.keys(validation.errors)).toHaveLength(0);
    });

    it('should fail validation for invalid configuration', () => {
      const invalidConfig: Partial<RedisTemplate> = {
        name: '',
        memory_mb: 50, // Too small
        tenant_config: {
          isolation_type: 'key_prefix',
          key_prefix_pattern: 'invalid-pattern', // Missing placeholder
          max_tenants: 100,
          tenant_resource_limits: {
            max_memory_per_tenant_mb: 100,
            max_connections_per_tenant: 10,
            max_ops_per_second_per_tenant: 1000
          },
          tenant_management: {
            auto_provisioning: true,
            resource_quotas: true,
            access_control: true
          }
        },
        connection: {
          max_clients: 70000, // Too large
          timeout_ms: 0,
          tcp_keepalive: 300,
          tcp_backlog: 511,
          client_output_buffer_limit: {
            normal: '0 0 0',
            replica: '256mb 64mb 60',
            pubsub: '32mb 8mb 60'
          }
        }
      };

      const validation = validateRedisTemplate(invalidConfig as RedisTemplate);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.name).toBeDefined();
      expect(validation.errors.memory_mb).toBeDefined();
      expect(validation.errors['tenant_config.key_prefix_pattern']).toBeDefined();
      expect(validation.errors['connection.max_clients']).toBeDefined();
    });

    it('should validate cluster configuration', () => {
      const clusterConfig: Partial<RedisTemplate> = {
        name: 'cluster-redis',
        mode: 'cluster',
        features: {
          clustering: {
            enabled: true,
            shards: 3,
            replicas_per_shard: 1,
            cluster_node_timeout: 15000
          }
        }
      };

      const template = createRedisTemplate(clusterConfig);
      const validation = template.validate();
      
      expect(validation.isValid).toBe(true);
      
      // Test invalid cluster configuration
      const invalidClusterConfig = {
        ...clusterConfig,
        features: {
          clustering: {
            enabled: true,
            shards: 2, // Even number, should be odd
            replicas_per_shard: 1
          }
        }
      };

      const invalidValidation = validateRedisTemplate(invalidClusterConfig as RedisTemplate);
      expect(invalidValidation.isValid).toBe(false);
    });
  });

  describe('Redis Configuration Generation', () => {
    it('should generate valid Redis configuration file', () => {
      const config = template.generateRedisConfig();
      
      expect(config).toContain('# Redis Configuration');
      expect(config).toContain('bind 0.0.0.0');
      expect(config).toContain('port 6379');
      expect(config).toContain('maxmemory 1024mb');
      expect(config).toContain('maxmemory-policy allkeys-lru');
      expect(config).toContain('maxclients 1000');
    });

    it('should generate cluster configuration when enabled', () => {
      const clusterTemplate = createRedisTemplate({
        name: 'cluster-redis',
        mode: 'cluster',
        features: {
          clustering: {
            enabled: true,
            shards: 3,
            replicas_per_shard: 1,
            cluster_node_timeout: 15000
          }
        }
      });

      const config = clusterTemplate.generateRedisConfig();
      
      expect(config).toContain('cluster-enabled yes');
      expect(config).toContain('cluster-node-timeout 15000');
    });

    it('should generate persistence configuration', () => {
      const persistentTemplate = createRedisTemplate({
        name: 'persistent-redis',
        features: {
          persistence: {
            enabled: true,
            mode: 'mixed',
            rdb_schedule: 'save 900 1 300 10 60 10000',
            aof_fsync: 'everysec'
          }
        }
      });

      const config = persistentTemplate.generateRedisConfig();
      
      expect(config).toContain('save 900 1 300 10 60 10000');
      expect(config).toContain('appendonly yes');
      expect(config).toContain('appendfsync everysec');
    });

    it('should generate security configuration', () => {
      const secureTemplate = createRedisTemplate({
        name: 'secure-redis',
        security: {
          password_enabled: true,
          password: 'test-password',
          acl_enabled: true,
          tls_enabled: true,
          ip_whitelist: ['127.0.0.1/32'],
          protected_mode: true,
          rename_dangerous_commands: {
            'FLUSHDB': 'FLUSHDB_RENAMED',
            'FLUSHALL': 'FLUSHALL_RENAMED'
          }
        }
      });

      const config = secureTemplate.generateRedisConfig();
      
      expect(config).toContain('requirepass test-password');
      expect(config).toContain('protected-mode yes');
      expect(config).toContain('tls-port 6380');
      expect(config).toContain('rename-command FLUSHDB FLUSHDB_RENAMED');
      expect(config).toContain('rename-command FLUSHALL FLUSHALL_RENAMED');
    });
  });

  describe('Docker Compose Generation', () => {
    it('should generate Docker Compose for standalone Redis', () => {
      const compose = template.generateDockerCompose();
      
      expect(compose).toContain('version: \'3.8\'');
      expect(compose).toContain('redis:7.2-alpine');
      expect(compose).toContain('redis-server /usr/local/etc/redis/redis.conf');
      expect(compose).toContain('- "6379:6379"');
    });

    it('should generate Docker Compose for Redis cluster', () => {
      const clusterTemplate = createRedisTemplate({
        name: 'cluster-redis',
        mode: 'cluster',
        features: {
          clustering: {
            enabled: true,
            shards: 3,
            replicas_per_shard: 1
          }
        }
      });

      const compose = clusterTemplate.generateDockerCompose();
      
      expect(compose).toContain('redis-node-1');
      expect(compose).toContain('redis-node-2');
      expect(compose).toContain('redis-node-3');
      expect(compose).toContain('redis-cluster-init');
      expect(compose).toContain('--cluster create');
      expect(compose).toContain('--cluster-replicas 1');
    });

    it('should include monitoring services when enabled', () => {
      const monitoredTemplate = createRedisTemplate({
        name: 'monitored-redis',
        features: {
          monitoring: {
            enabled: true,
            metrics: ['memory', 'cpu', 'ops'],
            collection_interval: 60,
            alert_rules: []
          }
        }
      });

      const compose = monitoredTemplate.generateDockerCompose();
      
      expect(compose).toContain('redis-exporter');
      expect(compose).toContain('oliver006/redis_exporter:latest');
      expect(compose).toContain('- "9121:9121"');
    });
  });

  describe('Kubernetes Manifests Generation', () => {
    it('should generate Kubernetes manifests for standalone Redis', () => {
      const manifests = template.generateKubernetesManifests();
      
      expect(manifests['redis-config.yaml']).toContain('ConfigMap');
      expect(manifests['redis-secret.yaml']).toContain('Secret');
      expect(manifests['redis-deployment.yaml']).toContain('Deployment');
      expect(manifests['redis-service.yaml']).toContain('Service');
    });

    it('should generate StatefulSet for Redis cluster', () => {
      const clusterTemplate = createRedisTemplate({
        name: 'k8s-cluster',
        mode: 'cluster',
        features: {
          clustering: {
            enabled: true,
            shards: 3,
            replicas_per_shard: 1
          }
        }
      });

      const manifests = clusterTemplate.generateKubernetesManifests();
      
      expect(manifests['redis-cluster.yaml']).toContain('StatefulSet');
      expect(manifests['redis-cluster.yaml']).toContain('replicas: 6'); // 3 shards * (1 replica + 1 master)
    });
  });

  describe('Multi-Tenant Management', () => {
    it('should add tenants with key prefix isolation', () => {
      const tenant = template.addTenant('tenant-123', {
        resource_limits: {
          max_memory_mb: 50,
          max_connections: 5,
          max_ops_per_second: 500,
          max_keys: 10000
        }
      });

      expect(tenant.tenant_id).toBe('tenant-123');
      expect(tenant.key_prefix).toBe('tenant:tenant-123:');
      expect(tenant.resource_limits.max_memory_mb).toBe(50);
      expect(tenant.status).toBe('active');
    });

    it('should remove tenants', () => {
      template.addTenant('tenant-456');
      
      expect(template.getTenant('tenant-456')).toBeDefined();
      
      const removed = template.removeTenant('tenant-456');
      expect(removed).toBe(true);
      expect(template.getTenant('tenant-456')).toBeUndefined();
    });

    it('should get all tenants', () => {
      template.addTenant('tenant-1');
      template.addTenant('tenant-2');
      template.addTenant('tenant-3');

      const tenants = template.getTenants();
      expect(tenants).toHaveLength(3);
      expect(tenants.map(t => t.tenant_id)).toContain('tenant-1');
      expect(tenants.map(t => t.tenant_id)).toContain('tenant-2');
      expect(tenants.map(t => t.tenant_id)).toContain('tenant-3');
    });

    it('should generate tenant-specific Redis commands', () => {
      const tenant = template.addTenant('test-tenant');
      const commands = template.generateTenantCommands('test-tenant');

      // Should generate ACL commands if ACL is enabled
      template.updateTemplate({
        security: {
          ...template.getTemplate().security,
          acl_enabled: true
        }
      });

      const aclCommands = template.generateTenantCommands('test-tenant');
      expect(aclCommands.length).toBeGreaterThan(0);
      expect(aclCommands.some(cmd => cmd.includes('ACL SETUSER'))).toBe(true);
    });
  });

  describe('Performance and Caching Features', () => {
    it('should configure caching strategies', () => {
      const cachingTemplate = createRedisTemplate({
        name: 'caching-redis',
        features: {
          caching_strategy: {
            patterns: {
              cache_aside: true,
              write_through: true,
              write_behind: false,
              refresh_ahead: true
            },
            ttl_strategy: {
              default_ttl_seconds: 7200,
              max_ttl_seconds: 86400,
              sliding_expiration: true,
              ttl_jitter_percent: 15
            },
            warming: {
              enabled: true,
              datasets: ['users', 'products', 'sessions'],
              schedule: '0 6 * * *',
              batch_size: 1000
            },
            compression: {
              enabled: true,
              algorithm: 'lz4',
              min_size_bytes: 512
            }
          }
        }
      });

      const config = cachingTemplate.getTemplate();
      expect(config.features.caching_strategy.patterns.cache_aside).toBe(true);
      expect(config.features.caching_strategy.patterns.write_through).toBe(true);
      expect(config.features.caching_strategy.ttl_strategy.default_ttl_seconds).toBe(7200);
      expect(config.features.caching_strategy.warming.enabled).toBe(true);
      expect(config.features.caching_strategy.compression.enabled).toBe(true);
    });

    it('should configure eviction policies', () => {
      const evictionTemplate = createRedisTemplate({
        name: 'eviction-redis',
        features: {
          eviction: {
            policy: 'allkeys-lfu',
            maxmemory_policy: 'allkeys-lfu',
            maxmemory_samples: 10
          }
        }
      });

      const config = evictionTemplate.generateRedisConfig();
      expect(config).toContain('maxmemory-policy allkeys-lfu');
      expect(config).toContain('maxmemory-samples 10');
    });

    it('should configure performance optimization settings', () => {
      const performanceTemplate = createRedisTemplate({
        name: 'performance-redis',
        performance: {
          io_threads: 4,
          io_threads_do_reads: true,
          lazyfree_lazy_eviction: true,
          lazyfree_lazy_expire: true,
          lazyfree_lazy_server_del: true,
          replica_lazy_flush: true,
          hash_max_ziplist_entries: 512,
          hash_max_ziplist_value: 64,
          list_max_ziplist_size: -2,
          set_max_intset_entries: 512,
          zset_max_ziplist_entries: 128,
          zset_max_ziplist_value: 64
        }
      });

      const config = performanceTemplate.generateRedisConfig();
      expect(config).toContain('io-threads 4');
      expect(config).toContain('io-threads-do-reads yes');
      expect(config).toContain('lazyfree-lazy-eviction yes');
    });
  });

  describe('Backup and Recovery', () => {
    it('should generate backup scripts', () => {
      const backupTemplate = createRedisTemplate({
        name: 'backup-redis',
        backup: {
          enabled: true,
          schedule: '0 2 * * *',
          retention_days: 30,
          s3_bucket: 'my-backup-bucket',
          encryption_enabled: true,
          compression: true,
          point_in_time_recovery: true
        }
      });

      const scripts = backupTemplate.generateBackupScripts();
      
      expect(scripts['backup.sh']).toContain('#!/bin/bash');
      expect(scripts['backup.sh']).toContain('redis-cli');
      expect(scripts['backup.sh']).toContain('--rdb');
      expect(scripts['backup.sh']).toContain('gzip');
      expect(scripts['backup.sh']).toContain('openssl enc');
      expect(scripts['backup.sh']).toContain('aws s3 cp');
      
      expect(scripts['restore.sh']).toContain('#!/bin/bash');
      expect(scripts['restore.sh']).toContain('FLUSHALL');
    });

    it('should not generate backup scripts when disabled', () => {
      const noBackupTemplate = createRedisTemplate({
        name: 'no-backup-redis',
        backup: {
          enabled: false,
          schedule: '',
          retention_days: 0,
          encryption_enabled: false,
          compression: false,
          point_in_time_recovery: false
        }
      });

      const scripts = noBackupTemplate.generateBackupScripts();
      expect(Object.keys(scripts)).toHaveLength(0);
    });
  });

  describe('Template Export and Import', () => {
    it('should export template configuration to JSON', () => {
      template.addTenant('export-tenant');
      
      const exportedConfig = template.exportConfig();
      const parsed = JSON.parse(exportedConfig);
      
      expect(parsed.template).toBeDefined();
      expect(parsed.tenants).toBeDefined();
      expect(parsed.deployment_history).toBeDefined();
      expect(parsed.exported_at).toBeDefined();
      expect(parsed.tenants).toHaveLength(1);
    });

    it('should import template configuration from JSON', () => {
      const originalTenants = template.getTenants().length;
      
      const configToImport = {
        template: {
          ...template.getTemplate(),
          name: 'imported-redis'
        },
        tenants: [
          ['imported-tenant', {
            tenant_id: 'imported-tenant',
            key_prefix: 'tenant:imported-tenant:',
            created_at: new Date(),
            resource_limits: {
              max_memory_mb: 100,
              max_connections: 10,
              max_ops_per_second: 1000,
              max_keys: 50000
            },
            access_config: {
              allowed_commands: ['GET', 'SET'],
              forbidden_commands: ['FLUSHALL'],
              key_patterns: ['tenant:imported-tenant:*'],
              read_only: false
            },
            caching_config: {
              default_ttl: 3600,
              max_ttl: 7200,
              eviction_policy: 'allkeys-lru'
            },
            status: 'active'
          }]
        ],
        deployment_history: []
      };
      
      template.importConfig(JSON.stringify(configToImport));
      
      expect(template.getTemplate().name).toBe('imported-redis');
      expect(template.getTenants()).toHaveLength(1);
      expect(template.getTenant('imported-tenant')).toBeDefined();
    });
  });

  describe('Deployment Summary', () => {
    it('should generate comprehensive deployment summary', () => {
      template.addTenant('summary-tenant-1');
      template.addTenant('summary-tenant-2');
      
      const summary = template.getDeploymentSummary();
      
      expect(summary.template_name).toBe('test-redis');
      expect(summary.version).toBe('7.2');
      expect(summary.mode).toBe('standalone');
      expect(summary.tenants_count).toBe(2);
      expect(summary.features).toBeDefined();
      expect(summary.security).toBeDefined();
      expect(summary.caching_strategy).toBeDefined();
      expect(summary.estimated_cost_per_month).toBeGreaterThan(0);
      expect(summary.configuration_files_generated).toBe(true);
      expect(summary.kubernetes_ready).toBe(true);
      expect(summary.docker_ready).toBe(true);
    });

    it('should calculate estimated costs correctly', () => {
      const smallTemplate = createRedisTemplate({
        name: 'small-redis',
        instance_type: 'cache.t3.micro',
        memory_mb: 256
      });

      const largeTemplate = createRedisTemplate({
        name: 'large-redis',
        instance_type: 'cache.m6i.xlarge',
        memory_mb: 8192,
        features: {
          clustering: {
            enabled: true,
            shards: 3,
            replicas_per_shard: 2
          },
          monitoring: {
            enabled: true,
            metrics: ['memory', 'cpu'],
            collection_interval: 60,
            alert_rules: []
          }
        },
        backup: {
          enabled: true,
          schedule: '0 2 * * *',
          retention_days: 30,
          encryption_enabled: false,
          compression: false,
          point_in_time_recovery: false
        }
      });

      const smallCost = smallTemplate.getDeploymentSummary().estimated_cost_per_month;
      const largeCost = largeTemplate.getDeploymentSummary().estimated_cost_per_month;
      
      expect(largeCost).toBeGreaterThan(smallCost);
    });
  });

  describe('Environment Presets', () => {
    it('should apply development environment preset correctly', () => {
      const devTemplate = createEnvironmentRedisTemplate('development', 'dev-redis');
      const config = devTemplate.getTemplate();
      
      expect(config.instance_type).toBe('cache.t3.micro');
      expect(config.memory_mb).toBe(256);
      expect(config.features.persistence.enabled).toBe(false);
      expect(config.features.monitoring.enabled).toBe(false);
      expect(config.security.password_enabled).toBe(false);
      expect(config.security.protected_mode).toBe(false);
      expect(config.backup.enabled).toBe(false);
    });

    it('should apply staging environment preset correctly', () => {
      const stagingTemplate = createEnvironmentRedisTemplate('staging', 'staging-redis');
      const config = stagingTemplate.getTemplate();
      
      expect(config.instance_type).toBe('cache.t3.small');
      expect(config.memory_mb).toBe(1024);
      expect(config.features.persistence.enabled).toBe(true);
      expect(config.features.monitoring.enabled).toBe(true);
      expect(config.security.password_enabled).toBe(true);
      expect(config.backup.enabled).toBe(true);
    });

    it('should apply production environment preset correctly', () => {
      const prodTemplate = createEnvironmentRedisTemplate('production', 'prod-redis');
      const config = prodTemplate.getTemplate();
      
      expect(config.instance_type).toBe('cache.m6i.large');
      expect(config.memory_mb).toBe(4096);
      expect(config.features.persistence.enabled).toBe(true);
      expect(config.features.persistence.mode).toBe('mixed');
      expect(config.features.clustering.enabled).toBe(true);
      expect(config.features.monitoring.enabled).toBe(true);
      expect(config.security.password_enabled).toBe(true);
      expect(config.security.tls_enabled).toBe(true);
      expect(config.backup.enabled).toBe(true);
      expect(config.backup.encryption_enabled).toBe(true);
    });
  });

  describe('Integration with Redis Service', () => {
    it('should integrate with Redis deployment service', async () => {
      // Mock deployment would be tested here in integration tests
      expect(redisService).toBeDefined();
      expect(tenantManager).toBeDefined();
      
      // Verify service methods exist
      expect(typeof redisService.deployTemplate).toBe('function');
      expect(typeof redisService.getDeployments).toBe('function');
      expect(typeof redisService.createTenant).toBe('function');
      expect(typeof redisService.destroyInstance).toBe('function');
      
      expect(typeof tenantManager.createTenant).toBe('function');
      expect(typeof tenantManager.removeTenant).toBe('function');
      expect(typeof tenantManager.getTenantStats).toBe('function');
    });
  });
});

describe('Redis Service Integration Tests', () => {
  let redisService: RedisService;
  let tenantManager: RedisTenantManager;

  beforeEach(() => {
    redisService = new RedisService();
    tenantManager = new RedisTenantManager(redisService);
  });

  describe('Redis Service Operations', () => {
    it('should have all required service methods', () => {
      expect(redisService.deployTemplate).toBeDefined();
      expect(redisService.createTenant).toBeDefined();
      expect(redisService.removeTenant).toBeDefined();
      expect(redisService.getInstanceStatus).toBeDefined();
      expect(redisService.getInstanceMetrics).toBeDefined();
      expect(redisService.executeCommand).toBeDefined();
      expect(redisService.scaleInstance).toBeDefined();
      expect(redisService.createBackup).toBeDefined();
      expect(redisService.destroyInstance).toBeDefined();
    });

    it('should have tenant management capabilities', () => {
      expect(tenantManager.createTenant).toBeDefined();
      expect(tenantManager.removeTenant).toBeDefined();
      expect(tenantManager.getTenantStats).toBeDefined();
      expect(tenantManager.updateTenantLimits).toBeDefined();
      expect(tenantManager.executeTenantCommand).toBeDefined();
    });
  });

  describe('Template Validation Performance', () => {
    it('should validate templates efficiently', () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 100; i++) {
        const template = createRedisTemplate({
          name: `perf-test-${i}`,
          memory_mb: 1024 + i * 10
        });
        template.validate();
      }
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Should validate 100 templates in less than 1 second
      expect(totalTime).toBeLessThan(1000);
    });

    it('should generate configurations efficiently', () => {
      const template = createRedisTemplate({
        name: 'perf-config-test',
        mode: 'cluster',
        features: {
          clustering: {
            enabled: true,
            shards: 5,
            replicas_per_shard: 2
          }
        }
      });

      const startTime = Date.now();
      
      // Generate all configuration types
      template.generateRedisConfig();
      template.generateDockerCompose();
      template.generateKubernetesManifests();
      template.generateBackupScripts();
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Should generate all configs in less than 100ms
      expect(totalTime).toBeLessThan(100);
    });
  });
});