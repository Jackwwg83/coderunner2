/**
 * PostgreSQL Configuration Types and Validation
 * Advanced database template configuration for multi-tenant PostgreSQL deployments
 */

import { ValidationRule, ValidationResult } from '../../types/index';

/**
 * Alert rule configuration for PostgreSQL monitoring
 */
export interface AlertRule {
  name: string;
  condition: string;
  threshold: number;
  duration: string;
  severity: 'info' | 'warning' | 'critical' | 'emergency';
  description: string;
  action?: string;
}

/**
 * Backup configuration for PostgreSQL instances
 */
export interface BackupConfig {
  enabled: boolean;
  schedule: string; // cron expression
  retention_days: number;
  s3_bucket?: string;
  s3_path?: string;
  encryption_enabled: boolean;
  compression: 'none' | 'gzip' | 'lz4';
  backup_type: 'full' | 'incremental' | 'differential';
}

/**
 * Monitoring configuration for PostgreSQL instances
 */
export interface MonitoringConfig {
  enabled: boolean;
  metrics_interval: number; // seconds
  alert_rules: AlertRule[];
  prometheus_endpoint?: string;
  grafana_dashboard_id?: string;
  log_level: 'debug' | 'info' | 'warn' | 'error';
  slow_query_threshold: number; // milliseconds
}

/**
 * Migration configuration for PostgreSQL instances
 */
export interface MigrationConfig {
  enabled: boolean;
  migration_path: string;
  auto_migrate: boolean;
  rollback_enabled: boolean;
  version_table: string;
  migration_lock_timeout: number;
}

/**
 * Replication configuration for PostgreSQL instances
 */
export interface ReplicationConfig {
  enabled: boolean;
  replicas: number;
  read_write_split: boolean;
  sync_mode: 'synchronous' | 'asynchronous';
  replication_slots: string[];
  standby_timeout: number;
}

/**
 * Connection pool configuration
 */
export interface ConnectionPoolConfig {
  min: number;
  max: number;
  idle_timeout_ms: number;
  connection_timeout_ms: number;
  statement_timeout_ms: number;
  query_timeout_ms: number;
}

/**
 * Security configuration for PostgreSQL instances
 */
export interface SecurityConfig {
  ssl_enabled: boolean;
  ssl_mode: 'disable' | 'require' | 'verify-ca' | 'verify-full';
  ip_whitelist: string[];
  encryption_at_rest: boolean;
  password_encryption: 'md5' | 'scram-sha-256';
  audit_logging: boolean;
  row_level_security: boolean;
}

/**
 * Performance tuning configuration
 */
export interface PerformanceConfig {
  shared_buffers: string; // e.g., '256MB'
  effective_cache_size: string; // e.g., '1GB'
  maintenance_work_mem: string; // e.g., '64MB'
  work_mem: string; // e.g., '4MB'
  max_connections: number;
  checkpoint_completion_target: number; // 0.0 - 1.0
  wal_buffers: string; // e.g., '16MB'
  random_page_cost: number; // default 4.0
}

/**
 * Advanced PostgreSQL template configuration
 */
export interface PostgreSQLTemplate {
  // Basic configuration
  name: string;
  version: '12' | '13' | '14' | '15' | '16';
  instance_type: 'micro' | 'small' | 'medium' | 'large' | 'xlarge';
  storage_gb: number;
  storage_type: 'gp2' | 'gp3' | 'io1' | 'io2';
  
  // Multi-tenant support
  tenant_isolation: 'schema' | 'database' | 'row';
  schema_prefix: string;
  max_tenants: number;
  tenant_management: {
    auto_provisioning: boolean;
    resource_quotas: boolean;
    isolation_level: 'read_uncommitted' | 'read_committed' | 'repeatable_read' | 'serializable';
  };
  
  // High availability and disaster recovery
  features: {
    backup: BackupConfig;
    monitoring: MonitoringConfig;
    migration: MigrationConfig;
    replication: ReplicationConfig;
  };
  
  // Connection and performance
  connection_pool: ConnectionPoolConfig;
  performance: PerformanceConfig;
  
  // Security configuration
  security: SecurityConfig;
  
  // Environment and deployment
  environment: 'development' | 'staging' | 'production';
  region: string;
  availability_zone?: string;
  maintenance_window: string; // e.g., 'sun:05:00-sun:06:00'
  
  // Extensions and plugins
  extensions: string[]; // e.g., ['uuid-ossp', 'pg_stat_statements', 'pg_trgm']
  
  // Resource limits and scaling
  scaling: {
    auto_scaling: boolean;
    min_capacity: number;
    max_capacity: number;
    scale_up_threshold: number; // CPU percentage
    scale_down_threshold: number; // CPU percentage
    scale_up_cooldown: number; // minutes
    scale_down_cooldown: number; // minutes
  };
  
  // Metadata
  created_at?: Date;
  updated_at?: Date;
  deployed_at?: Date;
  status?: 'pending' | 'provisioning' | 'running' | 'stopped' | 'failed' | 'maintenance';
}

/**
 * PostgreSQL deployment result
 */
export interface PostgreSQLDeploymentResult {
  instance_id: string;
  connection_string: string;
  admin_connection_string?: string;
  read_replica_endpoints?: string[];
  admin_panel_url?: string;
  metrics_endpoint?: string;
  backup_location?: string;
  status: 'success' | 'failed' | 'partial';
  deployment_time: number; // milliseconds
  error_message?: string;
  warnings?: string[];
  resource_usage: {
    cpu_cores: number;
    memory_mb: number;
    storage_gb: number;
    network_throughput: number;
  };
}

/**
 * PostgreSQL tenant management
 */
export interface PostgreSQLTenant {
  tenant_id: string;
  schema_name: string;
  database_name?: string; // only for database-level isolation
  created_at: Date;
  resource_limits: {
    max_connections: number;
    storage_quota_mb: number;
    cpu_quota_percent: number;
  };
  isolation_config: {
    type: 'schema' | 'database' | 'row';
    access_policies: string[];
    row_security_policies?: string[];
  };
  status: 'active' | 'suspended' | 'migrating' | 'deleting';
}

/**
 * Validation rules for PostgreSQL template
 */
export const POSTGRESQL_VALIDATION_RULES: ValidationRule[] = [
  {
    field: 'name',
    type: 'required',
    message: 'Template name is required'
  },
  {
    field: 'name',
    type: 'pattern',
    value: /^[a-zA-Z0-9-_]+$/,
    message: 'Template name must contain only alphanumeric characters, hyphens, and underscores'
  },
  {
    field: 'version',
    type: 'required',
    message: 'PostgreSQL version is required'
  },
  {
    field: 'instance_type',
    type: 'required',
    message: 'Instance type is required'
  },
  {
    field: 'storage_gb',
    type: 'custom',
    validator: (value: number) => value >= 20 && value <= 65536,
    message: 'Storage size must be between 20 GB and 64 TB'
  },
  {
    field: 'tenant_isolation',
    type: 'required',
    message: 'Tenant isolation strategy is required'
  },
  {
    field: 'schema_prefix',
    type: 'pattern',
    value: /^[a-zA-Z][a-zA-Z0-9_]*$/,
    message: 'Schema prefix must start with a letter and contain only alphanumeric characters and underscores'
  },
  {
    field: 'connection_pool.max',
    type: 'custom',
    validator: (value: number) => value >= 1 && value <= 1000,
    message: 'Maximum connections must be between 1 and 1000'
  },
  {
    field: 'connection_pool.min',
    type: 'custom',
    validator: (value: number) => value >= 0,
    message: 'Minimum connections must be between 0 and maximum connections'
  },
  {
    field: 'security.ip_whitelist',
    type: 'custom',
    validator: (ips: string[]) => ips.every(ip => /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(ip)),
    message: 'All IP addresses must be valid IPv4 addresses or CIDR blocks'
  }
];

/**
 * Default PostgreSQL template configuration
 */
export const DEFAULT_POSTGRESQL_TEMPLATE: Partial<PostgreSQLTemplate> = {
  version: '16',
  instance_type: 'small',
  storage_gb: 100,
  storage_type: 'gp3',
  tenant_isolation: 'schema',
  schema_prefix: 'tenant',
  max_tenants: 100,
  tenant_management: {
    auto_provisioning: true,
    resource_quotas: true,
    isolation_level: 'read_committed'
  },
  features: {
    backup: {
      enabled: true,
      schedule: '0 2 * * *', // Daily at 2 AM
      retention_days: 30,
      encryption_enabled: true,
      compression: 'gzip',
      backup_type: 'full'
    },
    monitoring: {
      enabled: true,
      metrics_interval: 60,
      alert_rules: [
        {
          name: 'High CPU Usage',
          condition: 'cpu_usage > threshold',
          threshold: 80,
          duration: '5m',
          severity: 'warning',
          description: 'CPU usage is consistently high'
        },
        {
          name: 'Low Disk Space',
          condition: 'disk_free_percent < threshold',
          threshold: 10,
          duration: '1m',
          severity: 'critical',
          description: 'Disk space is running low'
        },
        {
          name: 'Connection Limit Reached',
          condition: 'connection_usage_percent > threshold',
          threshold: 90,
          duration: '2m',
          severity: 'warning',
          description: 'Connection pool is nearly exhausted'
        }
      ],
      log_level: 'info',
      slow_query_threshold: 1000
    },
    migration: {
      enabled: true,
      migration_path: '/migrations',
      auto_migrate: false,
      rollback_enabled: true,
      version_table: 'schema_migrations',
      migration_lock_timeout: 60
    },
    replication: {
      enabled: false,
      replicas: 0,
      read_write_split: false,
      sync_mode: 'asynchronous',
      replication_slots: [],
      standby_timeout: 5000
    }
  },
  connection_pool: {
    min: 5,
    max: 100,
    idle_timeout_ms: 30000,
    connection_timeout_ms: 5000,
    statement_timeout_ms: 60000,
    query_timeout_ms: 30000
  },
  performance: {
    shared_buffers: '256MB',
    effective_cache_size: '1GB',
    maintenance_work_mem: '64MB',
    work_mem: '4MB',
    max_connections: 100,
    checkpoint_completion_target: 0.9,
    wal_buffers: '16MB',
    random_page_cost: 1.1
  },
  security: {
    ssl_enabled: true,
    ssl_mode: 'require',
    ip_whitelist: ['0.0.0.0/0'], // Default to allow all, should be restricted in production
    encryption_at_rest: true,
    password_encryption: 'scram-sha-256',
    audit_logging: true,
    row_level_security: false
  },
  environment: 'development',
  region: 'us-east-1',
  maintenance_window: 'sun:05:00-sun:06:00',
  extensions: ['uuid-ossp', 'pg_stat_statements', 'pg_trgm'],
  scaling: {
    auto_scaling: false,
    min_capacity: 1,
    max_capacity: 10,
    scale_up_threshold: 70,
    scale_down_threshold: 30,
    scale_up_cooldown: 5,
    scale_down_cooldown: 15
  }
};

/**
 * Validate PostgreSQL template configuration
 */
export function validatePostgreSQLTemplate(template: PostgreSQLTemplate): ValidationResult {
  const errors: { [field: string]: string[] } = {};
  
  for (const rule of POSTGRESQL_VALIDATION_RULES) {
    const value = getNestedValue(template, rule.field);
    let isValid = true;
    
    switch (rule.type) {
      case 'required':
        isValid = value !== undefined && value !== null && value !== '';
        break;
      case 'email':
        isValid = typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        break;
      case 'minLength':
        isValid = typeof value === 'string' && value.length >= (rule.value as number);
        break;
      case 'maxLength':
        isValid = typeof value === 'string' && value.length <= (rule.value as number);
        break;
      case 'pattern':
        isValid = typeof value === 'string' && (rule.value as RegExp).test(value);
        break;
      case 'custom':
        if (rule.validator) {
          isValid = rule.validator(value);
        }
        break;
    }
    
    if (!isValid) {
      if (!errors[rule.field]) {
        errors[rule.field] = [];
      }
      errors[rule.field].push(rule.message);
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Environment-specific template presets
 */
export const ENVIRONMENT_PRESETS: Record<string, Partial<PostgreSQLTemplate>> = {
  development: {
    instance_type: 'micro',
    storage_gb: 20,
    features: {
      backup: {
        enabled: false,
        schedule: '0 2 * * *',
        retention_days: 7,
        encryption_enabled: false,
        compression: 'none',
        backup_type: 'full'
      },
      monitoring: {
        enabled: false,
        metrics_interval: 60,
        alert_rules: [],
        log_level: 'info',
        slow_query_threshold: 1000
      },
      migration: {
        enabled: false,
        migration_path: '/migrations',
        auto_migrate: false,
        rollback_enabled: false,
        version_table: 'schema_migrations',
        migration_lock_timeout: 60
      },
      replication: {
        enabled: false,
        replicas: 0,
        read_write_split: false,
        sync_mode: 'asynchronous',
        replication_slots: [],
        standby_timeout: 5000
      }
    },
    security: {
      ssl_enabled: false,
      ssl_mode: 'disable',
      ip_whitelist: ['127.0.0.1/32', '10.0.0.0/8'],
      encryption_at_rest: false,
      password_encryption: 'md5',
      audit_logging: false,
      row_level_security: false
    },
    scaling: {
      auto_scaling: false,
      min_capacity: 1,
      max_capacity: 1,
      scale_up_threshold: 80,
      scale_down_threshold: 20,
      scale_up_cooldown: 5,
      scale_down_cooldown: 15
    }
  },
  staging: {
    instance_type: 'small',
    storage_gb: 50,
    features: {
      backup: {
        enabled: true,
        schedule: '0 2 * * *',
        retention_days: 7,
        encryption_enabled: true,
        compression: 'gzip',
        backup_type: 'full'
      },
      monitoring: {
        enabled: true,
        metrics_interval: 60,
        alert_rules: [],
        log_level: 'info',
        slow_query_threshold: 1000
      },
      migration: {
        enabled: true,
        migration_path: '/migrations',
        auto_migrate: false,
        rollback_enabled: true,
        version_table: 'schema_migrations',
        migration_lock_timeout: 60
      },
      replication: {
        enabled: false,
        replicas: 1,
        read_write_split: false,
        sync_mode: 'asynchronous',
        replication_slots: [],
        standby_timeout: 5000
      }
    },
    security: {
      ssl_enabled: true,
      ssl_mode: 'require',
      ip_whitelist: ['10.0.0.0/8'],
      encryption_at_rest: true,
      password_encryption: 'scram-sha-256',
      audit_logging: true,
      row_level_security: false
    },
    scaling: {
      auto_scaling: true,
      min_capacity: 1,
      max_capacity: 3,
      scale_up_threshold: 70,
      scale_down_threshold: 30,
      scale_up_cooldown: 5,
      scale_down_cooldown: 10
    }
  },
  production: {
    instance_type: 'large',
    storage_gb: 500,
    features: {
      backup: {
        enabled: true,
        schedule: '0 1 * * *',
        retention_days: 90,
        encryption_enabled: true,
        compression: 'lz4',
        backup_type: 'incremental'
      },
      monitoring: {
        enabled: true,
        metrics_interval: 30,
        alert_rules: [],
        log_level: 'warn',
        slow_query_threshold: 500
      },
      migration: {
        enabled: true,
        migration_path: '/migrations',
        auto_migrate: false,
        rollback_enabled: true,
        version_table: 'schema_migrations',
        migration_lock_timeout: 60
      },
      replication: {
        enabled: true,
        replicas: 2,
        read_write_split: true,
        sync_mode: 'synchronous',
        replication_slots: ['primary_slot'],
        standby_timeout: 3000
      }
    },
    security: {
      ssl_enabled: true,
      ssl_mode: 'verify-full',
      ip_whitelist: [], // Should be configured per deployment
      encryption_at_rest: true,
      password_encryption: 'scram-sha-256',
      audit_logging: true,
      row_level_security: true
    },
    scaling: {
      auto_scaling: true,
      min_capacity: 2,
      max_capacity: 10,
      scale_up_threshold: 65,
      scale_down_threshold: 25,
      scale_up_cooldown: 3,
      scale_down_cooldown: 20
    }
  }
};