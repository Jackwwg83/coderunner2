/**
 * CodeRunner v2.0 Template System
 * 
 * Exports all template types and services for database deployment
 * and management in AgentSphere cloud environment.
 */

// PostgreSQL Templates (P3-T01)
export {
  PostgreSQLTemplate,
  PostgreSQLDeploymentResult,
  PostgreSQLTenant,
  AlertRule,
  BackupConfig,
  MonitoringConfig,
  MigrationConfig,
  ReplicationConfig,
  ConnectionPoolConfig,
  SecurityConfig,
  PerformanceConfig,
  validatePostgreSQLTemplate,
  DEFAULT_POSTGRESQL_TEMPLATE,
  ENVIRONMENT_PRESETS
} from './databases/postgresql.config';

export {
  PostgreSQLDatabaseTemplate,
  createPostgreSQLTemplate,
  createEnvironmentTemplate
} from './databases/postgresql.template';

export {
  PostgreSQLService,
  TenantManager
} from './databases/postgresql.service';

// Redis Templates (P3-T02)
export {
  RedisTemplate,
  RedisDeploymentResult,
  RedisTenant,
  RedisAlertRule,
  RedisPersistenceConfig,
  RedisClusteringConfig,
  RedisMonitoringConfig,
  RedisEvictionConfig,
  RedisConnectionConfig,
  RedisSecurityConfig,
  RedisCacheStrategy,
  RedisTenantConfig,
  validateRedisTemplate,
  DEFAULT_REDIS_TEMPLATE,
  REDIS_ENVIRONMENT_PRESETS
} from './databases/redis.config';

export {
  RedisCacheTemplate,
  createRedisTemplate,
  createEnvironmentRedisTemplate
} from './databases/redis.template';

export {
  RedisService,
  RedisTenantManager
} from './databases/redis.service';

// Template System Types
export interface TemplateMetadata {
  id: string;
  name: string;
  description: string;
  version: string;
  type: 'database' | 'application' | 'service';
  category: string;
  tags: string[];
  author: string;
  created_at: Date;
  updated_at: Date;
  downloads: number;
  rating: number;
  is_official: boolean;
}

export interface TemplateRegistry {
  templates: TemplateMetadata[];
  categories: string[];
  total: number;
  page: number;
  limit: number;
}

// Template Factory Interface
export interface TemplateFactory<T> {
  create(config?: Partial<T>): T;
  validate(template: T): { isValid: boolean; errors: any };
  deploy(template: T): Promise<any>;
  destroy(templateId: string): Promise<void>;
}

// Database Template Categories
export const DATABASE_TEMPLATE_CATEGORIES = {
  RELATIONAL: 'relational',
  NOSQL: 'nosql',
  CACHE: 'cache',
  SEARCH: 'search',
  ANALYTICS: 'analytics',
  TIMESERIES: 'timeseries'
} as const;

export type DatabaseTemplateCategory = typeof DATABASE_TEMPLATE_CATEGORIES[keyof typeof DATABASE_TEMPLATE_CATEGORIES];

// Supported Database Engines
export const SUPPORTED_ENGINES = {
  POSTGRESQL: 'postgresql',
  MYSQL: 'mysql',
  MONGODB: 'mongodb',
  REDIS: 'redis',
  ELASTICSEARCH: 'elasticsearch',
  INFLUXDB: 'influxdb',
  CASSANDRA: 'cassandra',
  MARIADB: 'mariadb'
} as const;

export type SupportedEngine = typeof SUPPORTED_ENGINES[keyof typeof SUPPORTED_ENGINES];

// Template Status Constants
export const TEMPLATE_STATUS = {
  PENDING: 'pending',
  DEPLOYING: 'deploying',
  DEPLOYED: 'deployed',
  FAILED: 'failed',
  UPDATING: 'updating',
  DESTROYING: 'destroying',
  DESTROYED: 'destroyed'
} as const;

export type TemplateStatus = typeof TEMPLATE_STATUS[keyof typeof TEMPLATE_STATUS];

// Environment Constants
export const ENVIRONMENTS = {
  DEVELOPMENT: 'development',
  STAGING: 'staging',
  PRODUCTION: 'production',
  TESTING: 'testing'
} as const;

export type Environment = typeof ENVIRONMENTS[keyof typeof ENVIRONMENTS];

// Template Validation Rules
export interface TemplateValidationRule {
  field: string;
  type: 'required' | 'string' | 'number' | 'boolean' | 'email' | 'url' | 'pattern' | 'custom';
  value?: any;
  message: string;
  validator?: (value: any, context?: any) => boolean;
}

export interface TemplateValidationResult {
  isValid: boolean;
  errors: { [field: string]: string[] };
  warnings: { [field: string]: string[] };
}

/**
 * Base template interface that all templates should implement
 */
export interface BaseTemplate {
  name: string;
  version: string;
  description?: string;
  environment: Environment;
  created_at?: Date;
  updated_at?: Date;
  status?: TemplateStatus;
}

/**
 * Template deployment result interface
 */
export interface TemplateDeploymentResult {
  template_id: string;
  instance_id: string;
  status: 'success' | 'failed' | 'partial';
  deployment_time: number; // milliseconds
  error_message?: string;
  warnings?: string[];
  endpoints?: { [key: string]: string };
  credentials?: { [key: string]: string };
  resource_usage: {
    cpu_cores: number;
    memory_mb: number;
    storage_gb: number;
    network_throughput: number;
  };
}

/**
 * Template service interface
 */
export interface TemplateService<T extends BaseTemplate> {
  deployTemplate(template: T): Promise<TemplateDeploymentResult>;
  getTemplateStatus(instanceId: string): Promise<any>;
  updateTemplate(instanceId: string, updates: Partial<T>): Promise<void>;
  destroyTemplate(instanceId: string): Promise<void>;
  validateTemplate(template: T): TemplateValidationResult;
}

// Future template types (placeholders for P3-T02, P3-T03, etc.)
export interface MySQLTemplate extends BaseTemplate {
  // MySQL-specific configuration
  engine_version: '5.7' | '8.0';
  instance_class: string;
  storage_gb: number;
}

export interface MongoDBTemplate extends BaseTemplate {
  // MongoDB-specific configuration
  version: '4.4' | '5.0' | '6.0' | '7.0';
  replica_set_size: number;
  sharding_enabled: boolean;
}

export interface RedisTemplateBase extends BaseTemplate {
  // Redis-specific basic configuration (legacy interface)
  version: '6.0' | '6.2' | '7.0';
  memory_gb: number;
  cluster_mode: boolean;
  persistence_enabled: boolean;
}

/**
 * Template registry service for managing available templates
 */
export class TemplateRegistryService {
  private templates: Map<string, TemplateMetadata> = new Map();

  /**
   * Register a new template in the registry
   */
  registerTemplate(metadata: TemplateMetadata): void {
    this.templates.set(metadata.id, metadata);
  }

  /**
   * Get all available templates
   */
  getTemplates(category?: DatabaseTemplateCategory): TemplateMetadata[] {
    const allTemplates = Array.from(this.templates.values());
    
    if (category) {
      return allTemplates.filter(template => template.category === category);
    }
    
    return allTemplates;
  }

  /**
   * Get template by ID
   */
  getTemplate(id: string): TemplateMetadata | undefined {
    return this.templates.get(id);
  }

  /**
   * Search templates by name or tags
   */
  searchTemplates(query: string): TemplateMetadata[] {
    const lowercaseQuery = query.toLowerCase();
    
    return Array.from(this.templates.values()).filter(template => 
      template.name.toLowerCase().includes(lowercaseQuery) ||
      template.description.toLowerCase().includes(lowercaseQuery) ||
      template.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery))
    );
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(): { [category: string]: TemplateMetadata[] } {
    const result: { [category: string]: TemplateMetadata[] } = {};
    
    for (const template of this.templates.values()) {
      if (!result[template.category]) {
        result[template.category] = [];
      }
      result[template.category].push(template);
    }
    
    return result;
  }

  /**
   * Get popular templates (sorted by downloads and rating)
   */
  getPopularTemplates(limit: number = 10): TemplateMetadata[] {
    return Array.from(this.templates.values())
      .sort((a, b) => {
        // Sort by rating first, then by downloads
        if (a.rating !== b.rating) {
          return b.rating - a.rating;
        }
        return b.downloads - a.downloads;
      })
      .slice(0, limit);
  }
}

/**
 * Default template registry instance
 */
export const templateRegistry = new TemplateRegistryService();

// Register PostgreSQL template
templateRegistry.registerTemplate({
  id: 'postgresql-advanced',
  name: 'PostgreSQL Advanced',
  description: 'High-performance PostgreSQL database with multi-tenant support, backup, monitoring, and auto-scaling',
  version: '1.0.0',
  type: 'database',
  category: DATABASE_TEMPLATE_CATEGORIES.RELATIONAL,
  tags: ['postgresql', 'database', 'relational', 'multi-tenant', 'backup', 'monitoring', 'auto-scaling'],
  author: 'CodeRunner Team',
  created_at: new Date(),
  updated_at: new Date(),
  downloads: 0,
  rating: 5.0,
  is_official: true
});

// Register Redis template
templateRegistry.registerTemplate({
  id: 'redis-advanced',
  name: 'Redis Advanced Caching',
  description: 'High-performance Redis caching system with multi-tenant key isolation, clustering, persistence, and advanced caching strategies',
  version: '1.0.0',
  type: 'database',
  category: DATABASE_TEMPLATE_CATEGORIES.CACHE,
  tags: ['redis', 'cache', 'key-value', 'multi-tenant', 'clustering', 'persistence', 'caching-strategies', 'monitoring'],
  author: 'CodeRunner Team',
  created_at: new Date(),
  updated_at: new Date(),
  downloads: 0,
  rating: 5.0,
  is_official: true
});