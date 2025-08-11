/**
 * Database Orchestrator API Routes
 * P3-T03 Implementation for CodeRunner v2.0
 * 
 * RESTful API endpoints for database orchestration:
 * - Unified deployment interface
 * - Multi-tenant management
 * - Scaling and backup operations
 * - Health monitoring and metrics
 * - System administration
 */

import { Router, Request, Response } from 'express';
import { 
  DatabaseOrchestrator,
  DeployRequest,
  DatabaseType,
  ScalingPolicy,
  BackupPolicy
} from '../services/databaseOrchestrator';
import { DatabaseRegistry } from '../services/databaseRegistry';
import { DatabaseScheduler } from '../services/databaseScheduler';
import { auth } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { logger } from '../utils/logger';
import { body, param, query, validationResult } from 'express-validator';

const router = Router();
const orchestrator = DatabaseOrchestrator.getInstance();
const registry = DatabaseRegistry.getInstance();
const scheduler = DatabaseScheduler.getInstance();

// Apply authentication to all routes
router.use(auth);

/**
 * Validation middleware for deploy request
 */
const validateDeployRequest = [
  body('type').isIn(['postgresql', 'redis']).withMessage('Invalid database type'),
  body('projectId').notEmpty().withMessage('Project ID is required'),
  body('config.name').notEmpty().withMessage('Database name is required'),
  body('config.version').optional().isString(),
  body('config.instanceClass').optional().isString(),
  body('config.allocatedStorage').optional().isInt({ min: 1 }),
  body('environment').optional().isIn(['development', 'staging', 'production']),
  body('tenantId').optional().isString(),
  body('tags').optional().isObject()
];

/**
 * POST /api/orchestrator/deploy
 * Deploy a new database instance
 */
router.post('/deploy', validateDeployRequest, async (req: Request, res: Response) => {
  try {
    // Check validation results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const deployRequest: DeployRequest = {
      type: req.body.type as DatabaseType,
      userId,
      projectId: req.body.projectId,
      config: req.body.config,
      environment: req.body.environment || 'development',
      tenantId: req.body.tenantId,
      tags: req.body.tags
    };

    logger.info(`Deploy request received: ${deployRequest.type} for user ${userId}`);

    const deployment = await orchestrator.deployDatabase(deployRequest);

    res.status(201).json({
      success: true,
      data: {
        deploymentId: deployment.id,
        type: deployment.type,
        status: deployment.status,
        connectionString: deployment.connectionString,
        publicUrl: deployment.publicUrl,
        metadata: deployment.metadata
      }
    });

  } catch (error) {
    logger.error('Deploy request failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * GET /api/orchestrator/deployments
 * List all deployments for the authenticated user
 */
router.get('/deployments', [
  query('type').optional().isIn(['postgresql', 'redis']),
  query('status').optional().isString(),
  query('environment').optional().isIn(['development', 'staging', 'production']),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 })
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const filter: any = { userId };
    
    if (req.query.type) filter.type = req.query.type;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.environment) filter.environment = req.query.environment;

    const deployments = registry.discover(filter);
    
    // Apply pagination
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const paginatedDeployments = deployments.slice(offset, offset + limit);

    res.json({
      success: true,
      data: {
        deployments: paginatedDeployments.map(d => ({
          id: d.id,
          type: d.type,
          status: d.status,
          config: { name: d.config.name, version: d.metadata.version },
          environment: d.metadata.environment,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
          publicUrl: d.publicUrl
        })),
        pagination: {
          limit,
          offset,
          total: deployments.length,
          hasMore: offset + limit < deployments.length
        }
      }
    });

  } catch (error) {
    logger.error('Failed to list deployments:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/orchestrator/deployments/:id
 * Get detailed information about a specific deployment
 */
router.get('/deployments/:id', [
  param('id').notEmpty().withMessage('Deployment ID is required')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const userId = req.user?.userId;
    const deploymentId = req.params.id;

    const deployment = registry.get(deploymentId);
    
    if (!deployment) {
      return res.status(404).json({
        success: false,
        error: 'Deployment not found'
      });
    }

    // Check ownership
    if (deployment.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Get health status
    const healthStatus = await orchestrator.healthCheck(deploymentId);
    
    // Get metrics
    let metrics = null;
    try {
      metrics = await orchestrator.getMetrics(deploymentId);
    } catch (error) {
      logger.warn(`Failed to get metrics for deployment ${deploymentId}:`, error);
    }

    // Get scheduled tasks
    const scheduledTasks = scheduler.getScheduledTasks(deploymentId);

    res.json({
      success: true,
      data: {
        deployment,
        health: healthStatus,
        metrics,
        scheduledTasks: scheduledTasks.map(t => ({
          id: t.id,
          type: t.type,
          nextRun: t.nextRun,
          status: t.status
        }))
      }
    });

  } catch (error) {
    logger.error('Failed to get deployment details:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/orchestrator/:id/scale
 * Scale a database deployment
 */
router.post('/:id/scale', [
  param('id').notEmpty().withMessage('Deployment ID is required'),
  body('replicas').isInt({ min: 1, max: 10 }).withMessage('Replicas must be between 1 and 10')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const userId = req.user?.userId;
    const deploymentId = req.params.id;
    const replicas = req.body.replicas;

    const deployment = registry.get(deploymentId);
    
    if (!deployment) {
      return res.status(404).json({
        success: false,
        error: 'Deployment not found'
      });
    }

    // Check ownership
    if (deployment.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    logger.info(`Scaling request: ${deploymentId} to ${replicas} replicas`);

    await orchestrator.scaleDatabase(deploymentId, replicas);

    res.json({
      success: true,
      message: `Deployment scaled to ${replicas} replicas`
    });

  } catch (error) {
    logger.error('Scaling request failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * POST /api/orchestrator/:id/backup
 * Create a backup of a database deployment
 */
router.post('/:id/backup', [
  param('id').notEmpty().withMessage('Deployment ID is required'),
  body('type').optional().isIn(['manual', 'scheduled']),
  body('compression').optional().isBoolean(),
  body('encryption').optional().isBoolean()
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const userId = req.user?.userId;
    const deploymentId = req.params.id;

    const deployment = registry.get(deploymentId);
    
    if (!deployment) {
      return res.status(404).json({
        success: false,
        error: 'Deployment not found'
      });
    }

    // Check ownership
    if (deployment.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    logger.info(`Backup request: ${deploymentId}`);

    const backupInfo = await orchestrator.backupDatabase(deploymentId);

    res.json({
      success: true,
      data: {
        backupId: backupInfo.id,
        size: backupInfo.size,
        createdAt: backupInfo.createdAt,
        type: backupInfo.type
      }
    });

  } catch (error) {
    logger.error('Backup request failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * POST /api/orchestrator/:id/restore
 * Restore a database from backup
 */
router.post('/:id/restore', [
  param('id').notEmpty().withMessage('Deployment ID is required'),
  body('backupId').notEmpty().withMessage('Backup ID is required')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const userId = req.user?.userId;
    const deploymentId = req.params.id;
    const backupId = req.body.backupId;

    const deployment = registry.get(deploymentId);
    
    if (!deployment) {
      return res.status(404).json({
        success: false,
        error: 'Deployment not found'
      });
    }

    // Check ownership
    if (deployment.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    logger.info(`Restore request: ${deploymentId} from backup ${backupId}`);

    await orchestrator.restoreDatabase(deploymentId, backupId);

    res.json({
      success: true,
      message: 'Database restored successfully'
    });

  } catch (error) {
    logger.error('Restore request failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * DELETE /api/orchestrator/:id
 * Destroy a database deployment
 */
router.delete('/:id', [
  param('id').notEmpty().withMessage('Deployment ID is required')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const userId = req.user?.userId;
    const deploymentId = req.params.id;

    const deployment = registry.get(deploymentId);
    
    if (!deployment) {
      return res.status(404).json({
        success: false,
        error: 'Deployment not found'
      });
    }

    // Check ownership
    if (deployment.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    logger.info(`Destroy request: ${deploymentId}`);

    await orchestrator.destroyDatabase(deploymentId);

    res.json({
      success: true,
      message: 'Deployment destroyed successfully'
    });

  } catch (error) {
    logger.error('Destroy request failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * POST /api/orchestrator/:id/tenants
 * Create a new tenant
 */
router.post('/:id/tenants', [
  param('id').notEmpty().withMessage('Deployment ID is required'),
  body('tenantId').notEmpty().withMessage('Tenant ID is required')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const userId = req.user?.userId;
    const deploymentId = req.params.id;
    const tenantId = req.body.tenantId;

    const deployment = registry.get(deploymentId);
    
    if (!deployment) {
      return res.status(404).json({
        success: false,
        error: 'Deployment not found'
      });
    }

    // Check ownership
    if (deployment.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    logger.info(`Create tenant request: ${tenantId} for deployment ${deploymentId}`);

    await orchestrator.createTenant(deploymentId, tenantId);

    // Get tenant-specific connection string
    const connectionString = registry.getConnectionString(deploymentId, tenantId);

    res.status(201).json({
      success: true,
      data: {
        tenantId,
        connectionString
      }
    });

  } catch (error) {
    logger.error('Create tenant request failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * DELETE /api/orchestrator/:id/tenants/:tenantId
 * Remove a tenant
 */
router.delete('/:id/tenants/:tenantId', [
  param('id').notEmpty().withMessage('Deployment ID is required'),
  param('tenantId').notEmpty().withMessage('Tenant ID is required')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const userId = req.user?.userId;
    const deploymentId = req.params.id;
    const tenantId = req.params.tenantId;

    const deployment = registry.get(deploymentId);
    
    if (!deployment) {
      return res.status(404).json({
        success: false,
        error: 'Deployment not found'
      });
    }

    // Check ownership
    if (deployment.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    logger.info(`Remove tenant request: ${tenantId} from deployment ${deploymentId}`);

    await orchestrator.removeTenant(deploymentId, tenantId);

    res.json({
      success: true,
      message: 'Tenant removed successfully'
    });

  } catch (error) {
    logger.error('Remove tenant request failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * GET /api/orchestrator/health
 * Get system health status
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const systemHealth = await orchestrator.getSystemHealth();
    const registryStats = registry.getStats();
    const schedulerStats = scheduler.getStats();

    res.json({
      success: true,
      data: {
        system: systemHealth,
        registry: registryStats,
        scheduler: schedulerStats,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/orchestrator/:id/auto-scale
 * Configure auto-scaling for a deployment
 */
router.post('/:id/auto-scale', [
  param('id').notEmpty().withMessage('Deployment ID is required'),
  body('enabled').isBoolean().withMessage('Enabled flag is required'),
  body('minReplicas').optional().isInt({ min: 1 }),
  body('maxReplicas').optional().isInt({ min: 1 }),
  body('targetCPU').optional().isInt({ min: 1, max: 100 }),
  body('targetMemory').optional().isInt({ min: 1, max: 100 })
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const userId = req.user?.userId;
    const deploymentId = req.params.id;

    const deployment = registry.get(deploymentId);
    
    if (!deployment) {
      return res.status(404).json({
        success: false,
        error: 'Deployment not found'
      });
    }

    // Check ownership
    if (deployment.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const scalingPolicy: ScalingPolicy = {
      enabled: req.body.enabled,
      minReplicas: req.body.minReplicas || 1,
      maxReplicas: req.body.maxReplicas || 5,
      targetCPU: req.body.targetCPU || 70,
      targetMemory: req.body.targetMemory || 80,
      scaleUpCooldown: 5,
      scaleDownCooldown: 10
    };

    logger.info(`Auto-scale configuration: ${deploymentId}`, scalingPolicy);

    await orchestrator.autoScale(deploymentId, scalingPolicy);

    res.json({
      success: true,
      message: 'Auto-scaling configured successfully',
      data: scalingPolicy
    });

  } catch (error) {
    logger.error('Auto-scale configuration failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * POST /api/orchestrator/:id/auto-backup
 * Configure auto-backup for a deployment
 */
router.post('/:id/auto-backup', [
  param('id').notEmpty().withMessage('Deployment ID is required'),
  body('enabled').isBoolean().withMessage('Enabled flag is required'),
  body('frequency').optional().isString(),
  body('retention').optional().isInt({ min: 1 }),
  body('type').optional().isIn(['full', 'incremental']),
  body('compression').optional().isBoolean(),
  body('encryption').optional().isBoolean()
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const userId = req.user?.userId;
    const deploymentId = req.params.id;

    const deployment = registry.get(deploymentId);
    
    if (!deployment) {
      return res.status(404).json({
        success: false,
        error: 'Deployment not found'
      });
    }

    // Check ownership
    if (deployment.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const backupPolicy: BackupPolicy = {
      enabled: req.body.enabled,
      frequency: req.body.frequency || '0 2 * * *', // Daily at 2 AM
      retention: req.body.retention || 30, // 30 days
      type: req.body.type || 'full',
      compression: req.body.compression !== false,
      encryption: req.body.encryption !== false
    };

    logger.info(`Auto-backup configuration: ${deploymentId}`, backupPolicy);

    await orchestrator.autoBackup(deploymentId, backupPolicy);

    res.json({
      success: true,
      message: 'Auto-backup configured successfully',
      data: backupPolicy
    });

  } catch (error) {
    logger.error('Auto-backup configuration failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * GET /api/orchestrator/:id/metrics
 * Get real-time metrics for a deployment
 */
router.get('/:id/metrics', [
  param('id').notEmpty().withMessage('Deployment ID is required')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const userId = req.user?.userId;
    const deploymentId = req.params.id;

    const deployment = registry.get(deploymentId);
    
    if (!deployment) {
      return res.status(404).json({
        success: false,
        error: 'Deployment not found'
      });
    }

    // Check ownership
    if (deployment.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const metrics = await orchestrator.getMetrics(deploymentId);
    const healthStatus = await orchestrator.healthCheck(deploymentId);

    res.json({
      success: true,
      data: {
        metrics,
        health: healthStatus,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Failed to get metrics:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

export default router;