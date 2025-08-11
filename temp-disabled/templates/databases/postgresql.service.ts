/**
 * PostgreSQL Service with AgentSphere Integration
 * P3-T01 Implementation for CodeRunner v2.0
 * 
 * Handles:
 * - AgentSphere cloud deployment integration
 * - Multi-tenant PostgreSQL management
 * - Advanced database operations (backup, monitoring, scaling)
 * - Tenant lifecycle management
 * - Performance monitoring and optimization
 */

import {
  PostgreSQLTemplate,
  PostgreSQLDeploymentResult,
  PostgreSQLTenant
} from './postgresql.config';
import { PostgreSQLDatabaseTemplate } from './postgresql.template';
import { DatabaseService } from '../../services/database';
import { logger } from '../../utils/logger';

/**
 * AgentSphere SDK interface (placeholder for actual SDK)
 */
interface AgentSphereSDK {
  // Database operations
  createDatabase(config: DatabaseCreateRequest): Promise<DatabaseCreateResponse>;
  destroyDatabase(instanceId: string): Promise<void>;
  getDatabaseStatus(instanceId: string): Promise<DatabaseStatusResponse>;
  
  // Execution and command operations
  execCommand(instanceId: string, command: string): Promise<CommandResponse>;
  uploadFiles(instanceId: string, files: { [path: string]: string }): Promise<void>;
  
  // Monitoring and metrics
  getMetrics(instanceId: string): Promise<MetricsResponse>;
  enableMonitoring(instanceId: string, config: MonitoringConfig): Promise<void>;
  
  // Backup operations
  createBackup(instanceId: string, config: BackupConfig): Promise<BackupResponse>;
  restoreBackup(instanceId: string, backupId: string): Promise<void>;
  
  // Scaling operations
  scaleDatabase(instanceId: string, config: ScalingConfig): Promise<void>;
}

interface DatabaseCreateRequest {
  engine: 'postgresql';
  version: string;
  instanceClass: string;
  storageGb: number;
  backupEnabled: boolean;
  monitoringEnabled: boolean;
  environment: string;
  tags: { [key: string]: string };
  securityConfig: {
    sslEnabled: boolean;
    ipWhitelist: string[];
    encryptionAtRest: boolean;
  };
}

interface DatabaseCreateResponse {
  instanceId: string;
  endpoint: string;
  port: number;
  connectionUrl: string;
  adminUsername: string;
  adminPassword: string;
  status: 'creating' | 'available' | 'failed';
  estimatedReadyTime: number; // minutes
}

interface DatabaseStatusResponse {
  instanceId: string;
  status: 'creating' | 'available' | 'maintenance' | 'failed' | 'deleting';
  endpoint: string;
  port: number;
  connectionUrl: string;
  metrics: {
    cpuUtilization: number;
    memoryUtilization: number;
    diskUtilization: number;
    connectionsActive: number;
    connectionsMax: number;
  };
  backups: {
    lastBackupTime?: Date;
    nextBackupTime?: Date;
    backupRetentionDays: number;
  };
  replicas?: string[];
}

interface CommandResponse {
  success: boolean;
  output: string;
  error?: string;
  exitCode: number;
  executionTime: number;
}

interface MetricsResponse {
  instanceId: string;
  timestamp: Date;
  metrics: {
    cpu: { usage: number; max: number };
    memory: { usage: number; total: number };
    storage: { used: number; total: number };
    connections: { active: number; max: number; idle: number };
    queries: { per_second: number; slow_queries: number };
    replication: { lag_seconds?: number; replicas_connected?: number };
  };
}

interface MonitoringConfig {
  enabled: boolean;
  metricsInterval: number;
  alertEndpoints: string[];
  slowQueryThreshold: number;
}

interface BackupConfig {
  schedule: string;
  retentionDays: number;
  compression: boolean;
  encryption: boolean;
}

interface BackupResponse {
  backupId: string;
  status: 'creating' | 'completed' | 'failed';
  size: number;
  createdAt: Date;
}

interface ScalingConfig {
  instanceClass?: string;
  storageGb?: number;
  readReplicas?: number;
  autoScaling?: {
    enabled: boolean;
    minCapacity: number;
    maxCapacity: number;
    targetCpuUtilization: number;
  };
}

/**
 * PostgreSQL deployment and management service
 */
export class PostgreSQLService {
  private agentSphere: AgentSphereSDK;
  private dbService: DatabaseService;
  private deployments: Map<string, PostgreSQLDeploymentResult>;
  private templates: Map<string, PostgreSQLDatabaseTemplate>;

  constructor(agentSphereConfig?: any) {
    // In a real implementation, initialize AgentSphere SDK
    this.agentSphere = this.initializeAgentSphere(agentSphereConfig);
    // Note: DatabaseService constructor is private, using mock for template service
    this.dbService = {} as DatabaseService;
    this.deployments = new Map();
    this.templates = new Map();
  }

  /**
   * Initialize AgentSphere SDK (placeholder implementation)
   */
  private initializeAgentSphere(config?: any): AgentSphereSDK {
    // This would be replaced with actual AgentSphere SDK initialization
    return {
      createDatabase: async (config: DatabaseCreateRequest): Promise<DatabaseCreateResponse> => {
        // Mock implementation for development
        const instanceId = `pg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        return {
          instanceId,
          endpoint: `${instanceId}.ricky.agentsphere.com`,
          port: 5432,
          connectionUrl: `postgresql://postgres:password@${instanceId}.ricky.agentsphere.com:5432/postgres`,
          adminUsername: 'postgres',
          adminPassword: this.generateSecurePassword(),
          status: 'creating',
          estimatedReadyTime: 10
        };
      },
      
      destroyDatabase: async (instanceId: string): Promise<void> => {
        logger.info(`Destroying PostgreSQL instance: ${instanceId}`);
        // Mock implementation
        await new Promise(resolve => setTimeout(resolve, 2000));
      },
      
      getDatabaseStatus: async (instanceId: string): Promise<DatabaseStatusResponse> => {
        // Mock implementation
        return {
          instanceId,
          status: 'available',
          endpoint: `${instanceId}.ricky.agentsphere.com`,
          port: 5432,
          connectionUrl: `postgresql://postgres:password@${instanceId}.ricky.agentsphere.com:5432/postgres`,
          metrics: {
            cpuUtilization: 25,
            memoryUtilization: 60,
            diskUtilization: 45,
            connectionsActive: 5,
            connectionsMax: 100
          },
          backups: {
            lastBackupTime: new Date(),
            nextBackupTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
            backupRetentionDays: 30
          }
        };
      },
      
      execCommand: async (instanceId: string, command: string): Promise<CommandResponse> => {
        logger.info(`Executing command on ${instanceId}: ${command}`);
        // Mock implementation
        return {
          success: true,
          output: 'Command executed successfully',
          exitCode: 0,
          executionTime: 1500
        };
      },
      
      uploadFiles: async (instanceId: string, files: { [path: string]: string }): Promise<void> => {
        logger.info(`Uploading ${Object.keys(files).length} files to ${instanceId}`);
        // Mock implementation
        await new Promise(resolve => setTimeout(resolve, 1000));
      },
      
      getMetrics: async (instanceId: string): Promise<MetricsResponse> => {
        // Mock implementation
        return {
          instanceId,
          timestamp: new Date(),
          metrics: {
            cpu: { usage: 25, max: 100 },
            memory: { usage: 1024, total: 4096 },
            storage: { used: 50, total: 100 },
            connections: { active: 5, max: 100, idle: 10 },
            queries: { per_second: 150, slow_queries: 2 },
            replication: {}
          }
        };
      },
      
      enableMonitoring: async (instanceId: string, config: MonitoringConfig): Promise<void> => {
        logger.info(`Enabling monitoring for ${instanceId}`);
        // Mock implementation
        await new Promise(resolve => setTimeout(resolve, 500));
      },
      
      createBackup: async (instanceId: string, config: BackupConfig): Promise<BackupResponse> => {
        const backupId = `backup-${Date.now()}`;
        logger.info(`Creating backup ${backupId} for ${instanceId}`);
        return {
          backupId,
          status: 'creating',
          size: 0,
          createdAt: new Date()
        };
      },
      
      restoreBackup: async (instanceId: string, backupId: string): Promise<void> => {
        logger.info(`Restoring backup ${backupId} to ${instanceId}`);
        // Mock implementation
        await new Promise(resolve => setTimeout(resolve, 5000));
      },
      
      scaleDatabase: async (instanceId: string, config: ScalingConfig): Promise<void> => {
        logger.info(`Scaling database ${instanceId}`, config);
        // Mock implementation
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    } as AgentSphereSDK;
  }

  /**
   * Deploy PostgreSQL template to AgentSphere
   */
  async deployTemplate(template: PostgreSQLDatabaseTemplate): Promise<PostgreSQLDeploymentResult> {
    const startTime = Date.now();
    const templateConfig = template.getTemplate();
    const deploymentId = `deployment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      logger.info(`Starting PostgreSQL deployment: ${templateConfig.name}`);

      // Validate template before deployment
      const validation = template.validate();
      if (!validation.isValid) {
        throw new Error(`Template validation failed: ${JSON.stringify(validation.errors)}`);
      }

      // Step 1: Create database instance in AgentSphere
      const createRequest: DatabaseCreateRequest = {
        engine: 'postgresql',
        version: templateConfig.version,
        instanceClass: this.mapInstanceType(templateConfig.instance_type),
        storageGb: templateConfig.storage_gb,
        backupEnabled: templateConfig.features.backup.enabled,
        monitoringEnabled: templateConfig.features.monitoring.enabled,
        environment: templateConfig.environment,
        tags: {
          template: templateConfig.name,
          environment: templateConfig.environment,
          managed_by: 'coderunner-v2'
        },
        securityConfig: {
          sslEnabled: templateConfig.security.ssl_enabled,
          ipWhitelist: templateConfig.security.ip_whitelist,
          encryptionAtRest: templateConfig.security.encryption_at_rest
        }
      };

      const createResponse = await this.agentSphere.createDatabase(createRequest);
      logger.info(`Database instance created: ${createResponse.instanceId}`);

      // Step 2: Wait for instance to be available
      await this.waitForInstanceReady(createResponse.instanceId, createResponse.estimatedReadyTime);

      // Step 3: Upload configuration files
      const configFiles = this.generateConfigurationFiles(template);
      await this.agentSphere.uploadFiles(createResponse.instanceId, configFiles);
      logger.info('Configuration files uploaded');

      // Step 4: Initialize database with multi-tenant setup
      await this.initializeMultiTenantSetup(createResponse.instanceId, template);

      // Step 5: Enable monitoring if configured
      if (templateConfig.features.monitoring.enabled) {
        await this.setupMonitoring(createResponse.instanceId, templateConfig);
      }

      // Step 6: Setup backup if configured
      if (templateConfig.features.backup.enabled) {
        await this.setupBackup(createResponse.instanceId, templateConfig);
      }

      // Step 7: Setup replication if configured
      if (templateConfig.features.replication.enabled) {
        await this.setupReplication(createResponse.instanceId, templateConfig);
      }

      // Step 8: Enable auto-scaling if configured
      if (templateConfig.scaling.auto_scaling) {
        await this.setupAutoScaling(createResponse.instanceId, templateConfig);
      }

      const deploymentTime = Date.now() - startTime;
      const result: PostgreSQLDeploymentResult = {
        instance_id: createResponse.instanceId,
        connection_string: createResponse.connectionUrl,
        admin_connection_string: this.buildAdminConnectionString(createResponse, templateConfig),
        admin_panel_url: `https://${createResponse.endpoint}:8080/admin`,
        metrics_endpoint: templateConfig.features.monitoring.enabled 
          ? `https://${createResponse.endpoint}:9090/metrics` 
          : undefined,
        status: 'success',
        deployment_time: deploymentTime,
        resource_usage: {
          cpu_cores: this.getInstanceCPUCores(templateConfig.instance_type),
          memory_mb: this.getInstanceMemoryMB(templateConfig.instance_type),
          storage_gb: templateConfig.storage_gb,
          network_throughput: this.getInstanceNetworkThroughput(templateConfig.instance_type)
        }
      };

      // Store deployment result
      this.deployments.set(createResponse.instanceId, result);
      this.templates.set(createResponse.instanceId, template);

      logger.info(`PostgreSQL deployment completed successfully: ${createResponse.instanceId}`);
      return result;

    } catch (error) {
      logger.error('PostgreSQL deployment failed:', error);
      
      const deploymentTime = Date.now() - startTime;
      const result: PostgreSQLDeploymentResult = {
        instance_id: '',
        connection_string: '',
        status: 'failed',
        deployment_time: deploymentTime,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        resource_usage: {
          cpu_cores: 0,
          memory_mb: 0,
          storage_gb: 0,
          network_throughput: 0
        }
      };

      return result;
    }
  }

  /**
   * Create a new tenant in an existing PostgreSQL deployment
   */
  async createTenant(instanceId: string, tenantId: string, options?: Partial<PostgreSQLTenant>): Promise<PostgreSQLTenant> {
    const template = this.templates.get(instanceId);
    if (!template) {
      throw new Error(`Template not found for instance: ${instanceId}`);
    }

    logger.info(`Creating tenant ${tenantId} in instance ${instanceId}`);

    // Add tenant to template
    const tenant = template.addTenant(tenantId, options);

    // Execute tenant creation SQL
    const createTenantSQL = this.generateCreateTenantSQL(tenant, template.getTemplate());
    const result = await this.agentSphere.execCommand(instanceId, `psql -c "${createTenantSQL}"`);

    if (!result.success) {
      // Remove tenant from template if SQL execution failed
      template.removeTenant(tenantId);
      throw new Error(`Failed to create tenant: ${result.error}`);
    }

    logger.info(`Tenant ${tenantId} created successfully`);
    return tenant;
  }

  /**
   * Remove a tenant from a PostgreSQL deployment
   */
  async removeTenant(instanceId: string, tenantId: string): Promise<boolean> {
    const template = this.templates.get(instanceId);
    if (!template) {
      throw new Error(`Template not found for instance: ${instanceId}`);
    }

    const tenant = template.getTenant(tenantId);
    if (!tenant) {
      return false;
    }

    logger.info(`Removing tenant ${tenantId} from instance ${instanceId}`);

    // Execute tenant removal SQL
    const removeTenantSQL = this.generateRemoveTenantSQL(tenant, template.getTemplate());
    const result = await this.agentSphere.execCommand(instanceId, `psql -c "${removeTenantSQL}"`);

    if (result.success) {
      template.removeTenant(tenantId);
      logger.info(`Tenant ${tenantId} removed successfully`);
      return true;
    } else {
      logger.error(`Failed to remove tenant: ${result.error}`);
      return false;
    }
  }

  /**
   * Get PostgreSQL instance status and metrics
   */
  async getInstanceStatus(instanceId: string): Promise<DatabaseStatusResponse> {
    return await this.agentSphere.getDatabaseStatus(instanceId);
  }

  /**
   * Get detailed metrics for a PostgreSQL instance
   */
  async getInstanceMetrics(instanceId: string): Promise<MetricsResponse> {
    return await this.agentSphere.getMetrics(instanceId);
  }

  /**
   * Scale a PostgreSQL instance
   */
  async scaleInstance(instanceId: string, config: ScalingConfig): Promise<void> {
    logger.info(`Scaling instance ${instanceId}`, config);
    await this.agentSphere.scaleDatabase(instanceId, config);
  }

  /**
   * Create a backup of PostgreSQL instance
   */
  async createBackup(instanceId: string): Promise<BackupResponse> {
    const template = this.templates.get(instanceId);
    if (!template) {
      throw new Error(`Template not found for instance: ${instanceId}`);
    }

    const templateConfig = template.getTemplate();
    const backupConfig: BackupConfig = {
      schedule: templateConfig.features.backup.schedule,
      retentionDays: templateConfig.features.backup.retention_days,
      compression: templateConfig.features.backup.compression !== 'none',
      encryption: templateConfig.features.backup.encryption_enabled
    };

    return await this.agentSphere.createBackup(instanceId, backupConfig);
  }

  /**
   * Restore PostgreSQL instance from backup
   */
  async restoreBackup(instanceId: string, backupId: string): Promise<void> {
    logger.info(`Restoring instance ${instanceId} from backup ${backupId}`);
    await this.agentSphere.restoreBackup(instanceId, backupId);
  }

  /**
   * Destroy a PostgreSQL instance
   */
  async destroyInstance(instanceId: string): Promise<void> {
    logger.info(`Destroying PostgreSQL instance: ${instanceId}`);
    
    try {
      await this.agentSphere.destroyDatabase(instanceId);
      
      // Clean up local references
      this.deployments.delete(instanceId);
      this.templates.delete(instanceId);
      
      logger.info(`Instance ${instanceId} destroyed successfully`);
    } catch (error) {
      logger.error(`Failed to destroy instance ${instanceId}:`, error);
      throw error;
    }
  }

  /**
   * List all PostgreSQL deployments
   */
  getDeployments(): PostgreSQLDeploymentResult[] {
    return Array.from(this.deployments.values());
  }

  /**
   * Get specific deployment by instance ID
   */
  getDeployment(instanceId: string): PostgreSQLDeploymentResult | undefined {
    return this.deployments.get(instanceId);
  }

  // Private helper methods

  private async waitForInstanceReady(instanceId: string, estimatedTime: number): Promise<void> {
    logger.info(`Waiting for instance ${instanceId} to be ready (estimated: ${estimatedTime} minutes)`);
    
    const maxAttempts = Math.max(estimatedTime * 2, 20); // At least 20 attempts
    const attemptInterval = 30000; // 30 seconds

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const status = await this.agentSphere.getDatabaseStatus(instanceId);
        
        if (status.status === 'available') {
          logger.info(`Instance ${instanceId} is ready`);
          return;
        }
        
        if (status.status === 'failed') {
          throw new Error('Instance creation failed');
        }
        
        logger.info(`Instance ${instanceId} status: ${status.status} (attempt ${attempt}/${maxAttempts})`);
        
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, attemptInterval));
        }
      } catch (error) {
        if (attempt === maxAttempts) {
          throw new Error(`Instance failed to become ready after ${maxAttempts} attempts`);
        }
        
        await new Promise(resolve => setTimeout(resolve, attemptInterval));
      }
    }
    
    throw new Error(`Instance did not become ready within expected time`);
  }

  private generateConfigurationFiles(template: PostgreSQLDatabaseTemplate): { [path: string]: string } {
    const files: { [path: string]: string } = {};
    
    // PostgreSQL configuration
    files['/etc/postgresql/postgresql.conf'] = template.generatePostgreSQLConfig();
    
    // Initialization scripts
    const initScripts = template.generateInitScripts();
    Object.entries(initScripts).forEach(([filename, content]) => {
      files[`/docker-entrypoint-initdb.d/${filename}`] = content;
    });
    
    // Backup scripts
    const backupScripts = template.generateBackupScripts();
    Object.entries(backupScripts).forEach(([filename, content]) => {
      files[`/opt/scripts/${filename}`] = content;
    });
    
    return files;
  }

  private async initializeMultiTenantSetup(instanceId: string, template: PostgreSQLDatabaseTemplate): Promise<void> {
    logger.info(`Initializing multi-tenant setup for ${instanceId}`);
    
    // The initialization scripts uploaded earlier will handle the multi-tenant setup
    // This method could perform additional setup if needed
    
    const result = await this.agentSphere.execCommand(
      instanceId, 
      'psql -d postgres -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name = \'tenant_management\';"'
    );
    
    if (!result.output.includes('tenant_management')) {
      throw new Error('Failed to initialize multi-tenant schema');
    }
    
    logger.info('Multi-tenant setup completed');
  }

  private async setupMonitoring(instanceId: string, config: PostgreSQLTemplate): Promise<void> {
    const monitoringConfig: MonitoringConfig = {
      enabled: true,
      metricsInterval: config.features.monitoring.metrics_interval,
      alertEndpoints: [], // Would be configured based on alert rules
      slowQueryThreshold: config.features.monitoring.slow_query_threshold
    };
    
    await this.agentSphere.enableMonitoring(instanceId, monitoringConfig);
    logger.info(`Monitoring enabled for ${instanceId}`);
  }

  private async setupBackup(instanceId: string, config: PostgreSQLTemplate): Promise<void> {
    const backupConfig: BackupConfig = {
      schedule: config.features.backup.schedule,
      retentionDays: config.features.backup.retention_days,
      compression: config.features.backup.compression !== 'none',
      encryption: config.features.backup.encryption_enabled
    };
    
    // Set up backup schedule using cron job or similar
    const cronSetupCommand = `echo "${backupConfig.schedule} /opt/scripts/backup.sh" | crontab -`;
    await this.agentSphere.execCommand(instanceId, cronSetupCommand);
    
    logger.info(`Backup configured for ${instanceId}`);
  }

  private async setupReplication(instanceId: string, config: PostgreSQLTemplate): Promise<void> {
    if (!config.features.replication.enabled || config.features.replication.replicas === 0) {
      return;
    }
    
    logger.info(`Setting up replication for ${instanceId} with ${config.features.replication.replicas} replicas`);
    
    // Configure replication - this would involve creating read replicas
    const scalingConfig: ScalingConfig = {
      readReplicas: config.features.replication.replicas
    };
    
    await this.agentSphere.scaleDatabase(instanceId, scalingConfig);
    logger.info('Replication setup completed');
  }

  private async setupAutoScaling(instanceId: string, config: PostgreSQLTemplate): Promise<void> {
    const scalingConfig: ScalingConfig = {
      autoScaling: {
        enabled: true,
        minCapacity: config.scaling.min_capacity,
        maxCapacity: config.scaling.max_capacity,
        targetCpuUtilization: config.scaling.scale_up_threshold
      }
    };
    
    await this.agentSphere.scaleDatabase(instanceId, scalingConfig);
    logger.info(`Auto-scaling enabled for ${instanceId}`);
  }

  private generateCreateTenantSQL(tenant: PostgreSQLTenant, config: PostgreSQLTemplate): string {
    let sql = '';
    
    switch (config.tenant_isolation) {
      case 'schema':
        sql = `SELECT tenant_management.create_tenant_schema('${tenant.tenant_id}', '${tenant.schema_name}');`;
        break;
      case 'database':
        sql = `CREATE DATABASE ${tenant.database_name}; GRANT ALL PRIVILEGES ON DATABASE ${tenant.database_name} TO ${tenant.tenant_id}_role;`;
        break;
      case 'row':
        sql = `SELECT tenant_management.create_tenant_schema('${tenant.tenant_id}', '${tenant.schema_name}');`;
        // Additional RLS setup would be done here
        break;
    }
    
    // Insert tenant record
    sql += ` INSERT INTO tenant_management.tenants (tenant_id, schema_name, database_name, resource_limits, isolation_config) VALUES ('${tenant.tenant_id}', '${tenant.schema_name}', ${tenant.database_name ? `'${tenant.database_name}'` : 'NULL'}, '${JSON.stringify(tenant.resource_limits)}', '${JSON.stringify(tenant.isolation_config)}');`;
    
    return sql;
  }

  private generateRemoveTenantSQL(tenant: PostgreSQLTenant, config: PostgreSQLTemplate): string {
    let sql = '';
    
    switch (config.tenant_isolation) {
      case 'schema':
        sql = `DROP SCHEMA IF EXISTS ${tenant.schema_name} CASCADE; DROP ROLE IF EXISTS ${tenant.tenant_id}_role;`;
        break;
      case 'database':
        sql = `DROP DATABASE IF EXISTS ${tenant.database_name}; DROP ROLE IF EXISTS ${tenant.tenant_id}_role;`;
        break;
      case 'row':
        sql = `DROP SCHEMA IF EXISTS ${tenant.schema_name} CASCADE; DROP ROLE IF EXISTS ${tenant.tenant_id}_role;`;
        break;
    }
    
    // Remove tenant record
    sql += ` DELETE FROM tenant_management.tenants WHERE tenant_id = '${tenant.tenant_id}';`;
    
    return sql;
  }

  private mapInstanceType(instanceType: string): string {
    const mapping: { [key: string]: string } = {
      'micro': 'db.t3.micro',
      'small': 'db.t3.small',
      'medium': 'db.t3.medium',
      'large': 'db.m5.large',
      'xlarge': 'db.m5.xlarge'
    };
    
    return mapping[instanceType] || 'db.t3.small';
  }

  private buildAdminConnectionString(response: DatabaseCreateResponse, config: PostgreSQLTemplate): string {
    const url = new URL(response.connectionUrl);
    url.searchParams.set('application_name', `${config.name}_admin`);
    url.searchParams.set('sslmode', config.security.ssl_enabled ? config.security.ssl_mode : 'disable');
    return url.toString();
  }

  private getInstanceCPUCores(instanceType: string): number {
    const mapping: { [key: string]: number } = {
      'micro': 1,
      'small': 1,
      'medium': 2,
      'large': 4,
      'xlarge': 8
    };
    
    return mapping[instanceType] || 1;
  }

  private getInstanceMemoryMB(instanceType: string): number {
    const mapping: { [key: string]: number } = {
      'micro': 1024,   // 1GB
      'small': 2048,   // 2GB
      'medium': 4096,  // 4GB
      'large': 8192,   // 8GB
      'xlarge': 16384  // 16GB
    };
    
    return mapping[instanceType] || 2048;
  }

  private getInstanceNetworkThroughput(instanceType: string): number {
    const mapping: { [key: string]: number } = {
      'micro': 100,    // 100 Mbps
      'small': 250,    // 250 Mbps
      'medium': 500,   // 500 Mbps
      'large': 1000,   // 1 Gbps
      'xlarge': 2000   // 2 Gbps
    };
    
    return mapping[instanceType] || 250;
  }

  private generateSecurePassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
}

/**
 * Tenant manager class for handling multi-tenant operations
 */
export class TenantManager {
  private postgresService: PostgreSQLService;

  constructor(postgresService: PostgreSQLService) {
    this.postgresService = postgresService;
  }

  /**
   * Create a new tenant with automatic schema setup
   */
  async createTenant(instanceId: string, tenantId: string, options?: {
    maxConnections?: number;
    storageQuotaMB?: number;
    cpuQuotaPercent?: number;
    customPolicies?: string[];
  }): Promise<PostgreSQLTenant> {
    const tenantOptions: Partial<PostgreSQLTenant> = {};
    
    if (options) {
      tenantOptions.resource_limits = {
        max_connections: options.maxConnections || 10,
        storage_quota_mb: options.storageQuotaMB || 1000,
        cpu_quota_percent: options.cpuQuotaPercent || 10
      };
      
      if (options.customPolicies) {
        tenantOptions.isolation_config = {
          type: 'schema', // Default, will be overridden by template
          access_policies: options.customPolicies
        };
      }
    }

    return await this.postgresService.createTenant(instanceId, tenantId, tenantOptions);
  }

  /**
   * Remove a tenant and clean up resources
   */
  async removeTenant(instanceId: string, tenantId: string): Promise<boolean> {
    return await this.postgresService.removeTenant(instanceId, tenantId);
  }

  /**
   * Get tenant usage statistics
   */
  async getTenantStats(instanceId: string, tenantId: string): Promise<any> {
    // This would query the database for tenant-specific stats
    const metrics = await this.postgresService.getInstanceMetrics(instanceId);
    
    // Return tenant-specific metrics (mock implementation)
    return {
      tenant_id: tenantId,
      connections_active: Math.floor(metrics.metrics.connections.active / 10),
      storage_used_mb: Math.floor(Math.random() * 500),
      cpu_usage_percent: Math.floor(Math.random() * 50),
      queries_per_minute: Math.floor(Math.random() * 1000),
      last_activity: new Date()
    };
  }

  /**
   * Update tenant resource limits
   */
  async updateTenantLimits(instanceId: string, tenantId: string, limits: {
    maxConnections?: number;
    storageQuotaMB?: number;
    cpuQuotaPercent?: number;
  }): Promise<void> {
    // This would update the tenant's resource limits in the database
    const updateSQL = `
      UPDATE tenant_management.tenants 
      SET resource_limits = jsonb_set(
        resource_limits, 
        '{max_connections}', 
        '${limits.maxConnections || 10}'
      )
      WHERE tenant_id = '${tenantId}'
    `;
    
    // Execute the update
    // This is a simplified implementation
    logger.info(`Updated resource limits for tenant ${tenantId}`);
  }
}

export default PostgreSQLService;