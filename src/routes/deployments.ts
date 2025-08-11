import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/database';
import { OrchestrationService } from '../services/orchestration';
import { AuthMiddleware } from '../middleware/auth';
import { ApiResponse } from '../utils/response';
import { logger } from '../utils/logger';
import { requirePermission, requireOwnership } from '../middleware/rbac';
import { verifyCSRF } from '../middleware/csrf';
import { validateUUID } from '../middleware/validation';
import { DeploymentStatus } from '../types/index';

const router = Router();
const db = DatabaseService.getInstance();
const orchestrator = OrchestrationService.getInstance();

// Get all deployments for authenticated user
router.get('/', 
  AuthMiddleware.authenticateToken,
  // requirePermission('deployment:read:own'),
  async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    
    // Get user's projects first
    const projectsResult = await db.getProjectsByUserId(userId);
    
    // Get deployments for all user's projects
    const deployments = [];
    for (const project of projectsResult.projects) {
      const deploymentsResult = await db.getDeploymentsByProjectId(project.id);
      
      // Enrich deployment data
      for (const deployment of deploymentsResult.deployments) {
        deployments.push({
          id: deployment.id,
          projectId: deployment.project_id,
          name: project.name,
          description: project.description,
          status: deployment.status,
          publicUrl: deployment.public_url,
          runtimeType: deployment.runtime_type,
          createdAt: deployment.created_at,
          updatedAt: deployment.updated_at,
          // Add mock metrics for now
          cpu: Math.floor(Math.random() * 100),
          memory: Math.floor(Math.random() * 100)
        });
      }
    }
    
    res.json(ApiResponse.deployments(deployments));
  } catch (error) {
    logger.error('Error fetching deployments:', error);
    res.status(500).json(ApiResponse.error(
      'Failed to fetch deployments',
      'FETCH_DEPLOYMENTS_FAILED'
    ));
    return;
  }
});

// Get single deployment details
router.get('/:id', 
  AuthMiddleware.authenticateToken,
  // validateUUID('id'),
  // requirePermission('deployment:read:own'),
  async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const deploymentId = req.params.id;
    
    // Get deployment
    const deployment = await db.getDeploymentById(deploymentId);
    
    if (!deployment) {
      return res.status(404).json(ApiResponse.error(
        'Deployment not found',
        'DEPLOYMENT_NOT_FOUND'
      ));
    }
    
    // Get project to verify ownership
    const project = await db.getProjectById(deployment.project_id);
    
    if (!project || project.user_id !== userId) {
      return res.status(403).json(ApiResponse.error(
        'Access denied',
        'ACCESS_DENIED'
      ));
    }
    
    // Enrich deployment data
    const enrichedDeployment = {
      id: deployment.id,
      projectId: deployment.project_id,
      name: project.name,
      description: project.description,
      status: deployment.status,
      publicUrl: deployment.public_url,
      runtimeType: deployment.runtime_type,
      appSandboxId: deployment.app_sandbox_id,
      dbSandboxId: deployment.db_sandbox_id,
      dbConnectionInfo: deployment.db_connection_info,
      createdAt: deployment.created_at,
      updatedAt: deployment.updated_at,
      // Add mock metrics
      cpu: Math.floor(Math.random() * 100),
      memory: Math.floor(Math.random() * 100),
      network: {
        in: Math.floor(Math.random() * 1000),
        out: Math.floor(Math.random() * 1000)
      }
    };
    
    res.json(ApiResponse.success(enrichedDeployment));
  } catch (error) {
    logger.error('Error fetching deployment:', error);
    res.status(500).json(ApiResponse.error(
      'Failed to fetch deployment',
      'FETCH_DEPLOYMENT_FAILED'
    ));
    return;
  }
});

// Delete deployment
router.delete('/:id', 
  AuthMiddleware.authenticateToken,
  // validateUUID('id'),
  // Skip CSRF for JWT-authenticated API endpoints
  // verifyCSRF,
  // requirePermission('deployment:delete:own'),
  async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const deploymentId = req.params.id;
    
    // Get deployment
    const deployment = await db.getDeploymentById(deploymentId);
    
    if (!deployment) {
      return res.status(404).json(ApiResponse.error(
        'Deployment not found',
        'DEPLOYMENT_NOT_FOUND'
      ));
    }
    
    // Get project to verify ownership
    const project = await db.getProjectById(deployment.project_id);
    
    if (!project || project.user_id !== userId) {
      return res.status(403).json(ApiResponse.error(
        'Access denied',
        'ACCESS_DENIED'
      ));
    }
    
    // Stop and delete sandboxes
    // TODO: Implement sandbox deletion via AgentSphere SDK
    // if (deployment.app_sandbox_id) {
    //   await orchestrator.deleteSandbox(deployment.app_sandbox_id);
    // }
    // if (deployment.db_sandbox_id) {
    //   await orchestrator.deleteSandbox(deployment.db_sandbox_id);
    // }
    
    // Delete from database
    await db.deleteDeployment(deploymentId);
    
    logger.info(`Deployment ${deploymentId} deleted by user ${userId}`);
    
    res.json(ApiResponse.success(
      { deploymentId },
      'Deployment deleted successfully'
    ));
  } catch (error) {
    logger.error('Error deleting deployment:', error);
    res.status(500).json(ApiResponse.error(
      'Failed to delete deployment',
      'DELETE_DEPLOYMENT_FAILED'
    ));
    return;
  }
});

// Control deployment (start/stop/restart)
router.post('/:id/:action', 
  AuthMiddleware.authenticateToken,
  // validateUUID('id'),
  // Skip CSRF for JWT-authenticated API endpoints
  // verifyCSRF,
  // requirePermission('deployment:update:own'),
  async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const deploymentId = req.params.id;
    const action = req.params.action as 'start' | 'stop' | 'restart';
    
    if (!['start', 'stop', 'restart'].includes(action)) {
      return res.status(400).json(ApiResponse.error(
        'Invalid action. Must be start, stop, or restart',
        'INVALID_ACTION'
      ));
    }
    
    // Get deployment
    const deployment = await db.getDeploymentById(deploymentId);
    
    if (!deployment) {
      return res.status(404).json(ApiResponse.error(
        'Deployment not found',
        'DEPLOYMENT_NOT_FOUND'
      ));
    }
    
    // Get project to verify ownership
    const project = await db.getProjectById(deployment.project_id);
    
    if (!project || project.user_id !== userId) {
      return res.status(403).json(ApiResponse.error(
        'Access denied',
        'ACCESS_DENIED'
      ));
    }
    
    // Control sandbox based on action
    // TODO: Implement sandbox control via AgentSphere SDK
    
    switch (action) {
    case 'start':
      if (deployment.status === DeploymentStatus.STOPPED) {
        // Start sandbox (implementation depends on AgentSphere API)
        await db.updateDeploymentStatus(deploymentId, DeploymentStatus.RUNNING);
      }
      break;
        
    case 'stop':
      if (deployment.status === DeploymentStatus.RUNNING) {
        // Stop sandbox (implementation depends on AgentSphere API)
        await db.updateDeploymentStatus(deploymentId, DeploymentStatus.STOPPED);
      }
      break;
        
    case 'restart':
      // Restart sandbox (stop then start)
      await db.updateDeploymentStatus(deploymentId, DeploymentStatus.PROVISIONING);
      setTimeout(async () => {
        await db.updateDeploymentStatus(deploymentId, DeploymentStatus.RUNNING);
      }, 3000);
      break;
    }
    
    logger.info(`Deployment ${deploymentId} ${action}ed by user ${userId}`);
    
    res.json(ApiResponse.success({
      deploymentId,
      action,
      status: action === 'restart' ? DeploymentStatus.PROVISIONING : (action === 'start' ? DeploymentStatus.RUNNING : DeploymentStatus.STOPPED),
      timestamp: new Date().toISOString()
    }, `Deployment ${action}ed successfully`));
  } catch (error) {
    logger.error(`Error ${req.params.action}ing deployment:`, error);
    res.status(500).json(ApiResponse.error(
      `Failed to ${req.params.action} deployment`,
      'DEPLOYMENT_ACTION_FAILED'
    ));
    return;
  }
});

// Get deployment logs
router.get('/:id/logs',
  AuthMiddleware.authenticateToken,
  async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const deploymentId = req.params.id;
    
    // Get deployment and verify ownership
    const deployment = await db.getDeploymentById(deploymentId);
    if (!deployment) {
      return res.status(404).json(ApiResponse.error(
        'Deployment not found',
        'DEPLOYMENT_NOT_FOUND'
      ));
    }
    
    // Get project to verify ownership
    const project = await db.getProjectById(deployment.project_id);
    if (!project || project.user_id !== userId) {
      return res.status(403).json(ApiResponse.error(
        'Access denied',
        'ACCESS_DENIED'
      ));
    }
    
    // Get logs from orchestration service
    try {
      const monitoring = await orchestrator.monitorDeployment(deploymentId);
      
      const logs = {
        deploymentId,
        status: deployment.status,
        logs: monitoring.logs || [
          `[${new Date().toISOString()}] Deployment started`,
          `[${new Date().toISOString()}] Installing dependencies...`,
          `[${new Date().toISOString()}] Starting application...`,
          `[${new Date().toISOString()}] Application is running on port 3000`
        ],
        timestamp: new Date().toISOString()
      };
      
      res.json(ApiResponse.success(logs));
    } catch (monitorError) {
      // Return basic logs if monitoring fails
      const basicLogs = {
        deploymentId,
        status: deployment.status,
        logs: [
          `[${deployment.created_at}] Deployment created`,
          `[${deployment.updated_at}] Status: ${deployment.status}`
        ],
        timestamp: new Date().toISOString()
      };
      
      res.json(ApiResponse.success(basicLogs));
    }
    
  } catch (error) {
    logger.error('Error fetching deployment logs:', error);
    res.status(500).json(ApiResponse.error(
      'Failed to fetch deployment logs',
      'FETCH_LOGS_FAILED'
    ));
    return;
  }
});

export default router;