/**
 * PostgreSQL Template System Tests
 * P3-T01 Implementation for CodeRunner v2.0
 * 
 * Test Coverage:
 * - Template validation and configuration
 * - AgentSphere deployment integration
 * - Multi-tenant isolation and management
 * - Basic functionality tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  PostgreSQLTemplate,
  validatePostgreSQLTemplate,
  DEFAULT_POSTGRESQL_TEMPLATE,
  ENVIRONMENT_PRESETS
} from '../../src/templates/databases/postgresql.config';
import {
  PostgreSQLDatabaseTemplate,
  createPostgreSQLTemplate,
  createEnvironmentTemplate
} from '../../src/templates/databases/postgresql.template';
import { PostgreSQLService } from '../../src/templates/databases/postgresql.service';

describe('PostgreSQL Template Configuration', () => {
  describe('Template Validation', () => {
    it('should validate a complete valid template', () => {
      const template: PostgreSQLTemplate = {
        ...DEFAULT_POSTGRESQL_TEMPLATE,
        name: 'test-pg',
        version: '16',
        environment: 'development'
      } as PostgreSQLTemplate;

      const result = validatePostgreSQLTemplate(template);
      expect(result.isValid).toBe(true);
      expect(Object.keys(result.errors)).toHaveLength(0);
    });

    it('should reject template with invalid name', () => {
      const template: PostgreSQLTemplate = {
        ...DEFAULT_POSTGRESQL_TEMPLATE,
        name: 'invalid name with spaces!',
        version: '16',
        environment: 'development'
      } as PostgreSQLTemplate;

      const result = validatePostgreSQLTemplate(template);
      expect(result.isValid).toBe(false);
      expect(result.errors.name).toBeDefined();
      expect(result.errors.name[0]).toContain('alphanumeric');
    });

    it('should reject template with invalid storage size', () => {
      const template: PostgreSQLTemplate = {
        ...DEFAULT_POSTGRESQL_TEMPLATE,
        name: 'test-pg',
        version: '16',
        storage_gb: 10, // Below minimum of 20
        environment: 'development'
      } as PostgreSQLTemplate;

      const result = validatePostgreSQLTemplate(template);
      expect(result.isValid).toBe(false);
      expect(result.errors['storage_gb']).toBeDefined();
    });

    it('should reject template with invalid connection pool settings', () => {
      const template: PostgreSQLTemplate = {
        ...DEFAULT_POSTGRESQL_TEMPLATE,
        name: 'test-pg',
        version: '16',
        connection_pool: {
          min: 50,
          max: 20, // Min greater than max
          idle_timeout_ms: 30000,
          connection_timeout_ms: 5000,
          statement_timeout_ms: 60000,
          query_timeout_ms: 30000
        },
        environment: 'development'
      } as PostgreSQLTemplate;

      const result = validatePostgreSQLTemplate(template);
      expect(result.isValid).toBe(false);
    });

    it('should reject template with invalid IP addresses', () => {
      const template: PostgreSQLTemplate = {
        ...DEFAULT_POSTGRESQL_TEMPLATE,
        name: 'test-pg',
        version: '16',
        security: {
          ...DEFAULT_POSTGRESQL_TEMPLATE.security!,
          ip_whitelist: ['256.256.256.256', 'invalid-ip'] // Invalid IPs
        },
        environment: 'development'
      } as PostgreSQLTemplate;

      const result = validatePostgreSQLTemplate(template);
      expect(result.isValid).toBe(false);
      expect(result.errors['security.ip_whitelist']).toBeDefined();
    });
  });

  describe('Environment Presets', () => {
    it('should have proper development preset', () => {
      const preset = ENVIRONMENT_PRESETS.development;
      expect(preset.instance_type).toBe('micro');
      expect(preset.features?.backup?.enabled).toBe(false);
      expect(preset.security?.ssl_enabled).toBe(false);
      expect(preset.scaling?.auto_scaling).toBe(false);
    });

    it('should have proper staging preset', () => {
      const preset = ENVIRONMENT_PRESETS.staging;
      expect(preset.instance_type).toBe('small');
      expect(preset.features?.backup?.enabled).toBe(true);
      expect(preset.security?.ssl_enabled).toBe(true);
      expect(preset.scaling?.auto_scaling).toBe(true);
    });

    it('should have proper production preset', () => {
      const preset = ENVIRONMENT_PRESETS.production;
      expect(preset.instance_type).toBe('large');
      expect(preset.features?.backup?.enabled).toBe(true);
      expect(preset.features?.replication?.enabled).toBe(true);
      expect(preset.security?.ssl_enabled).toBe(true);
      expect(preset.security?.encryption_at_rest).toBe(true);
      expect(preset.scaling?.auto_scaling).toBe(true);
    });
  });
});

describe('PostgreSQL Database Template', () => {
  let template: PostgreSQLDatabaseTemplate;

  beforeEach(() => {
    template = createPostgreSQLTemplate({
      name: 'test-database',
      environment: 'development'
    });
  });

  describe('Template Creation and Management', () => {
    it('should create template with default configuration', () => {
      const config = template.getTemplate();
      expect(config.name).toBe('test-database');
      expect(config.environment).toBe('development');
      expect(config.version).toBe('16');
      expect(config.tenant_isolation).toBe('schema');
    });

    it('should update template configuration', () => {
      template.updateTemplate({
        storage_gb: 200,
        instance_type: 'medium'
      });

      const config = template.getTemplate();
      expect(config.storage_gb).toBe(200);
      expect(config.instance_type).toBe('medium');
      expect(config.updated_at).toBeDefined();
    });

    it('should validate template configuration', () => {
      const result = template.validate();
      expect(result.isValid).toBe(true);
    });
  });

  describe('Environment-Specific Templates', () => {
    it('should create development template with appropriate settings', () => {
      const devTemplate = createEnvironmentTemplate('development', 'dev-db');
      const config = devTemplate.getTemplate();
      
      expect(config.instance_type).toBe('micro');
      expect(config.features.backup.enabled).toBe(false);
      expect(config.security.ssl_enabled).toBe(false);
    });

    it('should create production template with secure settings', () => {
      const prodTemplate = createEnvironmentTemplate('production', 'prod-db');
      const config = prodTemplate.getTemplate();
      
      expect(config.instance_type).toBe('large');
      expect(config.features.backup.enabled).toBe(true);
      expect(config.features.replication.enabled).toBe(true);
      expect(config.security.ssl_enabled).toBe(true);
      expect(config.security.encryption_at_rest).toBe(true);
    });
  });

  describe('Configuration Generation', () => {
    it('should generate valid PostgreSQL configuration', () => {
      const config = template.generatePostgreSQLConfig();
      
      expect(config).toContain('max_connections = 100');
      expect(config).toContain('shared_buffers = 256MB');
      expect(config).toContain('ssl = off'); // Development mode
      expect(config).toContain('shared_preload_libraries');
    });

    it('should generate Docker Compose configuration', () => {
      const dockerCompose = template.generateDockerCompose();
      
      expect(dockerCompose).toContain('version: \'3.8\'');
      expect(dockerCompose).toContain('postgresql-test-database');
      expect(dockerCompose).toContain('postgres:16-alpine');
      expect(dockerCompose).toContain('5432:5432');
    });

    it('should generate initialization scripts', () => {
      const scripts = template.generateInitScripts();
      
      expect(scripts['01-init-database.sql']).toContain('tenant_management');
      expect(scripts['01-init-database.sql']).toContain('CREATE EXTENSION IF NOT EXISTS');
      expect(scripts['01-init-database.sql']).toContain('create_tenant_schema');
    });

    it('should generate Kubernetes manifests', () => {
      const manifests = template.generateKubernetesManifests();
      
      expect(manifests['postgresql-config.yaml']).toContain('ConfigMap');
      expect(manifests['postgresql-secret.yaml']).toContain('Secret');
      expect(manifests['postgresql-statefulset.yaml']).toContain('StatefulSet');
      expect(manifests['postgresql-service.yaml']).toContain('Service');
    });

    it('should generate backup scripts when backup is enabled', () => {
      template.updateTemplate({
        features: {
          ...template.getTemplate().features,
          backup: {
            enabled: true,
            schedule: '0 2 * * *',
            retention_days: 7,
            encryption_enabled: true,
            compression: 'gzip',
            backup_type: 'full'
          }
        }
      });

      const scripts = template.generateBackupScripts();
      
      expect(scripts['backup.sh']).toContain('#!/bin/bash');
      expect(scripts['backup.sh']).toContain('pg_dump');
      expect(scripts['backup.sh']).toContain('gzip');
      expect(scripts['restore.sh']).toContain('#!/bin/bash');
      expect(scripts['restore.sh']).toContain('psql');
    });
  });

  describe('Multi-Tenant Management', () => {
    it('should add tenant with schema isolation', () => {
      const tenant = template.addTenant('tenant1', {
        resource_limits: {
          max_connections: 20,
          storage_quota_mb: 2000,
          cpu_quota_percent: 15
        }
      });

      expect(tenant.tenant_id).toBe('tenant1');
      expect(tenant.schema_name).toBe('tenant_tenant1');
      expect(tenant.status).toBe('active');
      expect(tenant.resource_limits.max_connections).toBe(20);
    });

    it('should remove tenant', () => {
      template.addTenant('tenant1');
      const removed = template.removeTenant('tenant1');
      
      expect(removed).toBe(true);
      expect(template.getTenant('tenant1')).toBeUndefined();
    });

    it('should list all tenants', () => {
      template.addTenant('tenant1');
      template.addTenant('tenant2');
      
      const tenants = template.getTenants();
      expect(tenants).toHaveLength(2);
      expect(tenants.map(t => t.tenant_id)).toContain('tenant1');
      expect(tenants.map(t => t.tenant_id)).toContain('tenant2');
    });

    it('should handle database-level isolation', () => {
      template.updateTemplate({
        tenant_isolation: 'database'
      });

      const tenant = template.addTenant('tenant1');
      expect(tenant.database_name).toBe('test-database_tenant1');
    });
  });

  describe('Template Export/Import', () => {
    it('should export template configuration to JSON', () => {
      template.addTenant('tenant1');
      
      const exported = template.exportConfig();
      const config = JSON.parse(exported);
      
      expect(config.template.name).toBe('test-database');
      expect(config.tenants).toHaveLength(1);
      expect(config.exported_at).toBeDefined();
    });

    it('should import template configuration from JSON', () => {
      const originalConfig = template.getTemplate();
      const exportedConfig = template.exportConfig();
      
      // Create new template and import
      const newTemplate = createPostgreSQLTemplate();
      newTemplate.importConfig(exportedConfig);
      
      const importedConfig = newTemplate.getTemplate();
      expect(importedConfig.name).toBe(originalConfig.name);
      expect(importedConfig.environment).toBe(originalConfig.environment);
    });
  });

  describe('Cost Estimation', () => {
    it('should estimate monthly cost for basic configuration', () => {
      const summary = template.getDeploymentSummary();
      expect(summary.estimated_cost_per_month).toBeGreaterThan(0);
      expect(typeof summary.estimated_cost_per_month).toBe('number');
    });

    it('should include replication costs when enabled', () => {
      const basicCost = template.getDeploymentSummary().estimated_cost_per_month;
      
      template.updateTemplate({
        features: {
          ...template.getTemplate().features,
          replication: {
            enabled: true,
            replicas: 2,
            read_write_split: true,
            sync_mode: 'asynchronous',
            replication_slots: [],
            standby_timeout: 5000
          }
        }
      });
      
      const replicationCost = template.getDeploymentSummary().estimated_cost_per_month;
      expect(replicationCost).toBeGreaterThan(basicCost);
    });
  });
});

describe('PostgreSQL Service', () => {
  let service: PostgreSQLService;
  let template: PostgreSQLDatabaseTemplate;

  beforeEach(() => {
    service = new PostgreSQLService();
    template = createPostgreSQLTemplate({
      name: 'test-service-db',
      environment: 'development'
    });
  });

  describe('Template Deployment', () => {
    it('should deploy template successfully', async () => {
      const result = await service.deployTemplate(template);
      
      expect(result.status).toBe('success');
      expect(result.instance_id).toBeDefined();
      expect(result.connection_string).toBeDefined();
      expect(result.deployment_time).toBeGreaterThan(0);
      expect(result.resource_usage).toBeDefined();
    });

    it('should fail deployment with invalid template', async () => {
      // Create invalid template
      const invalidTemplate = createPostgreSQLTemplate({
        name: 'invalid template name!',
        storage_gb: 10 // Below minimum
      });

      const result = await service.deployTemplate(invalidTemplate);
      
      expect(result.status).toBe('failed');
      expect(result.error_message).toBeDefined();
    });

    it('should store deployment result', async () => {
      const result = await service.deployTemplate(template);
      const storedResult = service.getDeployment(result.instance_id);
      
      expect(storedResult).toEqual(result);
    });

    it('should list all deployments', async () => {
      const result1 = await service.deployTemplate(template);
      const template2 = createPostgreSQLTemplate({
        name: 'test-service-db-2',
        environment: 'development'
      });
      const result2 = await service.deployTemplate(template2);
      
      const deployments = service.getDeployments();
      expect(deployments).toHaveLength(2);
      expect(deployments.map(d => d.instance_id)).toContain(result1.instance_id);
      expect(deployments.map(d => d.instance_id)).toContain(result2.instance_id);
    });
  });

  describe('Instance Management', () => {
    let instanceId: string;

    beforeEach(async () => {
      const result = await service.deployTemplate(template);
      instanceId = result.instance_id;
    });

    it('should get instance status', async () => {
      const status = await service.getInstanceStatus(instanceId);
      
      expect(status.instanceId).toBe(instanceId);
      expect(status.status).toBeDefined();
      expect(status.endpoint).toBeDefined();
      expect(status.metrics).toBeDefined();
    });

    it('should get instance metrics', async () => {
      const metrics = await service.getInstanceMetrics(instanceId);
      
      expect(metrics.instanceId).toBe(instanceId);
      expect(metrics.metrics.cpu).toBeDefined();
      expect(metrics.metrics.memory).toBeDefined();
      expect(metrics.metrics.storage).toBeDefined();
      expect(metrics.metrics.connections).toBeDefined();
    });

    it('should scale instance', async () => {
      await expect(service.scaleInstance(instanceId, {
        instanceClass: 'db.t3.medium',
        storageGb: 200
      })).resolves.not.toThrow();
    });

    it('should create backup', async () => {
      // Enable backup in template
      template.updateTemplate({
        features: {
          ...template.getTemplate().features,
          backup: {
            enabled: true,
            schedule: '0 2 * * *',
            retention_days: 30,
            encryption_enabled: true,
            compression: 'gzip',
            backup_type: 'full'
          }
        }
      });

      const backup = await service.createBackup(instanceId);
      
      expect(backup.backupId).toBeDefined();
      expect(backup.status).toBe('creating');
      expect(backup.createdAt).toBeDefined();
    });

    it('should restore from backup', async () => {
      const backup = await service.createBackup(instanceId);
      
      await expect(service.restoreBackup(instanceId, backup.backupId))
        .resolves.not.toThrow();
    });

    it('should destroy instance', async () => {
      await expect(service.destroyInstance(instanceId)).resolves.not.toThrow();
      
      const deployment = service.getDeployment(instanceId);
      expect(deployment).toBeUndefined();
    });
  });

  describe('Multi-Tenant Operations', () => {
    it('should track deployment status', async () => {
      const deployments = service.getDeployments();
      expect(Array.isArray(deployments)).toBe(true);
    });

    it('should handle deployment lifecycle', async () => {
      const result = await service.deployTemplate(template);
      expect(result.status).toBe('success');
      expect(result.instance_id).toBeDefined();
      
      // Test retrieval
      const stored = service.getDeployment(result.instance_id);
      expect(stored).toBeDefined();
      
      // Test cleanup
      await service.destroyInstance(result.instance_id);
      const afterDestroy = service.getDeployment(result.instance_id);
      expect(afterDestroy).toBeUndefined();
    });
  });
});

describe('Basic Functionality Tests', () => {
  it('should create and manage basic template operations', () => {
    const template = createPostgreSQLTemplate({
      name: 'basic-test',
      environment: 'development'
    });
    
    expect(template).toBeDefined();
    expect(template.getTemplate().name).toBe('basic-test');
    expect(template.validate().isValid).toBe(true);
  });
});

describe('Service Integration', () => {
  let service: PostgreSQLService;

  beforeEach(() => {
    service = new PostgreSQLService();
  });

  it('should deploy template successfully', async () => {
    const template = createPostgreSQLTemplate({
      name: 'integration-test',
      environment: 'development'
    });

    const result = await service.deployTemplate(template);
    expect(result.status).toBe('success');
    expect(result.instance_id).toBeDefined();
    expect(result.connection_string).toBeDefined();

    // Clean up
    await service.destroyInstance(result.instance_id);
  });

  it('should handle invalid template gracefully', async () => {
    const invalidTemplate = createPostgreSQLTemplate({
      name: 'invalid template!', // Invalid name
      environment: 'development'
    });

    const result = await service.deployTemplate(invalidTemplate);
    expect(result.status).toBe('failed');
    expect(result.error_message).toBeDefined();
  });
});

describe('Security Configuration', () => {
  it('should enforce SSL in production environment', () => {
    const prodTemplate = createEnvironmentTemplate('production', 'secure-db');
    const config = prodTemplate.getTemplate();
    
    expect(config.security.ssl_enabled).toBe(true);
    expect(config.security.encryption_at_rest).toBe(true);
  });

  it('should enable backup encryption for production', () => {
    const prodTemplate = createEnvironmentTemplate('production', 'backup-security-db');
    const config = prodTemplate.getTemplate();
    
    expect(config.features.backup.encryption_enabled).toBe(true);
  });
});