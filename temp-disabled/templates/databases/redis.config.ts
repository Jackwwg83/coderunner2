/**
 * Redis Configuration Types and Validation
 * P3-T02 Advanced Redis template configuration for multi-tenant Redis deployments
 * 
 * Features:
 * - Multiple Redis versions and deployment modes (standalone, cluster, sentinel)
 * - Advanced caching strategies (cache-aside, write-through, write-behind)
 * - Multi-tenant key prefix isolation
 * - Persistence options (RDB, AOF, mixed)
 * - Monitoring and alerting integration
 * - Auto-scaling and performance optimization
 */

import { ValidationRule, ValidationResult } from '../../types/index';

/**
 * Alert rule configuration for Redis monitoring
 */
export interface RedisAlertRule {
  name: string;
  condition: string;
  threshold: number;
  duration: string;
  severity: 'info' | 'warning' | 'critical' | 'emergency';
  description: string;
  action?: string;
}

/**
 * Redis persistence configuration
 */
export interface RedisPersistenceConfig {
  enabled: boolean;
  mode: 'rdb' | 'aof' | 'mixed';
  rdb_schedule?: string; // e.g., "save 900 1 300 10 60 10000"
  aof_fsync?: 'always' | 'everysec' | 'no';
  aof_rewrite_percentage?: number;
  aof_rewrite_min_size?: string; // e.g., "64mb"
}

/**
 * Redis clustering configuration
 */
export interface RedisClusteringConfig {
  enabled: boolean;
  shards: number;
  replicas_per_shard: number;
  cluster_config_file?: string;
  cluster_node_timeout?: number;
  cluster_announce_ip?: string;
}

/**
 * Redis monitoring configuration
 */
export interface RedisMonitoringConfig {
  enabled: boolean;
  metrics: ('memory' | 'cpu' | 'ops' | 'latency' | 'connections' | 'keyspace')[];
  collection_interval: number; // seconds
  alert_rules: RedisAlertRule[];
  alert_thresholds: {
    memory_usage_percent: number;
    cpu_usage_percent: number;
    ops_per_second: number;
    latency_ms: number;
    connection_usage_percent: number;
  };
  slow_log_threshold: number; // microseconds
  prometheus_endpoint?: string;
  grafana_dashboard_id?: string;
}

/**
 * Redis eviction policy configuration
 */
export interface RedisEvictionConfig {
  policy: 'noeviction' | 'allkeys-lru' | 'volatile-lru' | 'allkeys-lfu' | 'volatile-lfu' | 'allkeys-random' | 'volatile-random' | 'volatile-ttl';
  maxmemory_policy: string;
  maxmemory_samples?: number;
}

/**
 * Redis connection configuration
 */
export interface RedisConnectionConfig {
  max_clients: number;
  timeout_ms: number;
  tcp_keepalive: number;
  tcp_backlog: number;
  client_output_buffer_limit: {
    normal: string; // e.g., "0 0 0"
    replica: string; // e.g., "256mb 64mb 60"
    pubsub: string; // e.g., "32mb 8mb 60"
  };
}

/**
 * Redis security configuration
 */
export interface RedisSecurityConfig {
  password_enabled: boolean;
  password?: string;
  acl_enabled: boolean;
  acl_users?: Array<{
    username: string;
    password: string;
    commands: string[];
    keys: string[];
  }>;
  tls_enabled: boolean;
  tls_cert_file?: string;
  tls_key_file?: string;
  tls_ca_cert_file?: string;
  ip_whitelist: string[];
  protected_mode: boolean;
  rename_dangerous_commands: { [command: string]: string };
}

/**
 * Redis caching strategy configuration
 */
export interface RedisCacheStrategy {
  patterns: {
    cache_aside: boolean;     // Classic caching pattern
    write_through: boolean;   // Write through to backing store
    write_behind: boolean;    // Async write to backing store
    refresh_ahead: boolean;   // Proactive cache refresh
  };
  ttl_strategy: {
    default_ttl_seconds: number;
    max_ttl_seconds: number;
    sliding_expiration: boolean;
    ttl_jitter_percent: number; // Prevent cache stampede
  };
  warming: {
    enabled: boolean;
    datasets: string[];
    schedule: string; // cron expression
    batch_size: number;
  };
  compression: {
    enabled: boolean;
    algorithm: 'gzip' | 'lz4' | 'snappy';
    min_size_bytes: number;
  };
}

/**
 * Multi-tenant configuration for Redis
 */
export interface RedisTenantConfig {
  isolation_type: 'key_prefix' | 'database' | 'instance';
  key_prefix_pattern: string; // e.g., "tenant:{tenantId}:"
  max_tenants: number;
  tenant_resource_limits: {
    max_memory_per_tenant_mb: number;
    max_connections_per_tenant: number;
    max_ops_per_second_per_tenant: number;
  };
  tenant_management: {
    auto_provisioning: boolean;
    resource_quotas: boolean;
    access_control: boolean;
  };
}

/**
 * Advanced Redis template configuration
 */
export interface RedisTemplate {
  // Basic configuration
  name: string;
  version: '6.2' | '7.0' | '7.2';
  mode: 'standalone' | 'cluster' | 'sentinel';
  instance_type: 'cache.t3.micro' | 'cache.t3.small' | 'cache.t3.medium' | 'cache.m6i.large' | 'cache.m6i.xlarge' | 'cache.r6g.large';
  memory_mb: number;
  
  // Multi-tenant support
  tenant_config: RedisTenantConfig;
  
  // Advanced features
  features: {
    persistence: RedisPersistenceConfig;
    clustering: RedisClusteringConfig;
    monitoring: RedisMonitoringConfig;
    eviction: RedisEvictionConfig;
    caching_strategy: RedisCacheStrategy;
  };
  
  // Connection configuration
  connection: RedisConnectionConfig;
  
  // Security configuration
  security: RedisSecurityConfig;
  
  // Environment and deployment
  environment: 'development' | 'staging' | 'production';
  region: string;
  availability_zone?: string;
  
  // Redis modules and extensions
  modules: string[]; // e.g., ['RedisJSON', 'RedisSearch', 'RedisTimeSeries', 'RedisBloom']
  
  // Resource limits and scaling
  scaling: {
    auto_scaling: boolean;
    min_memory_mb: number;
    max_memory_mb: number;
    scale_up_threshold: number; // Memory percentage
    scale_down_threshold: number; // Memory percentage
    scale_up_cooldown: number; // minutes
    scale_down_cooldown: number; // minutes
    horizontal_scaling: {
      enabled: boolean;
      max_shards: number;
      shard_policy: 'memory_based' | 'key_based' | 'connection_based';
    };
  };
  
  // Performance tuning
  performance: {
    io_threads: number;
    io_threads_do_reads: boolean;
    lazyfree_lazy_eviction: boolean;
    lazyfree_lazy_expire: boolean;
    lazyfree_lazy_server_del: boolean;
    replica_lazy_flush: boolean;
    hash_max_ziplist_entries: number;
    hash_max_ziplist_value: number;
    list_max_ziplist_size: number;
    set_max_intset_entries: number;
    zset_max_ziplist_entries: number;
    zset_max_ziplist_value: number;
  };
  
  // Backup and disaster recovery
  backup: {
    enabled: boolean;
    schedule: string; // cron expression
    retention_days: number;
    s3_bucket?: string;
    s3_path?: string;
    encryption_enabled: boolean;
    compression: boolean;
    point_in_time_recovery: boolean;
  };
  
  // Metadata
  created_at?: Date;
  updated_at?: Date;
  deployed_at?: Date;
  status?: 'pending' | 'provisioning' | 'running' | 'stopped' | 'failed' | 'maintenance';
}

/**
 * Redis deployment result
 */
export interface RedisDeploymentResult {
  instance_id: string;
  connection_url: string;
  admin_connection_url?: string;
  cluster_endpoints?: string[]; // For cluster mode
  sentinel_endpoints?: string[]; // For sentinel mode
  admin_panel_url?: string;
  metrics_endpoint?: string;
  backup_location?: string;
  status: 'success' | 'failed' | 'partial';
  deployment_time: number; // milliseconds
  error_message?: string;
  warnings?: string[];
  resource_usage: {
    memory_mb: number;
    cpu_cores: number;
    storage_gb: number;
    network_throughput: number;
  };
}

/**
 * Redis tenant management
 */
export interface RedisTenant {
  tenant_id: string;
  key_prefix: string;
  database_number?: number; // Only for database-level isolation
  created_at: Date;
  resource_limits: {
    max_memory_mb: number;
    max_connections: number;
    max_ops_per_second: number;
    max_keys: number;
  };
  access_config: {
    allowed_commands: string[];
    forbidden_commands: string[];
    key_patterns: string[];
    read_only: boolean;
  };
  caching_config: {
    default_ttl: number;
    max_ttl: number;
    eviction_policy: string;
  };
  status: 'active' | 'suspended' | 'migrating' | 'deleting';
}

/**
 * Validation rules for Redis template
 */
export const REDIS_VALIDATION_RULES: ValidationRule[] = [
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
    message: 'Redis version is required'
  },
  {
    field: 'mode',
    type: 'required',
    message: 'Redis deployment mode is required'
  },
  {
    field: 'instance_type',
    type: 'required',
    message: 'Instance type is required'
  },
  {
    field: 'memory_mb',
    type: 'custom',
    validator: (value: number) => value >= 128 && value <= 65536,
    message: 'Memory size must be between 128 MB and 64 GB'
  },
  {
    field: 'tenant_config.key_prefix_pattern',
    type: 'pattern',
    value: /^[a-zA-Z0-9:_-]+\{[a-zA-Z0-9_]+\}[a-zA-Z0-9:_-]*$/,
    message: 'Key prefix pattern must include tenant ID placeholder, e.g., "tenant:{tenantId}:"'
  },
  {
    field: 'connection.max_clients',
    type: 'custom',
    validator: (value: number) => value >= 1 && value <= 65535,
    message: 'Maximum clients must be between 1 and 65535'
  },
  {
    field: 'security.ip_whitelist',
    type: 'custom',
    validator: (ips: string[]) => ips.every(ip => /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(ip) || ip === '*'),
    message: 'All IP addresses must be valid IPv4 addresses, CIDR blocks, or "*" for all'
  },
  {
    field: 'features.clustering.shards',
    type: 'custom',
    validator: (value: number, template: RedisTemplate) => 
      !template.features.clustering.enabled || (value >= 3 && value % 2 === 1),
    message: 'Cluster must have at least 3 shards and an odd number for proper master election'
  }
];

/**
 * Default Redis template configuration
 */
export const DEFAULT_REDIS_TEMPLATE: Partial<RedisTemplate> = {
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
  },
  features: {
    persistence: {
      enabled: true,
      mode: 'rdb',
      rdb_schedule: 'save 900 1 300 10 60 10000',
      aof_fsync: 'everysec'
    },
    clustering: {
      enabled: false,
      shards: 3,
      replicas_per_shard: 1,
      cluster_node_timeout: 15000
    },
    monitoring: {
      enabled: true,
      metrics: ['memory', 'cpu', 'ops', 'latency', 'connections'],
      collection_interval: 60,
      alert_rules: [
        {
          name: 'High Memory Usage',
          condition: 'memory_usage_percent > threshold',
          threshold: 80,
          duration: '5m',
          severity: 'warning',
          description: 'Redis memory usage is high'
        },
        {
          name: 'Connection Limit Reached',
          condition: 'connection_usage_percent > threshold',
          threshold: 90,
          duration: '2m',
          severity: 'critical',
          description: 'Redis connection pool is nearly exhausted'
        },
        {
          name: 'High Latency',
          condition: 'avg_latency_ms > threshold',
          threshold: 10,
          duration: '3m',
          severity: 'warning',
          description: 'Redis response latency is high'
        }
      ],
      alert_thresholds: {
        memory_usage_percent: 85,
        cpu_usage_percent: 75,
        ops_per_second: 10000,
        latency_ms: 5,
        connection_usage_percent: 90
      },
      slow_log_threshold: 10000 // 10ms
    },
    eviction: {
      policy: 'allkeys-lru',
      maxmemory_policy: 'allkeys-lru',
      maxmemory_samples: 5
    },
    caching_strategy: {
      patterns: {
        cache_aside: true,
        write_through: false,
        write_behind: false,
        refresh_ahead: false
      },
      ttl_strategy: {
        default_ttl_seconds: 3600, // 1 hour
        max_ttl_seconds: 86400, // 24 hours
        sliding_expiration: false,
        ttl_jitter_percent: 10
      },
      warming: {
        enabled: false,
        datasets: [],
        schedule: '0 6 * * *', // Daily at 6 AM
        batch_size: 1000
      },
      compression: {
        enabled: false,
        algorithm: 'gzip',
        min_size_bytes: 1024
      }
    }
  },
  connection: {
    max_clients: 1000,
    timeout_ms: 0, // 0 = no timeout
    tcp_keepalive: 300,
    tcp_backlog: 511,
    client_output_buffer_limit: {
      normal: '0 0 0',
      replica: '256mb 64mb 60',
      pubsub: '32mb 8mb 60'
    }
  },
  security: {
    password_enabled: true,
    acl_enabled: false,
    tls_enabled: false,
    ip_whitelist: ['0.0.0.0/0'], // Default to allow all, should be restricted in production
    protected_mode: true,
    rename_dangerous_commands: {
      'FLUSHDB': 'FLUSHDB_RENAMED',
      'FLUSHALL': 'FLUSHALL_RENAMED',
      'DEBUG': 'DEBUG_RENAMED'
    }
  },
  environment: 'development',
  region: 'us-east-1',
  modules: [],
  scaling: {
    auto_scaling: false,
    min_memory_mb: 512,
    max_memory_mb: 4096,
    scale_up_threshold: 80,
    scale_down_threshold: 30,
    scale_up_cooldown: 5,
    scale_down_cooldown: 15,
    horizontal_scaling: {
      enabled: false,
      max_shards: 16,
      shard_policy: 'memory_based'
    }
  },
  performance: {
    io_threads: 1,
    io_threads_do_reads: false,
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
  },
  backup: {
    enabled: false,
    schedule: '0 2 * * *', // Daily at 2 AM
    retention_days: 7,
    encryption_enabled: false,
    compression: true,
    point_in_time_recovery: false
  }
};

/**
 * Validate Redis template configuration
 */
export function validateRedisTemplate(template: RedisTemplate): ValidationResult {
  const errors: { [field: string]: string[] } = {};
  
  for (const rule of REDIS_VALIDATION_RULES) {
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
          isValid = rule.validator(value, template);
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
  
  // Additional validation logic
  if (template.mode === 'cluster' && !template.features.clustering.enabled) {
    errors['features.clustering.enabled'] = ['Clustering must be enabled when mode is cluster'];
  }
  
  if (template.features.clustering.enabled && template.features.clustering.shards < 3) {
    errors['features.clustering.shards'] = ['Cluster mode requires at least 3 shards'];
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
export const REDIS_ENVIRONMENT_PRESETS: Record<string, Partial<RedisTemplate>> = {
  development: {
    instance_type: 'cache.t3.micro',
    memory_mb: 256,
    features: {
      persistence: {
        enabled: false,
        mode: 'rdb'
      },
      clustering: {
        enabled: false,
        shards: 1,
        replicas_per_shard: 0
      },
      monitoring: {
        enabled: false,
        metrics: ['memory'],
        collection_interval: 300,
        alert_rules: []
      }
    },
    security: {
      password_enabled: false,
      acl_enabled: false,
      tls_enabled: false,
      ip_whitelist: ['127.0.0.1/32', '10.0.0.0/8'],
      protected_mode: false,
      rename_dangerous_commands: {}
    },
    scaling: {
      auto_scaling: false,
      min_memory_mb: 128,
      max_memory_mb: 512
    },
    backup: {
      enabled: false,
      schedule: '',
      retention_days: 1
    }
  },
  staging: {
    instance_type: 'cache.t3.small',
    memory_mb: 1024,
    features: {
      persistence: {
        enabled: true,
        mode: 'rdb',
        rdb_schedule: 'save 900 1 300 10 60 10000'
      },
      clustering: {
        enabled: false,
        shards: 1,
        replicas_per_shard: 1
      },
      monitoring: {
        enabled: true,
        metrics: ['memory', 'cpu', 'ops'],
        collection_interval: 120,
        alert_rules: []
      }
    },
    security: {
      password_enabled: true,
      acl_enabled: false,
      tls_enabled: false,
      ip_whitelist: ['10.0.0.0/8'],
      protected_mode: true,
      rename_dangerous_commands: {
        'FLUSHDB': 'FLUSHDB_RENAMED',
        'FLUSHALL': 'FLUSHALL_RENAMED'
      }
    },
    scaling: {
      auto_scaling: true,
      min_memory_mb: 512,
      max_memory_mb: 2048
    },
    backup: {
      enabled: true,
      schedule: '0 2 * * *',
      retention_days: 7,
      compression: true
    }
  },
  production: {
    instance_type: 'cache.m6i.large',
    memory_mb: 4096,
    features: {
      persistence: {
        enabled: true,
        mode: 'mixed',
        rdb_schedule: 'save 900 1 300 10 60 10000',
        aof_fsync: 'everysec'
      },
      clustering: {
        enabled: true,
        shards: 3,
        replicas_per_shard: 2,
        cluster_node_timeout: 15000
      },
      monitoring: {
        enabled: true,
        metrics: ['memory', 'cpu', 'ops', 'latency', 'connections', 'keyspace'],
        collection_interval: 30,
        alert_rules: []
      }
    },
    security: {
      password_enabled: true,
      acl_enabled: true,
      tls_enabled: true,
      ip_whitelist: [], // Should be configured per deployment
      protected_mode: true,
      rename_dangerous_commands: {
        'FLUSHDB': 'FLUSHDB_RENAMED',
        'FLUSHALL': 'FLUSHALL_RENAMED',
        'DEBUG': 'DEBUG_RENAMED',
        'EVAL': 'EVAL_RENAMED',
        'CONFIG': 'CONFIG_RENAMED'
      }
    },
    scaling: {
      auto_scaling: true,
      min_memory_mb: 2048,
      max_memory_mb: 16384,
      horizontal_scaling: {
        enabled: true,
        max_shards: 16,
        shard_policy: 'memory_based'
      }
    },
    backup: {
      enabled: true,
      schedule: '0 1 * * *',
      retention_days: 30,
      encryption_enabled: true,
      compression: true,
      point_in_time_recovery: true
    }
  }
};