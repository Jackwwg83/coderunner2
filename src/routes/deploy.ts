import { Router, Request, Response } from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { OrchestrationService } from '../services/orchestration';
import { DatabaseService } from '../services/database';
import { 
  ApiResponse, 
  ProjectFile, 
  CreateProjectInput,
  AuthError
} from '../types';

const router = Router();
const orchestrationService = OrchestrationService.getInstance();
const db = DatabaseService.getInstance();

// Plan limits configuration
const PLAN_LIMITS = {
  free: {
    maxProjects: 3,
    maxDeployments: 10,
    maxFileSize: 10 * 1024 * 1024,    // 10MB
    maxTotalSize: 50 * 1024 * 1024    // 50MB
  },
  personal: {
    maxProjects: 10,
    maxDeployments: 100,
    maxFileSize: 50 * 1024 * 1024,    // 50MB
    maxTotalSize: 200 * 1024 * 1024   // 200MB
  },
  team: {
    maxProjects: -1,    // unlimited
    maxDeployments: -1,
    maxFileSize: 100 * 1024 * 1024,   // 100MB
    maxTotalSize: 500 * 1024 * 1024   // 500MB
  }
};

// Custom rate limiting for deployment requests
const deployRateLimit = AuthMiddleware.apiRateLimit;

/**
 * POST /api/deploy
 * Unified deployment endpoint for all project types
 */
router.post('/',
  AuthMiddleware.authenticateToken,
  deployRateLimit,
  AuthMiddleware.validateRequiredFields(['projectName', 'files']),
  AuthMiddleware.sanitizeInput,
  async (req: Request, res: Response) => {
    const startTime = Date.now();
    let projectId: string | null = null;
    // let deploymentId: string | null = null;

    try {
      const userId = AuthMiddleware.getUserId(req);
      const userPlan = req.user!.planType;
      
      // Extract request data
      const {
        projectName,
        projectDescription,
        files,
        config = {}
      } = req.body;

      // Validate input parameters
      if (!Array.isArray(files) || files.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Files array is required and must not be empty',
          message: '[INVALID_FILES] Files array is required and must not be empty',
          timestamp: new Date()
        });
        return;
      }

      // Validate project name
      if (typeof projectName !== 'string' || projectName.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: 'Project name is required and must be a non-empty string',
          message: '[INVALID_PROJECT_NAME] Project name is required and must be a non-empty string',
          timestamp: new Date()
        });
        return;
      }

      // Sanitize project name
      const sanitizedProjectName = projectName.trim().replace(/[^a-zA-Z0-9-_\s]/g, '');
      if (sanitizedProjectName.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Project name contains only invalid characters',
          message: '[INVALID_PROJECT_NAME] Project name contains only invalid characters',
          timestamp: new Date()
        });
        return;
      }

      console.log(`🚀 Processing deployment request for user ${userId}: ${sanitizedProjectName}`);

      // Check user quota limits
      const quotaCheck = await checkUserQuota(userId, userPlan, files);
      if (!quotaCheck.allowed) {
        res.status(403).json({
          success: false,
          error: quotaCheck.reason,
          message: `[QUOTA_EXCEEDED] ${quotaCheck.reason}`,
          timestamp: new Date()
        });
        return;
      }

      // Process and validate files
      const processedFiles = await processProjectFiles(files);
      if (!processedFiles.success) {
        res.status(400).json({
          success: false,
          error: processedFiles.error,
          message: `[INVALID_FILES] ${processedFiles.error}`,
          timestamp: new Date()
        });
        return;
      }

      // Create or get project record
      const project = await createOrGetProject(userId, sanitizedProjectName, projectDescription);
      projectId = project.id;
      
      console.log(`📝 Project record created/found: ${projectId}`);

      // Validate deployment configuration
      const deployConfig = validateDeploymentConfig(config, userPlan);
      
      console.log(`🔧 Deployment configuration validated`);

      // Execute deployment through OrchestrationService
      console.log(`🚀 Starting deployment process...`);
      const deploymentResult = await orchestrationService.deployProject(
        userId,
        processedFiles.files!,
        deployConfig
      );

      // deploymentId = deploymentResult.id;
      
      // Update project with latest deployment
      await db.updateProject(projectId, {
        description: projectDescription || project.description
      });

      const executionTime = Date.now() - startTime;
      console.log(`✅ Deployment completed successfully in ${executionTime}ms`);
      console.log(`🌐 Application URL: ${deploymentResult.url}`);

      // Return success response
      const response: ApiResponse = {
        success: true,
        data: {
          deploymentId: deploymentResult.id,
          projectId: deploymentResult.projectId,
          url: deploymentResult.url,
          sandboxId: deploymentResult.sandboxId,
          status: deploymentResult.status,
          createdAt: new Date().toISOString()
        },
        message: 'Deployment successful',
        timestamp: new Date()
      };

      res.status(201).json(response);

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`❌ Deployment failed after ${executionTime}ms:`, error);

      // Handle different types of errors
      let statusCode = 500;
      let errorCode = 'DEPLOYMENT_FAILED';
      let errorMessage = 'Deployment failed due to an internal error';
      // let errorDetails: any = undefined;

      if (error instanceof AuthError) {
        statusCode = error.statusCode;
        errorCode = error.code;
        errorMessage = error.message;
      } else if (error instanceof Error) {
        errorMessage = `Deployment failed: ${error.message}`;
        
        // Classify common error types
        if (error.message.includes('timeout')) {
          statusCode = 408;
          errorCode = 'DEPLOYMENT_TIMEOUT';
          errorMessage = 'Deployment timed out. Please try again.';
        } else if (error.message.includes('quota') || error.message.includes('limit')) {
          statusCode = 403;
          errorCode = 'QUOTA_EXCEEDED';
        } else if (error.message.includes('not found')) {
          statusCode = 404;
          errorCode = 'RESOURCE_NOT_FOUND';
        } else if (error.message.includes('sandbox')) {
          statusCode = 503;
          errorCode = 'SANDBOX_ERROR';
          errorMessage = 'Sandbox service unavailable. Please try again later.';
        }
      }

      // Log detailed error for debugging
      console.error('Deployment error details:', {
        userId: req.user?.userId,
        projectName: req.body?.projectName,
        errorCode,
        errorMessage,
        error: error instanceof Error ? error.stack : error
      });

      const errorResponse: ApiResponse = {
        success: false,
        error: errorMessage,
        message: `[${errorCode}] ${errorMessage}`,
        timestamp: new Date()
      };

      res.status(statusCode).json(errorResponse);
    }
  }
);

/**
 * Check if user has sufficient quota for deployment
 */
async function checkUserQuota(
  userId: string, 
  planType: string, 
  files: any[]
): Promise<{
  allowed: boolean;
  reason?: string;
  details?: any;
}> {
  try {
    const limits = PLAN_LIMITS[planType as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.free;
    
    // Check project count limit
    if (limits.maxProjects !== -1) {
      const { total: projectCount } = await db.getProjectsByUserId(userId, 1, 0);
      if (projectCount >= limits.maxProjects) {
        return {
          allowed: false,
          reason: `Project limit exceeded. Your ${planType} plan allows ${limits.maxProjects} projects.`,
          details: { 
            currentProjects: projectCount, 
            maxProjects: limits.maxProjects,
            planType 
          }
        };
      }
    }

    // Check deployment count limit
    if (limits.maxDeployments !== -1) {
      const runningDeployments = await db.getRunningDeploymentCountByUser(userId);
      if (runningDeployments >= limits.maxDeployments) {
        return {
          allowed: false,
          reason: `Deployment limit exceeded. Your ${planType} plan allows ${limits.maxDeployments} concurrent deployments.`,
          details: { 
            currentDeployments: runningDeployments, 
            maxDeployments: limits.maxDeployments,
            planType 
          }
        };
      }
    }

    // Check file size limits
    let totalSize = 0;
    for (const file of files) {
      const fileContent = typeof file.content === 'string' ? file.content : '';
      const fileSize = Buffer.byteLength(fileContent, 'utf8');
      
      if (fileSize > limits.maxFileSize) {
        return {
          allowed: false,
          reason: `File '${file.path}' exceeds the maximum file size limit of ${Math.round(limits.maxFileSize / 1024 / 1024)}MB for ${planType} plan.`,
          details: { 
            file: file.path, 
            fileSize, 
            maxFileSize: limits.maxFileSize,
            planType 
          }
        };
      }
      
      totalSize += fileSize;
    }

    if (totalSize > limits.maxTotalSize) {
      return {
        allowed: false,
        reason: `Total project size exceeds the limit of ${Math.round(limits.maxTotalSize / 1024 / 1024)}MB for ${planType} plan.`,
        details: { 
          totalSize, 
          maxTotalSize: limits.maxTotalSize,
          planType 
        }
      };
    }

    return { allowed: true };

  } catch (error) {
    console.error('Error checking user quota:', error);
    return {
      allowed: false,
      reason: 'Failed to check user quota. Please try again.',
      details: { error: 'quota_check_failed' }
    };
  }
}

/**
 * Process and validate project files
 */
async function processProjectFiles(files: any[]): Promise<{
  success: boolean;
  files?: ProjectFile[];
  error?: string;
  details?: any;
}> {
  try {
    const processedFiles: ProjectFile[] = [];
    const seenPaths = new Set<string>();

    for (const file of files) {
      // Validate file structure
      if (!file.path || typeof file.path !== 'string') {
        return {
          success: false,
          error: 'Each file must have a valid path property'
        };
      }

      if (!file.content || typeof file.content !== 'string') {
        return {
          success: false,
          error: `File '${file.path}' must have valid content property`
        };
      }

      // Normalize file path
      let normalizedPath = file.path.trim();
      
      // Validate path security (prevent directory traversal)
      if (normalizedPath.includes('..') || normalizedPath.includes('~') || normalizedPath.startsWith('/')) {
        return {
          success: false,
          error: `Invalid file path '${file.path}'. Path traversal and absolute paths are not allowed.`
        };
      }

      // Ensure path doesn't start with ./
      if (normalizedPath.startsWith('./')) {
        normalizedPath = normalizedPath.substring(2);
      }

      // Check for duplicate paths
      if (seenPaths.has(normalizedPath)) {
        return {
          success: false,
          error: `Duplicate file path detected: '${normalizedPath}'`
        };
      }
      seenPaths.add(normalizedPath);

      // Process file content (decode base64 if needed)
      let content = file.content;
      
      // Check if content is base64 encoded
      if (isBase64(content)) {
        try {
          content = Buffer.from(content, 'base64').toString('utf8');
        } catch (error) {
          return {
            success: false,
            error: `Failed to decode base64 content for file '${normalizedPath}'`
          };
        }
      }

      // Determine file language based on extension
      const language = getFileLanguage(normalizedPath);

      processedFiles.push({
        path: normalizedPath,
        content: content,
        language: language || undefined,
        size: Buffer.byteLength(content, 'utf8')
      });
    }

    // Validate that there's at least one valid file
    if (processedFiles.length === 0) {
      return {
        success: false,
        error: 'No valid files found in the request'
      };
    }

    return {
      success: true,
      files: processedFiles
    };

  } catch (error) {
    console.error('Error processing files:', error);
    return {
      success: false,
      error: 'Failed to process project files',
      details: { error: error instanceof Error ? error.message : 'unknown_error' }
    };
  }
}

/**
 * Create or get existing project
 */
async function createOrGetProject(
  userId: string, 
  projectName: string, 
  description?: string
): Promise<{ id: string; name: string; description: string | undefined }> {
  try {
    // Check if project with the same name already exists for this user
    const { projects } = await db.getProjectsByUserId(userId, 100, 0);
    const existingProject = projects.find(p => p.name.toLowerCase() === projectName.toLowerCase());
    
    if (existingProject) {
      console.log(`📋 Found existing project: ${existingProject.id}`);
      return {
        id: existingProject.id,
        name: existingProject.name,
        description: existingProject.description || undefined
      };
    }

    // Create new project
    const projectInput: CreateProjectInput = {
      user_id: userId,
      name: projectName,
      description: description || `Auto-generated project for ${projectName}`
    };

    const newProject = await db.createProject(projectInput);
    console.log(`📝 Created new project: ${newProject.id}`);
    
    return {
      id: newProject.id,
      name: newProject.name,
      description: newProject.description || undefined
    };

  } catch (error) {
    console.error('Error creating/getting project:', error);
    throw new Error(`Failed to create project: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate and normalize deployment configuration
 */
function validateDeploymentConfig(config: any, _planType: string): {
  timeout?: number;
  env?: Record<string, string>;
  port?: number;
} {
  const deployConfig: any = {};

  // Validate timeout
  if (config.timeout !== undefined) {
    const timeout = parseInt(config.timeout);
    if (isNaN(timeout) || timeout < 30 || timeout > 600) {
      deployConfig.timeout = 300; // Default 5 minutes
    } else {
      deployConfig.timeout = timeout;
    }
  } else {
    deployConfig.timeout = 300; // Default 5 minutes
  }

  // Validate environment variables
  if (config.env && typeof config.env === 'object') {
    deployConfig.env = {};
    Object.keys(config.env).forEach(key => {
      if (typeof key === 'string' && typeof config.env[key] === 'string') {
        // Sanitize env var name and value
        const sanitizedKey = key.replace(/[^A-Za-z0-9_]/g, '');
        const sanitizedValue = config.env[key].substring(0, 1000); // Limit length
        
        if (sanitizedKey.length > 0) {
          deployConfig.env[sanitizedKey] = sanitizedValue;
        }
      }
    });
  }

  // Validate port
  if (config.port !== undefined) {
    const port = parseInt(config.port);
    if (isNaN(port) || port < 1024 || port > 65535) {
      deployConfig.port = 3000; // Default port
    } else {
      deployConfig.port = port;
    }
  } else {
    deployConfig.port = 3000; // Default port
  }

  return deployConfig;
}

/**
 * Check if a string is valid base64
 */
function isBase64(str: string): boolean {
  try {
    // Simple base64 pattern check
    const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
    return base64Pattern.test(str) && str.length > 0 && str.length % 4 === 0;
  } catch {
    return false;
  }
}

/**
 * Determine file language based on file extension
 */
function getFileLanguage(filePath: string): string | undefined {
  const extension = filePath.split('.').pop()?.toLowerCase();
  
  const languageMap: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'py': 'python',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'json': 'json',
    'yaml': 'yaml',
    'yml': 'yaml',
    'md': 'markdown',
    'txt': 'text',
    'sql': 'sql',
    'sh': 'bash',
    'dockerfile': 'dockerfile'
  };

  return extension ? languageMap[extension] : undefined;
}

export default router;