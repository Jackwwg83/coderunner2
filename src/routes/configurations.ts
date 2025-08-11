import { Router, Request, Response } from 'express';
import { ConfigurationService } from '../services/configuration';
import { authenticateToken } from '../middleware/auth';
import { ApiResponse } from '../utils/response';
import { AuthenticatedRequest } from '../types';

const router = Router();
const configService = ConfigurationService.getInstance();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * GET /api/config/projects/:projectId/environments
 * Get all environment configurations for a project
 */
router.get('/projects/:projectId/environments', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    
    const configs = await configService.getProjectConfigurations(projectId);
    
    res.json(ApiResponse.success(
      configs,
      'Environment configurations retrieved successfully'
    ));
    
  } catch (error: any) {
    res.status(400).json(ApiResponse.error(
      error.message,
      'FETCH_CONFIGS_FAILED'
    ));
  }
});

/**
 * POST /api/config/projects/:projectId/environments
 * Create new environment configuration
 */
router.post('/projects/:projectId/environments', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = req.user!.userId;
    const configData = req.body;
    
    const config = await configService.createConfiguration(projectId, configData, userId);
    
    res.status(201).json(ApiResponse.success(
      config,
      'Environment configuration created successfully'
    ));
  } catch (error: any) {
    res.status(400).json(ApiResponse.error(
      error.message,
      'CREATE_CONFIG_FAILED'
    ));
  }
});

/**
 * GET /api/config/environments/:configId
 * Get specific environment configuration
 */
router.get('/environments/:configId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { configId } = req.params;
    
    const config = await configService.getConfigurationById(configId);
    
    if (!config) {
      const response: ApiResponse = {
        success: false,
        error: 'Configuration not found',
        message: 'The requested configuration does not exist',
        timestamp: new Date()
      };
      
      return res.status(404).json(response);
    }

    // Mask encrypted values for display
    const configWithMaskedValues = {
      ...config,
      variables: config.variables.map(variable => ({
        ...variable,
        value: variable.isEncrypted ? '***ENCRYPTED***' : variable.value
      }))
    };
    
    const response: ApiResponse = {
      success: true,
      data: configWithMaskedValues,
      message: 'Environment configuration retrieved successfully',
      timestamp: new Date()
    };
    
    res.json(response);
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      error: error.message,
      message: 'Failed to retrieve environment configuration',
      timestamp: new Date()
    };
    
    res.status(400).json(response);
  }
});

/**
 * PUT /api/config/environments/:configId/variables/:key
 * Set or update environment variable
 */
router.put('/environments/:configId/variables/:key', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { configId, key } = req.params;
    const userId = req.user!.userId;
    const variableData = { ...req.body, key };
    
    const variable = await configService.setVariable(configId, variableData, userId);
    
    // Mask the value if encrypted
    const responseVariable = {
      ...variable,
      value: variable.isEncrypted ? '***ENCRYPTED***' : variable.value
    };
    
    const response: ApiResponse = {
      success: true,
      data: responseVariable,
      message: 'Environment variable updated successfully',
      timestamp: new Date()
    };
    
    res.json(response);
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      error: error.message,
      message: 'Failed to update environment variable',
      timestamp: new Date()
    };
    
    res.status(400).json(response);
  }
});

/**
 * DELETE /api/config/environments/:configId/variables/:key
 * Delete environment variable
 */
router.delete('/environments/:configId/variables/:key', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { configId, key } = req.params;
    const userId = req.user!.userId;
    
    await configService.deleteVariable(configId, key, userId);
    
    const response: ApiResponse = {
      success: true,
      message: 'Environment variable deleted successfully',
      timestamp: new Date()
    };
    
    res.json(response);
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      error: error.message,
      message: 'Failed to delete environment variable',
      timestamp: new Date()
    };
    
    res.status(400).json(response);
  }
});

/**
 * GET /api/config/templates
 * Get available configuration templates
 */
router.get('/templates', async (req: Request, res: Response) => {
  try {
    const { category } = req.query;
    
    const templates = await configService.getTemplates(category as string);
    
    const response: ApiResponse = {
      success: true,
      data: templates,
      message: 'Configuration templates retrieved successfully',
      timestamp: new Date()
    };
    
    res.json(response);
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      error: error.message,
      message: 'Failed to retrieve configuration templates',
      timestamp: new Date()
    };
    
    res.status(400).json(response);
  }
});

/**
 * GET /api/config/templates/:templateId
 * Get specific configuration template
 */
router.get('/templates/:templateId', async (req: Request, res: Response) => {
  try {
    const { templateId } = req.params;
    
    const template = await configService.getTemplateById(templateId);
    
    const response: ApiResponse = {
      success: true,
      data: template,
      message: 'Configuration template retrieved successfully',
      timestamp: new Date()
    };
    
    res.json(response);
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      error: error.message,
      message: 'Failed to retrieve configuration template',
      timestamp: new Date()
    };
    
    res.status(404).json(response);
  }
});

/**
 * POST /api/config/projects/:projectId/apply-template
 * Apply configuration template to project
 */
router.post('/projects/:projectId/apply-template', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const { templateId, environment, overrides } = req.body;
    const userId = req.user!.userId;
    
    if (!templateId || !environment) {
      const response: ApiResponse = {
        success: false,
        error: 'Missing required fields: templateId and environment',
        message: 'Template ID and environment are required',
        timestamp: new Date()
      };
      
      return res.status(400).json(response);
    }
    
    const config = await configService.applyTemplate(projectId, {
      templateId,
      environment,
      overrides: overrides || {}
    }, userId);
    
    // Mask encrypted values
    const configWithMaskedValues = {
      ...config,
      variables: config.variables.map(variable => ({
        ...variable,
        value: variable.isEncrypted ? '***ENCRYPTED***' : variable.value
      }))
    };
    
    const response: ApiResponse = {
      success: true,
      data: configWithMaskedValues,
      message: 'Template applied successfully',
      timestamp: new Date()
    };
    
    res.status(201).json(response);
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      error: error.message,
      message: 'Failed to apply template',
      timestamp: new Date()
    };
    
    res.status(400).json(response);
  }
});

/**
 * GET /api/config/projects/:projectId/audit
 * Get configuration audit logs for a project
 */
router.get('/projects/:projectId/audit', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const result = await configService.getAuditLogs(projectId, limit, offset);
    
    const response: ApiResponse = {
      success: true,
      data: result,
      message: 'Audit logs retrieved successfully',
      timestamp: new Date()
    };
    
    res.json(response);
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      error: error.message,
      message: 'Failed to retrieve audit logs',
      timestamp: new Date()
    };
    
    res.status(400).json(response);
  }
});

/**
 * POST /api/config/deployments/:deploymentId/reload
 * Hot-reload configuration for running deployment
 */
router.post('/deployments/:deploymentId/reload', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { deploymentId } = req.params;
    
    await configService.reloadConfiguration(deploymentId);
    
    const response: ApiResponse = {
      success: true,
      message: 'Configuration reloaded successfully',
      timestamp: new Date()
    };
    
    res.json(response);
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      error: error.message,
      message: 'Failed to reload configuration',
      timestamp: new Date()
    };
    
    res.status(400).json(response);
  }
});

/**
 * GET /api/config/environments/:configId/export
 * Export configuration in various formats
 */
router.get('/environments/:configId/export', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { configId } = req.params;
    const format = (req.query.format as string) || 'env';
    
    if (!['env', 'json', 'yaml'].includes(format)) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid format. Supported formats: env, json, yaml',
        message: 'Invalid export format specified',
        timestamp: new Date()
      };
      
      return res.status(400).json(response);
    }
    
    const exportedData = await configService.exportConfiguration(configId, format as any);
    
    // Set appropriate content type
    let contentType = 'text/plain';
    if (format === 'json') {
      contentType = 'application/json';
    } else if (format === 'yaml') {
      contentType = 'application/x-yaml';
    }
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename=config.${format}`);
    res.send(exportedData);
    
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      error: error.message,
      message: 'Failed to export configuration',
      timestamp: new Date()
    };
    
    res.status(400).json(response);
  }
});

/**
 * GET /api/config/projects/:projectId/environments/:environment/deployment
 * Get configuration for deployment (internal use - returns decrypted values)
 * This endpoint should be secured for internal system use only
 */
router.get('/projects/:projectId/environments/:environment/deployment', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectId, environment } = req.params;
    
    // Additional security check - this endpoint should only be used by system/admin users
    if (req.user!.planType !== 'system' && req.user!.planType !== 'enterprise') {
      const response: ApiResponse = {
        success: false,
        error: 'Insufficient permissions',
        message: 'This endpoint requires system-level access',
        timestamp: new Date()
      };
      
      return res.status(403).json(response);
    }
    
    const config = await configService.getConfigurationForDeployment(projectId, environment);
    
    const response: ApiResponse = {
      success: true,
      data: config,
      message: 'Deployment configuration retrieved successfully',
      timestamp: new Date()
    };
    
    res.json(response);
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      error: error.message,
      message: 'Failed to retrieve deployment configuration',
      timestamp: new Date()
    };
    
    res.status(400).json(response);
  }
});

export default router;