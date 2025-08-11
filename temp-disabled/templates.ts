/**
 * Template Management Routes
 * P3-T01 Implementation for CodeRunner v2.0
 * 
 * REST API endpoints for database template management:
 * - Template CRUD operations
 * - Deployment management
 * - Multi-tenant operations
 * - Monitoring and metrics
 */

import express, { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { rbacMiddleware } from '../middleware/rbac';
import { validateRequest } from '../middleware/validation';
import { securityHeaders, rateLimiter } from '../middleware/security';
import {
  PostgreSQLService,
  TenantManager,
  createPostgreSQLTemplate,
  createEnvironmentTemplate,
  RedisService,
  RedisTenantManager,
  createRedisTemplate,
  createEnvironmentRedisTemplate,
  templateRegistry,
  ENVIRONMENT_PRESETS,
  REDIS_ENVIRONMENT_PRESETS,
  TemplateRegistryService
} from '../templates';
import redisRoutes from './templates/redis';
import { logger } from '../utils/logger';
import { ApiResponse } from '../types';

const router = express.Router();

// Apply security middleware
router.use(securityHeaders);
router.use(rateLimiter);

// Initialize services
const postgresqlService = new PostgreSQLService();
const tenantManager = new TenantManager(postgresqlService);
const redisService = new RedisService();
const redisTenantManager = new RedisTenantManager(redisService);

/**
 * GET /api/templates
 * List all available database templates
 */
router.get('/',
  authenticateToken,
  rbacMiddleware(['templates:read']),
  [
    query('category').optional().isString(),
    query('type').optional().isIn(['database', 'application', 'service']),
    query('search').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('page').optional().isInt({ min: 1 }).toInt()
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { category, type, search, limit = 20, page = 1 } = req.query;
      
      let templates = templateRegistry.getTemplates();
      
      // Filter by category
      if (category) {
        templates = templates.filter(t => t.category === category);
      }
      
      // Filter by type
      if (type) {
        templates = templates.filter(t => t.type === type);
      }
      
      // Search functionality
      if (search) {
        templates = templateRegistry.searchTemplates(search as string);
      }
      
      // Pagination
      const startIndex = (Number(page) - 1) * Number(limit);
      const endIndex = startIndex + Number(limit);
      const paginatedTemplates = templates.slice(startIndex, endIndex);
      
      const response: ApiResponse = {
        success: true,
        data: {
          templates: paginatedTemplates,
          pagination: {
            current_page: Number(page),
            total_pages: Math.ceil(templates.length / Number(limit)),
            total_items: templates.length,
            items_per_page: Number(limit)
          },
          categories: Object.values(templateRegistry.getTemplatesByCategory()).map(category => ({
            name: category[0]?.category || 'Unknown',
            count: category.length
          }))
        },
        message: 'Templates retrieved successfully',
        timestamp: new Date()
      };
      
      res.json(response);
    } catch (error) {
      logger.error('Failed to list templates:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve templates',
        timestamp: new Date()
      });
    }
  }
);

/**
 * GET /api/templates/:templateId
 * Get specific template details
 */
router.get('/:templateId',
  authenticateToken,
  rbacMiddleware(['templates:read']),
  [
    param('templateId').isString().notEmpty()
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { templateId } = req.params;
      const template = templateRegistry.getTemplate(templateId);
      
      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Template not found',
          timestamp: new Date()
        });
      }
      
      // Add environment presets for templates
      let environmentPresets = {};
      if (templateId === 'postgresql-advanced') {
        environmentPresets = ENVIRONMENT_PRESETS;
      } else if (templateId === 'redis-advanced') {
        environmentPresets = REDIS_ENVIRONMENT_PRESETS;
      }
      
      const response: ApiResponse = {
        success: true,
        data: {
          template,
          environment_presets: environmentPresets
        },
        message: 'Template retrieved successfully',
        timestamp: new Date()
      };
      
      res.json(response);
    } catch (error) {
      logger.error('Failed to get template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve template',
        timestamp: new Date()
      });
    }
  }
);

/**
 * POST /api/templates/postgresql/deploy
 * Deploy PostgreSQL template
 */
router.post('/postgresql/deploy',
  authenticateToken,
  rbacMiddleware(['templates:deploy']),
  [
    body('name').isString().notEmpty().matches(/^[a-zA-Z0-9-_]+$/),
    body('environment').isIn(['development', 'staging', 'production']),
    body('version').optional().isIn(['12', '13', '14', '15', '16']),
    body('instance_type').optional().isIn(['micro', 'small', 'medium', 'large', 'xlarge']),
    body('storage_gb').optional().isInt({ min: 20, max: 65536 }),
    body('tenant_isolation').optional().isIn(['schema', 'database', 'row']),
    body('max_tenants').optional().isInt({ min: 1, max: 10000 }),
    body('features').optional().isObject(),
    body('security').optional().isObject(),
    body('scaling').optional().isObject()
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const config = req.body;
      
      logger.info(`Deploying PostgreSQL template: ${config.name}`, {
        user: req.user?.userId,
        environment: config.environment
      });
      
      // Create template instance
      const template = createEnvironmentTemplate(
        config.environment,
        config.name,
        {
          ...config,
          created_at: new Date()
        }
      );
      
      // Validate template configuration
      const validation = template.validate();
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Template validation failed',
          details: validation.errors,
          timestamp: new Date()
        });
      }
      
      // Deploy template
      const deploymentResult = await postgresqlService.deployTemplate(template);
      
      if (deploymentResult.status === 'failed') {
        return res.status(500).json({
          success: false,
          error: 'Deployment failed',
          details: deploymentResult.error_message,
          timestamp: new Date()
        });
      }
      
      const response: ApiResponse = {
        success: true,
        data: {
          deployment: deploymentResult,
          template_summary: template.getDeploymentSummary(),
          connection_info: {
            connection_string: deploymentResult.connection_string,
            admin_panel_url: deploymentResult.admin_panel_url,
            metrics_endpoint: deploymentResult.metrics_endpoint
          }
        },
        message: 'PostgreSQL template deployed successfully',
        timestamp: new Date()
      };
      
      res.status(201).json(response);
    } catch (error) {
      logger.error('Failed to deploy PostgreSQL template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to deploy template',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      });
    }
  }
);

/**
 * GET /api/templates/postgresql/deployments
 * List all PostgreSQL deployments
 */
router.get('/postgresql/deployments',
  authenticateToken,
  rbacMiddleware(['templates:read']),
  async (req: Request, res: Response) => {
    try {
      const deployments = postgresqlService.getDeployments();
      
      const response: ApiResponse = {
        success: true,
        data: {
          deployments,
          total: deployments.length
        },
        message: 'Deployments retrieved successfully',
        timestamp: new Date()
      };
      
      res.json(response);
    } catch (error) {
      logger.error('Failed to list PostgreSQL deployments:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve deployments',
        timestamp: new Date()
      });
    }
  }
);

/**
 * GET /api/templates/postgresql/deployments/:instanceId
 * Get specific PostgreSQL deployment details
 */
router.get('/postgresql/deployments/:instanceId',
  authenticateToken,
  rbacMiddleware(['templates:read']),
  [
    param('instanceId').isString().notEmpty()
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { instanceId } = req.params;
      
      const deployment = postgresqlService.getDeployment(instanceId);
      if (!deployment) {
        return res.status(404).json({
          success: false,
          error: 'Deployment not found',
          timestamp: new Date()
        });
      }
      
      // Get current status and metrics
      const [status, metrics] = await Promise.all([
        postgresqlService.getInstanceStatus(instanceId),
        postgresqlService.getInstanceMetrics(instanceId)
      ]);
      
      const response: ApiResponse = {
        success: true,
        data: {
          deployment,
          status,
          metrics,
          uptime: Date.now() - new Date(deployment.created_at || 0).getTime()
        },
        message: 'Deployment details retrieved successfully',
        timestamp: new Date()
      };
      
      res.json(response);
    } catch (error) {
      logger.error('Failed to get PostgreSQL deployment:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve deployment details',
        timestamp: new Date()
      });
    }
  }
);

/**
 * POST /api/templates/postgresql/deployments/:instanceId/tenants
 * Create a new tenant in PostgreSQL deployment
 */
router.post('/postgresql/deployments/:instanceId/tenants',
  authenticateToken,
  rbacMiddleware(['templates:manage']),
  [
    param('instanceId').isString().notEmpty(),
    body('tenant_id').isString().notEmpty().matches(/^[a-zA-Z0-9-_]+$/),
    body('max_connections').optional().isInt({ min: 1, max: 1000 }),
    body('storage_quota_mb').optional().isInt({ min: 100, max: 100000 }),
    body('cpu_quota_percent').optional().isInt({ min: 1, max: 100 }),
    body('custom_policies').optional().isArray()
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { instanceId } = req.params;
      const { tenant_id, max_connections, storage_quota_mb, cpu_quota_percent, custom_policies } = req.body;
      
      logger.info(`Creating tenant ${tenant_id} in instance ${instanceId}`, {
        user: req.user?.userId
      });
      
      const tenant = await tenantManager.createTenant(instanceId, tenant_id, {
        maxConnections: max_connections,
        storageQuotaMB: storage_quota_mb,
        cpuQuotaPercent: cpu_quota_percent,
        customPolicies: custom_policies
      });
      
      const response: ApiResponse = {
        success: true,
        data: {
          tenant,
          connection_info: {
            schema_name: tenant.schema_name,
            database_name: tenant.database_name
          }
        },
        message: 'Tenant created successfully',
        timestamp: new Date()
      };
      
      res.status(201).json(response);
    } catch (error) {
      logger.error('Failed to create tenant:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create tenant',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      });
    }
  }
);

/**
 * DELETE /api/templates/postgresql/deployments/:instanceId/tenants/:tenantId
 * Remove tenant from PostgreSQL deployment
 */
router.delete('/postgresql/deployments/:instanceId/tenants/:tenantId',
  authenticateToken,
  rbacMiddleware(['templates:manage']),
  [
    param('instanceId').isString().notEmpty(),
    param('tenantId').isString().notEmpty()
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { instanceId, tenantId } = req.params;
      
      logger.info(`Removing tenant ${tenantId} from instance ${instanceId}`, {
        user: req.user?.userId
      });
      
      const removed = await tenantManager.removeTenant(instanceId, tenantId);
      
      if (!removed) {
        return res.status(404).json({
          success: false,
          error: 'Tenant not found',
          timestamp: new Date()
        });
      }
      
      const response: ApiResponse = {
        success: true,
        message: 'Tenant removed successfully',
        timestamp: new Date()
      };
      
      res.json(response);
    } catch (error) {
      logger.error('Failed to remove tenant:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to remove tenant',
        timestamp: new Date()
      });
    }
  }
);

/**
 * GET /api/templates/postgresql/deployments/:instanceId/tenants/:tenantId/stats
 * Get tenant usage statistics
 */
router.get('/postgresql/deployments/:instanceId/tenants/:tenantId/stats',
  authenticateToken,
  rbacMiddleware(['templates:read']),
  [
    param('instanceId').isString().notEmpty(),
    param('tenantId').isString().notEmpty()
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { instanceId, tenantId } = req.params;
      
      const stats = await tenantManager.getTenantStats(instanceId, tenantId);
      
      const response: ApiResponse = {
        success: true,
        data: {
          stats,
          collected_at: new Date()
        },
        message: 'Tenant statistics retrieved successfully',
        timestamp: new Date()
      };
      
      res.json(response);
    } catch (error) {
      logger.error('Failed to get tenant statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve tenant statistics',
        timestamp: new Date()
      });
    }
  }
);

/**
 * POST /api/templates/postgresql/deployments/:instanceId/backup
 * Create backup of PostgreSQL instance
 */
router.post('/postgresql/deployments/:instanceId/backup',
  authenticateToken,
  rbacMiddleware(['templates:manage']),
  [
    param('instanceId').isString().notEmpty()
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { instanceId } = req.params;
      
      logger.info(`Creating backup for instance ${instanceId}`, {
        user: req.user?.userId
      });
      
      const backup = await postgresqlService.createBackup(instanceId);
      
      const response: ApiResponse = {
        success: true,
        data: {
          backup,
          estimated_completion: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes estimate
        },
        message: 'Backup initiated successfully',
        timestamp: new Date()
      };
      
      res.status(201).json(response);
    } catch (error) {
      logger.error('Failed to create backup:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create backup',
        timestamp: new Date()
      });
    }
  }
);

/**
 * POST /api/templates/postgresql/deployments/:instanceId/restore
 * Restore PostgreSQL instance from backup
 */
router.post('/postgresql/deployments/:instanceId/restore',
  authenticateToken,
  rbacMiddleware(['templates:manage']),
  [
    param('instanceId').isString().notEmpty(),
    body('backup_id').isString().notEmpty()
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { instanceId } = req.params;
      const { backup_id } = req.body;
      
      logger.info(`Restoring instance ${instanceId} from backup ${backup_id}`, {
        user: req.user?.userId
      });
      
      await postgresqlService.restoreBackup(instanceId, backup_id);
      
      const response: ApiResponse = {
        success: true,
        message: 'Restore initiated successfully',
        timestamp: new Date()
      };
      
      res.json(response);
    } catch (error) {
      logger.error('Failed to restore backup:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to restore backup',
        timestamp: new Date()
      });
    }
  }
);

/**
 * POST /api/templates/postgresql/deployments/:instanceId/scale
 * Scale PostgreSQL instance
 */
router.post('/postgresql/deployments/:instanceId/scale',
  authenticateToken,
  rbacMiddleware(['templates:manage']),
  [
    param('instanceId').isString().notEmpty(),
    body('instance_class').optional().isString(),
    body('storage_gb').optional().isInt({ min: 20, max: 65536 }),
    body('read_replicas').optional().isInt({ min: 0, max: 15 }),
    body('auto_scaling').optional().isObject()
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { instanceId } = req.params;
      const scalingConfig = req.body;
      
      logger.info(`Scaling instance ${instanceId}`, {
        user: req.user?.userId,
        config: scalingConfig
      });
      
      await postgresqlService.scaleInstance(instanceId, scalingConfig);
      
      const response: ApiResponse = {
        success: true,
        message: 'Scaling initiated successfully',
        timestamp: new Date()
      };
      
      res.json(response);
    } catch (error) {
      logger.error('Failed to scale instance:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to scale instance',
        timestamp: new Date()
      });
    }
  }
);

/**
 * DELETE /api/templates/postgresql/deployments/:instanceId
 * Destroy PostgreSQL deployment
 */
router.delete('/postgresql/deployments/:instanceId',
  authenticateToken,
  rbacMiddleware(['templates:destroy']),
  [
    param('instanceId').isString().notEmpty(),
    body('confirm').equals('DELETE').withMessage('Must provide confirmation')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { instanceId } = req.params;
      
      logger.info(`Destroying PostgreSQL instance: ${instanceId}`, {
        user: req.user?.userId
      });
      
      await postgresqlService.destroyInstance(instanceId);
      
      const response: ApiResponse = {
        success: true,
        message: 'PostgreSQL instance destroyed successfully',
        timestamp: new Date()
      };
      
      res.json(response);
    } catch (error) {
      logger.error('Failed to destroy PostgreSQL instance:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to destroy instance',
        timestamp: new Date()
      });
    }
  }
);

// Redis template routes
router.use('/redis', redisRoutes);

/**
 * GET /api/templates/popular
 * Get popular templates (for dashboard/recommendations)
 */
router.get('/popular',
  authenticateToken,
  rbacMiddleware(['templates:read']),
  [
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt()
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { limit = 10 } = req.query;
      
      const popularTemplates = templateRegistry.getPopularTemplates(Number(limit));
      
      const response: ApiResponse = {
        success: true,
        data: {
          templates: popularTemplates,
          total: popularTemplates.length
        },
        message: 'Popular templates retrieved successfully',
        timestamp: new Date()
      };
      
      res.json(response);
    } catch (error) {
      logger.error('Failed to get popular templates:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve popular templates',
        timestamp: new Date()
      });
    }
  }
);

// Error handling middleware
router.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Template route error:', error);
  
  res.status(500).json({
    success: false,
    error: 'Internal server error in template management',
    timestamp: new Date()
  });
});

export default router;