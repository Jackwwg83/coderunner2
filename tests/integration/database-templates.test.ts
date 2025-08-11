/**
 * Database Templates Test Suite
 * Focused testing for PostgreSQL and Redis template systems
 * 
 * Tests:
 * - Template configuration validation
 * - File generation accuracy
 * - Multi-tenant functionality
 * - Environment-specific configurations
 * - Security and performance settings
 */

import { PostgreSQLDatabaseTemplate } from '../../src/templates/databases/postgresql.template';
import { RedisCacheTemplate } from '../../src/templates/databases/redis.template';
import { validatePostgreSQLTemplate } from '../../src/templates/databases/postgresql.config';
import { validateRedisTemplate } from '../../src/templates/databases/redis.config';

describe('Database Templates Test Suite', () => {
  describe('PostgreSQL Template System', () => {
    describe('Template Validation', () => {
      test('should validate required fields', () => {
        const template = new PostgreSQLDatabaseTemplate({
          name: '',
          storage_gb: -10,
          max_tenants: 0
        });

        const validation = template.validate();
        expect(validation.isValid).toBe(false);
        expect(validation.errors.name).toContain('Name is required');
        expect(validation.errors.storage_gb).toContain('must be positive');
      });

      test('should validate performance configuration', () => {
        const template = new PostgreSQLDatabaseTemplate({
          name: 'test-postgres',
          performance: {
            max_connections: 0,
            shared_buffers: 'invalid-size',
            work_mem: '0MB'
          }
        });

        const validation = template.validate();
        expect(validation.isValid).toBe(false);
      });

      test('should pass validation with correct configuration', () => {
        const template = new PostgreSQLDatabaseTemplate({
          name: 'valid-postgres',
          version: '16',
          instance_type: 'medium',
          storage_gb: 100,
          max_tenants: 50,
          performance: {
            max_connections: 200,
            shared_buffers: '256MB',
            work_mem: '4MB'
          }
        });

        const validation = template.validate();
        expect(validation.isValid).toBe(true);
        expect(Object.keys(validation.errors)).toHaveLength(0);
      });
    });

    describe('Configuration File Generation', () => {
      test('should generate complete postgresql.conf', () => {
        const template = new PostgreSQLDatabaseTemplate({
          name: 'config-test',
          performance: {
            max_connections: 300,
            shared_buffers: '512MB',
            effective_cache_size: '2GB',
            work_mem: '8MB',
            maintenance_work_mem: '128MB',
            wal_buffers: '16MB',
            checkpoint_completion_target: 0.9,
            random_page_cost: 1.1
          },
          security: {
            ssl_enabled: true,
            password_encryption: 'scram-sha-256',
            row_level_security: true
          },
          features: {
            monitoring: {
              enabled: true,
              slow_query_threshold: 1000
            },
            replication: {
              enabled: true,
              replicas: 2,
              sync_mode: 'asynchronous'
            }
          }
        });

        const config = template.generatePostgreSQLConfig();

        // Test basic settings
        expect(config).toContain('max_connections = 300');
        expect(config).toContain('shared_buffers = 512MB');
        expect(config).toContain('effective_cache_size = 2GB');
        expect(config).toContain('work_mem = 8MB');

        // Test security settings
        expect(config).toContain('ssl = on');
        expect(config).toContain('password_encryption = scram-sha-256');
        expect(config).toContain('row_security = on');

        // Test monitoring
        expect(config).toContain('log_min_duration_statement = 1000');

        // Test replication
        expect(config).toContain('wal_level = replica');
        expect(config).toContain('max_wal_senders = 4'); // replicas + 2
      });

      test('should generate minimal configuration for development', () => {
        const template = new PostgreSQLDatabaseTemplate({
          name: 'dev-postgres',
          environment: 'development'
        });

        const config = template.generatePostgreSQLConfig();

        expect(config).toContain('# Environment: development');
        expect(config).toContain('loglevel verbose'); // Development should be verbose
        expect(config).not.toContain('ssl = on'); // SSL disabled in dev by default
      });

      test('should generate production-optimized configuration', () => {
        const template = new PostgreSQLDatabaseTemplate({
          name: 'prod-postgres',
          environment: 'production',
          instance_type: 'xlarge',
          performance: {
            max_connections: 500,
            shared_buffers: '2GB',
            effective_cache_size: '8GB'
          },
          security: {
            ssl_enabled: true,
            encryption_at_rest: true
          }
        });

        const config = template.generatePostgreSQLConfig();

        expect(config).toContain('# Environment: production');
        expect(config).toContain('max_connections = 500');
        expect(config).toContain('ssl = on');
        expect(config).toContain('loglevel notice'); // Production should be less verbose
      });
    });

    describe('Docker Compose Generation', () => {
      test('should generate standalone Docker Compose', () => {
        const template = new PostgreSQLDatabaseTemplate({
          name: 'docker-postgres',
          version: '16'
        });

        const compose = template.generateDockerCompose();

        expect(compose).toContain('version: \'3.8\'');
        expect(compose).toContain('postgresql-docker-postgres:');
        expect(compose).toContain('postgres:16-alpine');
        expect(compose).toContain('POSTGRES_DB: docker-postgres');
        expect(compose).toContain('healthcheck:');
        expect(compose).toContain('pg_isready');
      });

      test('should include monitoring services when enabled', () => {
        const template = new PostgreSQLDatabaseTemplate({
          name: 'monitored-postgres',
          features: {
            monitoring: { enabled: true }
          }
        });

        const compose = template.generateDockerCompose();

        expect(compose).toContain('postgresql-exporter:');
        expect(compose).toContain('prometheuscommunity/postgres-exporter');
        expect(compose).toContain('9187:9187');
      });

      test('should include backup service when enabled', () => {
        const template = new PostgreSQLDatabaseTemplate({
          name: 'backup-postgres',
          features: {
            backup: {
              enabled: true,
              schedule: '0 2 * * *',
              retention_days: 7
            }
          }
        });

        const compose = template.generateDockerCompose();

        expect(compose).toContain('postgresql-backup:');
        expect(compose).toContain('prodrigestivill/postgres-backup-local');
        expect(compose).toContain('SCHEDULE: "0 2 * * *"');
        expect(compose).toContain('BACKUP_KEEP_DAYS: 7');
      });
    });

    describe('Kubernetes Manifests', () => {
      test('should generate complete Kubernetes deployment', () => {
        const template = new PostgreSQLDatabaseTemplate({
          name: 'k8s-postgres',
          version: '16',
          storage_gb: 100,
          scaling: {
            auto_scaling: true,
            max_capacity: 5
          }
        });

        const manifests = template.generateKubernetesManifests();

        // ConfigMap
        expect(manifests['postgresql-config.yaml']).toContain('kind: ConfigMap');
        expect(manifests['postgresql-config.yaml']).toContain('name: postgresql-config-k8s-postgres');

        // Secret
        expect(manifests['postgresql-secret.yaml']).toContain('kind: Secret');
        expect(manifests['postgresql-secret.yaml']).toContain('postgres-password:');

        // StatefulSet
        expect(manifests['postgresql-statefulset.yaml']).toContain('kind: StatefulSet');
        expect(manifests['postgresql-statefulset.yaml']).toContain('postgres:16-alpine');
        expect(manifests['postgresql-statefulset.yaml']).toContain('storage: 100Gi');

        // Service
        expect(manifests['postgresql-service.yaml']).toContain('kind: Service');
        expect(manifests['postgresql-service.yaml']).toContain('port: 5432');

        // HPA (when auto-scaling is enabled)
        expect(manifests['postgresql-hpa.yaml']).toContain('kind: HorizontalPodAutoscaler');
        expect(manifests['postgresql-hpa.yaml']).toContain('maxReplicas: 5');
      });
    });

    describe('Initialization Scripts', () => {
      test('should generate database initialization script', () => {
        const template = new PostgreSQLDatabaseTemplate({
          name: 'init-postgres',
          tenant_isolation: 'schema',
          extensions: ['pg_stat_statements', 'pgcrypto']
        });

        const scripts = template.generateInitScripts();
        const initScript = scripts['01-init-database.sql'];

        expect(initScript).toContain('CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"');
        expect(initScript).toContain('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
        expect(initScript).toContain('CREATE SCHEMA IF NOT EXISTS tenant_management');
        expect(initScript).toContain('CREATE TABLE IF NOT EXISTS tenant_management.tenants');
        expect(initScript).toContain('create_tenant_schema');
      });

      test('should generate row-level security functions', () => {
        const template = new PostgreSQLDatabaseTemplate({
          name: 'rls-postgres',
          security: {
            row_level_security: true
          }
        });

        const scripts = template.generateInitScripts();
        const initScript = scripts['01-init-database.sql'];

        expect(initScript).toContain('current_tenant_id()');
        expect(initScript).toContain('create_tenant_policy');
        expect(initScript).toContain('ENABLE ROW LEVEL SECURITY');
      });

      test('should generate monitoring setup when enabled', () => {
        const template = new PostgreSQLDatabaseTemplate({
          name: 'monitoring-postgres',
          features: {
            monitoring: {
              enabled: true,
              slow_query_threshold: 500
            }
          }
        });

        const scripts = template.generateInitScripts();
        const monitoringScript = scripts['02-monitoring-setup.sql'];

        expect(monitoringScript).toContain('CREATE EXTENSION IF NOT EXISTS pg_stat_statements');
        expect(monitoringScript).toContain('CREATE SCHEMA IF NOT EXISTS monitoring');
        expect(monitoringScript).toContain('performance_metrics');
        expect(monitoringScript).toContain('slow_queries');
        expect(monitoringScript).toContain('mean_time > 500');
      });
    });

    describe('Backup Scripts Generation', () => {
      test('should generate comprehensive backup script', () => {
        const template = new PostgreSQLDatabaseTemplate({
          name: 'backup-postgres',
          features: {
            backup: {
              enabled: true,
              backup_type: 'full',
              compression: 'gzip',
              encryption_enabled: true,
              retention_days: 30,
              s3_bucket: 'my-backup-bucket'
            }
          }
        });

        const scripts = template.generateBackupScripts();
        const backupScript = scripts['backup.sh'];

        expect(backupScript).toContain('pg_dump');
        expect(backupScript).toContain('gzip');
        expect(backupScript).toContain('openssl enc -aes-256-cbc');
        expect(backupScript).toContain('RETENTION_DAYS=30');
        expect(backupScript).toContain('aws s3 cp');
        expect(backupScript).toContain('s3://my-backup-bucket');

        const restoreScript = scripts['restore.sh'];
        expect(restoreScript).toContain('psql');
        expect(restoreScript).toContain('gunzip');
        expect(restoreScript).toContain('openssl enc -d');
      });

      test('should generate incremental backup script', () => {
        const template = new PostgreSQLDatabaseTemplate({
          name: 'incremental-postgres',
          features: {
            backup: {
              enabled: true,
              backup_type: 'incremental',
              compression: 'lz4'
            }
          }
        });

        const scripts = template.generateBackupScripts();
        const backupScript = scripts['backup.sh'];

        expect(backupScript).toContain('pg_basebackup');
        expect(backupScript).toContain('lz4');
        expect(backupScript).toContain('BACKUP_TYPE="incremental"');
      });
    });

    describe('Multi-Tenant Management', () => {
      test('should manage schema-based isolation', () => {
        const template = new PostgreSQLDatabaseTemplate({
          name: 'schema-tenant-postgres',
          tenant_isolation: 'schema',
          schema_prefix: 'tenant',
          max_tenants: 100
        });

        // Add tenants
        const tenant1 = template.addTenant('company-a', {
          resource_limits: {
            max_connections: 50,
            storage_quota_mb: 5000,
            cpu_quota_percent: 20
          }
        });

        const tenant2 = template.addTenant('company-b');

        expect(tenant1.tenant_id).toBe('company-a');
        expect(tenant1.schema_name).toBe('tenant_company-a');
        expect(tenant1.resource_limits.max_connections).toBe(50);

        expect(tenant2.tenant_id).toBe('company-b');
        expect(tenant2.schema_name).toBe('tenant_company-b');

        // Get tenants
        const tenants = template.getTenants();
        expect(tenants).toHaveLength(2);

        // Remove tenant
        const removed = template.removeTenant('company-a');
        expect(removed).toBe(true);

        const remainingTenants = template.getTenants();
        expect(remainingTenants).toHaveLength(1);
        expect(remainingTenants[0].tenant_id).toBe('company-b');
      });

      test('should manage database-based isolation', () => {
        const template = new PostgreSQLDatabaseTemplate({
          name: 'db-tenant-postgres',
          tenant_isolation: 'database',
          max_tenants: 50
        });

        const tenant = template.addTenant('isolated-org');

        expect(tenant.tenant_id).toBe('isolated-org');
        expect(tenant.database_name).toBe('db-tenant-postgres_isolated-org');
        expect(tenant.isolation_config.type).toBe('database');
      });

      test('should generate tenant-specific connection info', () => {
        const template = new PostgreSQLDatabaseTemplate({
          name: 'connection-postgres',
          tenant_isolation: 'schema'
        });

        template.addTenant('test-tenant');
        const summary = template.getDeploymentSummary();

        expect(summary.tenants_count).toBe(1);
        expect(summary.max_tenants).toBeGreaterThan(0);
        expect(summary.tenant_isolation).toBe('schema');
      });
    });

    describe('Cost Estimation', () => {
      test('should estimate costs for different instance types', () => {
        const microTemplate = new PostgreSQLDatabaseTemplate({
          name: 'micro-postgres',
          instance_type: 'micro',
          storage_gb: 20
        });

        const xlargeTemplate = new PostgreSQLDatabaseTemplate({
          name: 'xlarge-postgres',
          instance_type: 'xlarge',
          storage_gb: 1000,
          features: {
            backup: { enabled: true },
            replication: { enabled: true, replicas: 3 }
          }
        });

        const microSummary = microTemplate.getDeploymentSummary();
        const xlargeSummary = xlargeTemplate.getDeploymentSummary();

        expect(microSummary.estimated_cost_per_month).toBeLessThan(xlargeSummary.estimated_cost_per_month);
        expect(xlargeSummary.estimated_cost_per_month).toBeGreaterThan(100); // With replicas, should be significant
      });
    });
  });

  describe('Redis Template System', () => {
    describe('Template Validation', () => {
      test('should validate required fields', () => {
        const template = new RedisCacheTemplate({
          name: '',
          memory_mb: 0,
          tenant_config: {
            max_tenants: -5
          }
        });

        const validation = template.validate();
        expect(validation.isValid).toBe(false);
        expect(validation.errors.name).toContain('Name is required');
        expect(validation.errors.memory_mb).toContain('must be positive');
      });

      test('should validate cluster configuration', () => {
        const template = new RedisCacheTemplate({
          name: 'cluster-redis',
          mode: 'cluster',
          features: {
            clustering: {
              enabled: true,
              shards: 0, // Invalid
              replicas_per_shard: -1 // Invalid
            }
          }
        });

        const validation = template.validate();
        expect(validation.isValid).toBe(false);
      });

      test('should pass validation with correct configuration', () => {
        const template = new RedisCacheTemplate({
          name: 'valid-redis',
          version: '7.2',
          mode: 'standalone',
          memory_mb: 1024,
          features: {
            persistence: {
              enabled: true,
              mode: 'aof'
            }
          }
        });

        const validation = template.validate();
        expect(validation.isValid).toBe(true);
        expect(Object.keys(validation.errors)).toHaveLength(0);
      });
    });

    describe('Configuration File Generation', () => {
      test('should generate complete redis.conf', () => {
        const template = new RedisCacheTemplate({
          name: 'config-redis',
          memory_mb: 2048,
          features: {
            persistence: {
              enabled: true,
              mode: 'mixed',
              aof_fsync: 'everysec'
            },
            eviction: {
              policy: 'allkeys-lru',
              maxmemory_samples: 5
            }
          },
          security: {
            password_enabled: true,
            password: 'secure-password',
            protected_mode: true
          },
          performance: {
            io_threads: 4,
            lazyfree_lazy_eviction: true
          }
        });

        const config = template.generateRedisConfig();

        // Basic settings
        expect(config).toContain('maxmemory 2048mb');
        expect(config).toContain('maxmemory-policy allkeys-lru');

        // Persistence
        expect(config).toContain('appendonly yes');
        expect(config).toContain('appendfsync everysec');
        expect(config).toContain('aof-use-rdb-preamble yes');

        // Security
        expect(config).toContain('protected-mode yes');
        expect(config).toContain('requirepass secure-password');

        // Performance
        expect(config).toContain('io-threads 4');
        expect(config).toContain('lazyfree-lazy-eviction yes');
      });

      test('should generate cluster configuration', () => {
        const template = new RedisCacheTemplate({
          name: 'cluster-redis',
          mode: 'cluster',
          features: {
            clustering: {
              enabled: true,
              cluster_node_timeout: 15000,
              cluster_announce_ip: '10.0.1.100'
            }
          }
        });

        const config = template.generateRedisConfig();

        expect(config).toContain('cluster-enabled yes');
        expect(config).toContain('cluster-config-file nodes-cluster-redis.conf');
        expect(config).toContain('cluster-node-timeout 15000');
        expect(config).toContain('cluster-announce-ip 10.0.1.100');
      });

      test('should generate security configuration with TLS', () => {
        const template = new RedisCacheTemplate({
          name: 'secure-redis',
          security: {
            tls_enabled: true,
            tls_cert_file: '/etc/ssl/redis.crt',
            tls_key_file: '/etc/ssl/redis.key',
            acl_enabled: true,
            rename_dangerous_commands: {
              FLUSHALL: 'FLUSH_ALL_DISABLED',
              CONFIG: 'CONFIG_DISABLED'
            }
          }
        });

        const config = template.generateRedisConfig();

        expect(config).toContain('tls-port 6380');
        expect(config).toContain('port 0'); // Disable non-TLS port
        expect(config).toContain('tls-cert-file /etc/ssl/redis.crt');
        expect(config).toContain('aclfile /etc/redis/users.acl');
        expect(config).toContain('rename-command FLUSHALL FLUSH_ALL_DISABLED');
      });
    });

    describe('Docker Compose Generation', () => {
      test('should generate standalone Docker Compose', () => {
        const template = new RedisCacheTemplate({
          name: 'standalone-redis',
          version: '7.2',
          memory_mb: 512
        });

        const compose = template.generateDockerCompose();

        expect(compose).toContain('version: \'3.8\'');
        expect(compose).toContain('redis-standalone-redis:');
        expect(compose).toContain('redis:7.2-alpine');
        expect(compose).toContain('6379:6379');
        expect(compose).toContain('redis-cli ping');
      });

      test('should generate cluster Docker Compose', () => {
        const template = new RedisCacheTemplate({
          name: 'cluster-redis',
          mode: 'cluster',
          features: {
            clustering: {
              enabled: true,
              shards: 3,
              replicas_per_shard: 1
            },
            monitoring: {
              enabled: true
            }
          }
        });

        const compose = template.generateDockerCompose();

        expect(compose).toContain('redis-node-1');
        expect(compose).toContain('redis-node-6'); // 3 * (1 + 1) = 6 nodes
        expect(compose).toContain('redis-cluster-init');
        expect(compose).toContain('--cluster-replicas 1');
        expect(compose).toContain('redis-cluster-exporter');
        expect(compose).toContain('REDIS_EXPORTER_IS_CLUSTER=true');
      });

      test('should include monitoring and backup services', () => {
        const template = new RedisCacheTemplate({
          name: 'monitored-redis',
          features: {
            monitoring: { enabled: true }
          },
          backup: {
            enabled: true,
            schedule: '0 3 * * *'
          }
        });

        const compose = template.generateDockerCompose();

        expect(compose).toContain('redis-exporter:');
        expect(compose).toContain('oliver006/redis_exporter');
        expect(compose).toContain('9121:9121');

        expect(compose).toContain('redis-backup:');
        expect(compose).toContain('BACKUP_SCHEDULE=0 3 * * *');
      });
    });

    describe('Kubernetes Manifests', () => {
      test('should generate standalone Kubernetes deployment', () => {
        const template = new RedisCacheTemplate({
          name: 'k8s-redis',
          version: '7.2',
          memory_mb: 1024
        });

        const manifests = template.generateKubernetesManifests();

        expect(manifests['redis-config.yaml']).toContain('kind: ConfigMap');
        expect(manifests['redis-secret.yaml']).toContain('kind: Secret');
        expect(manifests['redis-deployment.yaml']).toContain('kind: Deployment');
        expect(manifests['redis-deployment.yaml']).toContain('redis:7.2-alpine');
        expect(manifests['redis-service.yaml']).toContain('kind: Service');
      });

      test('should generate cluster StatefulSet', () => {
        const template = new RedisCacheTemplate({
          name: 'k8s-cluster-redis',
          mode: 'cluster',
          features: {
            clustering: {
              enabled: true,
              shards: 3,
              replicas_per_shard: 1
            }
          }
        });

        const manifests = template.generateKubernetesManifests();

        expect(manifests['redis-cluster.yaml']).toContain('kind: StatefulSet');
        expect(manifests['redis-cluster.yaml']).toContain('replicas: 6');
        expect(manifests['redis-cluster.yaml']).toContain('containerPort: 16379'); // Cluster bus port
      });
    });

    describe('ACL Configuration', () => {
      test('should generate ACL users file', () => {
        const template = new RedisCacheTemplate({
          name: 'acl-redis',
          security: {
            acl_enabled: true,
            acl_users: [
              {
                username: 'app_user',
                password: 'app_secret',
                keys: ['app:*', 'cache:*'],
                commands: ['GET', 'SET', 'DEL', 'EXISTS', 'EXPIRE']
              },
              {
                username: 'readonly_user',
                password: 'readonly_secret',
                keys: ['*'],
                commands: ['GET', 'EXISTS', 'KEYS']
              }
            ]
          }
        });

        const aclFile = template.generateACLUsersFile();

        expect(aclFile).toContain('user app_user on >app_secret');
        expect(aclFile).toContain('~app:* ~cache:*');
        expect(aclFile).toContain('+GET +SET +DEL +EXISTS +EXPIRE');

        expect(aclFile).toContain('user readonly_user on >readonly_secret');
        expect(aclFile).toContain('~*');
        expect(aclFile).toContain('+GET +EXISTS +KEYS');
      });
    });

    describe('Backup Scripts Generation', () => {
      test('should generate Redis backup scripts', () => {
        const template = new RedisCacheTemplate({
          name: 'backup-redis',
          backup: {
            enabled: true,
            compression: true,
            encryption_enabled: true,
            retention_days: 14,
            s3_bucket: 'redis-backups'
          }
        });

        const scripts = template.generateBackupScripts();
        const backupScript = scripts['backup.sh'];

        expect(backupScript).toContain('redis-cli --rdb');
        expect(backupScript).toContain('gzip');
        expect(backupScript).toContain('openssl enc -aes-256-cbc');
        expect(backupScript).toContain('RETENTION_DAYS=14');
        expect(backupScript).toContain('s3://redis-backups');

        const restoreScript = scripts['restore.sh'];
        expect(restoreScript).toContain('redis-cli FLUSHALL');
        expect(restoreScript).toContain('gunzip');
        expect(restoreScript).toContain('openssl enc -d');
      });
    });

    describe('Multi-Tenant Management', () => {
      test('should manage key prefix isolation', () => {
        const template = new RedisCacheTemplate({
          name: 'tenant-redis',
          tenant_config: {
            isolation_type: 'key_prefix',
            key_prefix_pattern: '{tenantId}:app:',
            max_tenants: 100
          }
        });

        // Add tenants
        const tenant1 = template.addTenant('client-1', {
          resource_limits: {
            max_memory_mb: 100,
            max_connections: 50,
            max_ops_per_second: 1000
          }
        });

        const tenant2 = template.addTenant('client-2');

        expect(tenant1.tenant_id).toBe('client-1');
        expect(tenant1.key_prefix).toBe('client-1:app:');
        expect(tenant1.resource_limits.max_memory_mb).toBe(100);

        expect(tenant2.tenant_id).toBe('client-2');
        expect(tenant2.key_prefix).toBe('client-2:app:');

        // Generate tenant commands
        const commands = template.generateTenantCommands('client-1');
        expect(commands.length).toBeGreaterThan(0);
      });

      test('should manage database isolation', () => {
        const template = new RedisCacheTemplate({
          name: 'db-tenant-redis',
          tenant_config: {
            isolation_type: 'database',
            max_tenants: 16
          }
        });

        const tenant = template.addTenant('db-tenant');

        expect(tenant.tenant_id).toBe('db-tenant');
        expect(tenant.database_number).toBeDefined();
        expect(tenant.database_number).toBeGreaterThanOrEqual(0);
        expect(tenant.database_number).toBeLessThan(16);
      });
    });

    describe('Performance Optimization', () => {
      test('should configure caching strategies', () => {
        const template = new RedisCacheTemplate({
          name: 'cache-redis',
          features: {
            caching_strategy: {
              patterns: ['write-through', 'read-aside'],
              ttl_strategy: {
                default_ttl_seconds: 1800,
                max_ttl_seconds: 7200,
                ttl_jitter_percent: 10
              },
              compression: {
                enabled: true,
                algorithm: 'lz4',
                threshold_bytes: 1024
              }
            }
          }
        });

        const config = template.getTemplate();
        const summary = template.getDeploymentSummary();

        expect(config.features.caching_strategy.patterns).toContain('write-through');
        expect(config.features.caching_strategy.ttl_strategy.ttl_jitter_percent).toBe(10);
        expect(summary.caching_strategy.patterns).toEqual(['write-through', 'read-aside']);
        expect(summary.caching_strategy.compression_enabled).toBe(true);
      });

      test('should estimate costs for different configurations', () => {
        const smallTemplate = new RedisCacheTemplate({
          name: 'small-redis',
          instance_type: 'cache.t3.micro',
          memory_mb: 256
        });

        const largeTemplate = new RedisCacheTemplate({
          name: 'large-redis',
          instance_type: 'cache.r6g.large',
          memory_mb: 16384,
          features: {
            clustering: { enabled: true, shards: 3, replicas_per_shard: 1 },
            monitoring: { enabled: true }
          },
          backup: { enabled: true }
        });

        const smallSummary = smallTemplate.getDeploymentSummary();
        const largeSummary = largeTemplate.getDeploymentSummary();

        expect(smallSummary.estimated_cost_per_month).toBeLessThan(largeSummary.estimated_cost_per_month);
        expect(largeSummary.estimated_cost_per_month).toBeGreaterThan(smallSummary.estimated_cost_per_month * 5);
      });
    });

    describe('Template Import/Export', () => {
      test('should export and import template configuration', () => {
        const originalTemplate = new RedisCacheTemplate({
          name: 'export-redis',
          version: '7.2',
          memory_mb: 1024,
          features: {
            persistence: { enabled: true, mode: 'aof' }
          }
        });

        // Add some tenants
        originalTemplate.addTenant('tenant-1');
        originalTemplate.addTenant('tenant-2');

        // Export configuration
        const exportedConfig = originalTemplate.exportConfig();
        expect(exportedConfig).toBeTruthy();

        // Import to new template
        const importedTemplate = new RedisCacheTemplate();
        importedTemplate.importConfig(exportedConfig);

        const importedConfig = importedTemplate.getTemplate();
        const importedTenants = importedTemplate.getTenants();

        expect(importedConfig.name).toBe('export-redis');
        expect(importedConfig.memory_mb).toBe(1024);
        expect(importedTenants).toHaveLength(2);
        expect(importedTenants[0].tenant_id).toBe('tenant-1');
      });

      test('should handle invalid import configuration', () => {
        const template = new RedisCacheTemplate();
        
        expect(() => {
          template.importConfig('invalid-json');
        }).toThrow('Failed to import configuration');

        expect(() => {
          template.importConfig('{}');
        }).not.toThrow(); // Empty config should not throw
      });
    });
  });
});