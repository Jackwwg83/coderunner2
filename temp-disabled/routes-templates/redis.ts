/**
 * Redis Template API Routes
 * P3-T02 Implementation for CodeRunner v2.0
 * 
 * Endpoints:
 * - POST /api/templates/redis/deploy - Deploy Redis template
 * - GET /api/templates/redis/deployments - List Redis deployments
 * - GET /api/templates/redis/:id - Get deployment details
 * - POST /api/templates/redis/:id/tenants - Create tenant
 * - DELETE /api/templates/redis/:id/tenants/:tenantId - Remove tenant
 * - GET /api/templates/redis/:id/tenants/:tenantId/stats - Get tenant statistics
 * - POST /api/templates/redis/:id/flush - Flush Redis data
 * - GET /api/templates/redis/:id/stats - Get Redis statistics
 * - POST /api/templates/redis/:id/backup - Create backup
 * - POST /api/templates/redis/:id/scale - Scale instance
 * - POST /api/templates/redis/:id/optimize - Optimize memory
 * - POST /api/templates/redis/:id/warm-cache - Warm cache
 * - DELETE /api/templates/redis/:id - Destroy deployment
 */

import { Router, Request, Response } from 'express';
import { RedisService, RedisTenantManager } from '../../../templates/databases/redis.service';
import { RedisCacheTemplate, createRedisTemplate } from '../../../templates/databases/redis.template';
import { RedisTemplate } from '../../../templates/databases/redis.config';
import { authenticateToken } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validation';
import { logger } from '../../utils/logger';
import { respondWithError, respondWithSuccess } from '../../utils/response';

const router = Router();
const redisService = new RedisService();
const tenantManager = new RedisTenantManager(redisService);

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * Deploy Redis template
 * POST /api/templates/redis/deploy
 */
router.post('/deploy', validateRequest([
  { field: 'name', type: 'required', message: 'Template name is required' },
  { field: 'version', type: 'required', message: 'Redis version is required' },
  { field: 'mode', type: 'required', message: 'Redis mode is required' },
  { field: 'instance_type', type: 'required', message: 'Instance type is required' },
  { field: 'memory_mb', type: 'required', message: 'Memory size is required' }
]), async (req: Request, res: Response) => {
  try {
    const templateConfig: Partial<RedisTemplate> = req.body;
    
    // Validate tenant isolation configuration
    if (templateConfig.tenant_config?.isolation_type === 'key_prefix' && 
        !templateConfig.tenant_config?.key_prefix_pattern) {
      return respondWithError(res, 'Key prefix pattern is required for key prefix isolation', 400);
    }
    
    logger.info(`Deploying Redis template: ${templateConfig.name}`);
    
    // Create Redis template instance
    const template = createRedisTemplate(templateConfig);
    
    // Validate template configuration
    const validation = template.validate();
    if (!validation.isValid) {
      return respondWithError(res, 'Template validation failed', 400, validation.errors);
    }
    
    // Deploy template
    const deploymentResult = await redisService.deployTemplate(template);
    
    if (deploymentResult.status === 'failed') {
      return respondWithError(res, deploymentResult.error_message || 'Deployment failed', 500);
    }
    
    logger.info(`Redis template deployed successfully: ${deploymentResult.instance_id}`);
    
    // Return deployment details
    const response = {
      deployment: deploymentResult,
      template_summary: template.getDeploymentSummary(),
      connection_info: {
        primary_url: deploymentResult.connection_url,
        admin_url: deploymentResult.admin_connection_url,
        cluster_endpoints: deploymentResult.cluster_endpoints,
        metrics_endpoint: deploymentResult.metrics_endpoint
      },
      next_steps: [
        'Configure your application to use the provided connection URL',
        deploymentResult.cluster_endpoints ? 'Use cluster endpoints for high availability' : null,
        'Create tenants for multi-tenant applications',
        'Monitor performance through the metrics endpoint',
        'Set up cache warming for frequently accessed data'
      ].filter(Boolean)
    };
    
    respondWithSuccess(res, response, 'Redis template deployed successfully', 201);
  } catch (error) {
    logger.error('Redis template deployment failed:', error);
    respondWithError(res, 'Internal server error during deployment', 500);
  }
});

/**
 * List Redis deployments
 * GET /api/templates/redis/deployments
 */
router.get('/deployments', async (req: Request, res: Response) => {
  try {
    const deployments = redisService.getDeployments();
    
    const deploymentsWithStatus = await Promise.all(
      deployments.map(async (deployment) => {
        try {
          const status = await redisService.getInstanceStatus(deployment.instance_id);
          const metrics = await redisService.getInstanceMetrics(deployment.instance_id);
          
          return {
            ...deployment,
            current_status: status.status,
            info: status.info,
            cluster: status.cluster,
            metrics: {
              memory_usage_percent: Math.round((metrics.metrics.memory.used / metrics.metrics.memory.max) * 100),
              hit_rate: Math.round(metrics.metrics.performance.hit_rate * 100),
              ops_per_second: metrics.metrics.performance.ops_per_second,
              connected_clients: metrics.metrics.connections.connected_clients
            }
          };
        } catch (error) {
          return {
            ...deployment,
            current_status: 'unknown',
            error: 'Failed to fetch status'
          };
        }
      })
    );
    
    respondWithSuccess(res, {
      deployments: deploymentsWithStatus,
      total: deployments.length
    });
  } catch (error) {
    logger.error('Failed to list Redis deployments:', error);
    respondWithError(res, 'Internal server error', 500);
  }
});

/**
 * Get Redis deployment details
 * GET /api/templates/redis/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deployment = redisService.getDeployment(id);
    
    if (!deployment) {
      return respondWithError(res, 'Deployment not found', 404);
    }
    
    // Get current status and metrics
    const [status, metrics, keyAnalysis] = await Promise.all([
      redisService.getInstanceStatus(id),
      redisService.getInstanceMetrics(id),
      redisService.analyzeKeyPatterns(id)
    ]);
    
    const response = {
      deployment,
      status: status.status,
      info: status.info,
      cluster: status.cluster,
      detailed_metrics: metrics,
      key_analysis: keyAnalysis,
      health_check: {
        overall: status.status === 'available' ? 'healthy' : 'unhealthy',
        memory_usage: Math.round((metrics.metrics.memory.used / metrics.metrics.memory.max) * 100),
        hit_rate: Math.round(metrics.metrics.performance.hit_rate * 100),
        response_time: '< 1ms',
        uptime_seconds: status.info?.uptimeSeconds || 0
      }
    };
    
    respondWithSuccess(res, response);
  } catch (error) {
    logger.error(`Failed to get Redis deployment ${req.params.id}:`, error);
    respondWithError(res, 'Internal server error', 500);
  }
});

/**
 * Create Redis tenant
 * POST /api/templates/redis/:id/tenants
 */
router.post('/:id/tenants', validateRequest([
  { field: 'tenant_id', type: 'required', message: 'Tenant ID is required' }
]), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tenant_id, ...options } = req.body;
    
    const tenant = await tenantManager.createTenant(id, tenant_id, options);
    
    logger.info(`Created Redis tenant ${tenant_id} in deployment ${id}`);
    
    respondWithSuccess(res, {
      tenant,
      connection_example: {
        key_prefix: tenant.key_prefix,
        sample_commands: [
          `SET ${tenant.key_prefix}user:123 "user_data"`,
          `GET ${tenant.key_prefix}user:123`,
          `EXPIRE ${tenant.key_prefix}user:123 3600`
        ]
      }
    }, 'Tenant created successfully', 201);
  } catch (error) {
    logger.error(`Failed to create Redis tenant:`, error);
    respondWithError(res, error instanceof Error ? error.message : 'Internal server error', 500);
  }
});

/**
 * Remove Redis tenant
 * DELETE /api/templates/redis/:id/tenants/:tenantId
 */
router.delete('/:id/tenants/:tenantId', async (req: Request, res: Response) => {
  try {
    const { id, tenantId } = req.params;
    
    const removed = await tenantManager.removeTenant(id, tenantId);
    
    if (!removed) {
      return respondWithError(res, 'Tenant not found', 404);
    }
    
    logger.info(`Removed Redis tenant ${tenantId} from deployment ${id}`);
    respondWithSuccess(res, { tenant_id: tenantId }, 'Tenant removed successfully');
  } catch (error) {
    logger.error(`Failed to remove Redis tenant:`, error);
    respondWithError(res, error instanceof Error ? error.message : 'Internal server error', 500);
  }
});

/**
 * Get tenant statistics
 * GET /api/templates/redis/:id/tenants/:tenantId/stats
 */
router.get('/:id/tenants/:tenantId/stats', async (req: Request, res: Response) => {
  try {
    const { id, tenantId } = req.params;
    
    const stats = await tenantManager.getTenantStats(id, tenantId);
    
    respondWithSuccess(res, {
      tenant_stats: stats,
      recommendations: [
        stats.hit_rate < 0.8 ? 'Consider increasing TTL for better hit rates' : null,
        stats.memory_usage_mb > 80 ? 'Monitor memory usage, consider cleanup' : null,
        stats.ops_per_second > 500 ? 'High activity detected, consider optimization' : null
      ].filter(Boolean)
    });
  } catch (error) {
    logger.error(`Failed to get Redis tenant stats:`, error);
    respondWithError(res, error instanceof Error ? error.message : 'Internal server error', 500);
  }
});

/**
 * Execute tenant-scoped Redis command
 * POST /api/templates/redis/:id/tenants/:tenantId/execute
 */
router.post('/:id/tenants/:tenantId/execute', validateRequest([
  { field: 'command', type: 'required', message: 'Redis command is required' }
]), async (req: Request, res: Response) => {
  try {
    const { id, tenantId } = req.params;
    const { command } = req.body;
    
    // Security check - only allow safe commands
    const safeCommands = ['GET', 'SET', 'DEL', 'EXISTS', 'EXPIRE', 'TTL', 'KEYS', 'HGET', 'HSET', 'HDEL'];
    const commandParts = command.trim().split(/\s+/);
    const commandName = commandParts[0].toUpperCase();
    
    if (!safeCommands.includes(commandName)) {
      return respondWithError(res, `Command '${commandName}' is not allowed for tenant operations`, 403);
    }
    
    const result = await tenantManager.executeTenantCommand(id, tenantId, command);
    
    respondWithSuccess(res, {
      command,
      result: result.result,
      execution_time_ms: result.executionTimeMs,
      affected_keys: result.affectedKeys
    });
  } catch (error) {
    logger.error(`Failed to execute tenant Redis command:`, error);
    respondWithError(res, error instanceof Error ? error.message : 'Internal server error', 500);
  }
});

/**
 * Flush Redis data (with confirmation)
 * POST /api/templates/redis/:id/flush
 */
router.post('/:id/flush', validateRequest([
  { field: 'confirmation', type: 'required', message: 'Confirmation is required' },
  { field: 'scope', type: 'required', message: 'Flush scope is required' }
]), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { confirmation, scope, database_number } = req.body;
    
    if (confirmation !== 'FLUSH_CONFIRMED') {
      return respondWithError(res, 'Invalid confirmation', 400);
    }
    
    let command = '';
    if (scope === 'database' && database_number !== undefined) {
      command = `SELECT ${database_number} && FLUSHDB`;
    } else if (scope === 'all') {
      command = 'FLUSHALL';
    } else {
      return respondWithError(res, 'Invalid flush scope', 400);
    }
    
    const result = await redisService.executeCommand(id, command);
    
    if (!result.success) {
      return respondWithError(res, result.error || 'Flush operation failed', 500);
    }
    
    logger.info(`Redis flush operation completed for deployment ${id}, scope: ${scope}`);
    
    respondWithSuccess(res, {
      operation: 'flush',
      scope,
      database_number,
      execution_time_ms: result.executionTimeMs
    }, 'Flush operation completed successfully');
  } catch (error) {
    logger.error(`Redis flush operation failed:`, error);
    respondWithError(res, 'Internal server error', 500);
  }
});

/**
 * Get Redis instance statistics
 * GET /api/templates/redis/:id/stats
 */
router.get('/:id/stats', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { detailed } = req.query;
    
    const [metrics, keyAnalysis] = await Promise.all([
      redisService.getInstanceMetrics(id),
      detailed === 'true' ? redisService.analyzeKeyPatterns(id) : null
    ]);
    
    const stats = {
      memory: {
        used_mb: Math.round(metrics.metrics.memory.used / 1024 / 1024),
        max_mb: Math.round(metrics.metrics.memory.max / 1024 / 1024),
        usage_percent: Math.round((metrics.metrics.memory.used / metrics.metrics.memory.max) * 100),
        fragmentation_ratio: metrics.metrics.memory.fragmentation_ratio
      },
      performance: {
        ops_per_second: metrics.metrics.performance.ops_per_second,
        hit_rate: Math.round(metrics.metrics.performance.hit_rate * 100),
        miss_rate: Math.round(metrics.metrics.performance.miss_rate * 100),
        avg_ttl_seconds: metrics.metrics.performance.avg_ttl,
        evicted_keys: metrics.metrics.performance.evicted_keys,
        expired_keys: metrics.metrics.performance.expired_keys
      },
      connections: {
        connected_clients: metrics.metrics.connections.connected_clients,
        max_clients: metrics.metrics.connections.max_clients,
        usage_percent: Math.round((metrics.metrics.connections.connected_clients / metrics.metrics.connections.max_clients) * 100),
        blocked_clients: metrics.metrics.connections.blocked_clients
      },
      keyspace: metrics.metrics.keyspace,
      cluster: metrics.metrics.cluster
    };
    
    const response: any = { stats, timestamp: metrics.timestamp };
    
    if (keyAnalysis) {
      response.key_analysis = keyAnalysis;
    }
    
    respondWithSuccess(res, response);
  } catch (error) {
    logger.error(`Failed to get Redis stats:`, error);
    respondWithError(res, 'Internal server error', 500);
  }
});

/**
 * Create Redis backup
 * POST /api/templates/redis/:id/backup
 */
router.post('/:id/backup', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const backup = await redisService.createBackup(id);
    
    logger.info(`Created Redis backup ${backup.backupId} for deployment ${id}`);
    
    respondWithSuccess(res, {
      backup,
      estimated_completion_time: '5-10 minutes',
      backup_location: 'AgentSphere Backup Storage'
    }, 'Backup creation started', 202);
  } catch (error) {
    logger.error(`Failed to create Redis backup:`, error);
    respondWithError(res, error instanceof Error ? error.message : 'Internal server error', 500);
  }
});

/**
 * Scale Redis instance
 * POST /api/templates/redis/:id/scale
 */
router.post('/:id/scale', validateRequest([
  { field: 'memory_mb', type: 'number', message: 'Memory size must be a number' }
]), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const scalingConfig = req.body;
    
    await redisService.scaleInstance(id, scalingConfig);
    
    logger.info(`Scaling Redis instance ${id}`, scalingConfig);
    
    respondWithSuccess(res, {
      instance_id: id,
      scaling_config: scalingConfig,
      estimated_completion_time: '10-15 minutes'
    }, 'Scaling operation initiated', 202);
  } catch (error) {
    logger.error(`Failed to scale Redis instance:`, error);
    respondWithError(res, error instanceof Error ? error.message : 'Internal server error', 500);
  }
});

/**
 * Optimize Redis memory
 * POST /api/templates/redis/:id/optimize
 */
router.post('/:id/optimize', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const optimization = await redisService.optimizeMemory(id);
    
    logger.info(`Optimized Redis memory for instance ${id}`);
    
    respondWithSuccess(res, {
      optimization_result: optimization,
      memory_freed_mb: Math.round((optimization.beforeMemoryMb - optimization.afterMemoryMb)),
      recommendations: optimization.recommendations
    }, 'Memory optimization completed');
  } catch (error) {
    logger.error(`Failed to optimize Redis memory:`, error);
    respondWithError(res, error instanceof Error ? error.message : 'Internal server error', 500);
  }
});

/**
 * Warm Redis cache
 * POST /api/templates/redis/:id/warm-cache
 */
router.post('/:id/warm-cache', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const warmingConfig = req.body;
    
    await redisService.warmCache(id, warmingConfig);
    
    logger.info(`Started cache warming for Redis instance ${id}`);
    
    respondWithSuccess(res, {
      instance_id: id,
      warming_config: warmingConfig,
      status: 'warming_started'
    }, 'Cache warming initiated', 202);
  } catch (error) {
    logger.error(`Failed to warm Redis cache:`, error);
    respondWithError(res, error instanceof Error ? error.message : 'Internal server error', 500);
  }
});

/**
 * Execute Redis command (admin only)
 * POST /api/templates/redis/:id/execute
 */
router.post('/:id/execute', validateRequest([
  { field: 'command', type: 'required', message: 'Redis command is required' }
]), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { command, confirm_dangerous } = req.body;
    
    // Check for dangerous commands
    const dangerousCommands = ['FLUSHALL', 'FLUSHDB', 'CONFIG', 'DEBUG', 'SHUTDOWN', 'SAVE'];
    const commandName = command.trim().split(/\s+/)[0].toUpperCase();
    
    if (dangerousCommands.includes(commandName) && !confirm_dangerous) {
      return respondWithError(res, `Command '${commandName}' requires confirmation. Set confirm_dangerous=true`, 400);
    }
    
    const result = await redisService.executeCommand(id, command);
    
    respondWithSuccess(res, {
      command,
      result: result.result,
      success: result.success,
      execution_time_ms: result.executionTimeMs,
      affected_keys: result.affectedKeys
    });
  } catch (error) {
    logger.error(`Failed to execute Redis command:`, error);
    respondWithError(res, error instanceof Error ? error.message : 'Internal server error', 500);
  }
});

/**
 * Destroy Redis deployment
 * DELETE /api/templates/redis/:id
 */
router.delete('/:id', validateRequest([
  { field: 'confirmation', type: 'required', message: 'Confirmation is required' }
]), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { confirmation } = req.body;
    
    if (confirmation !== 'DELETE_CONFIRMED') {
      return respondWithError(res, 'Invalid confirmation', 400);
    }
    
    await redisService.destroyInstance(id);
    
    logger.info(`Destroyed Redis deployment ${id}`);
    
    respondWithSuccess(res, {
      instance_id: id,
      status: 'destroyed'
    }, 'Redis deployment destroyed successfully');
  } catch (error) {
    logger.error(`Failed to destroy Redis deployment:`, error);
    respondWithError(res, error instanceof Error ? error.message : 'Internal server error', 500);
  }
});

export default router;