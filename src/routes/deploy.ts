import { Router, Request, Response } from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { OrchestrationService } from '../services/orchestration';
import { DatabaseService } from '../services/database';
import { ProjectAnalyzer } from '../utils/analyzer';
import { ManifestEngine } from '../services/manifestEngine';
import { ApiResponse } from '../utils/response';
import { 
  ProjectFile, 
  CreateProjectInput,
  AuthError,
  DeploymentStatus
} from '../types';

const router = Router();
const orchestrationService = OrchestrationService.getInstance();
const db = DatabaseService.getInstance();

// Simplified plan limits
const SIMPLE_LIMITS = {
  maxFileSize: 10 * 1024 * 1024,    // 10MB per file
  maxTotalSize: 50 * 1024 * 1024,   // 50MB total
  maxFiles: 50                      // Maximum 50 files
};

// Custom rate limiting for deployment requests
const deployRateLimit = AuthMiddleware.apiRateLimit;

/**
 * POST /api/deploy
 * Simplified one-click deployment endpoint
 * Supports Node.js projects and Manifest.yaml files
 */
router.post('/',
  AuthMiddleware.authenticateToken,
  async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      const userId = AuthMiddleware.getUserId(req);
      const { files } = req.body;

      // Simple validation
      if (!Array.isArray(files) || files.length === 0) {
        return res.status(400).json(ApiResponse.error(
          'Files array is required and must not be empty',
          'INVALID_FILES'
        ));
      }

      if (files.length > SIMPLE_LIMITS.maxFiles) {
        return res.status(400).json(ApiResponse.error(
          `Too many files. Maximum ${SIMPLE_LIMITS.maxFiles} files allowed`,
          'TOO_MANY_FILES'
        ));
      }

      console.log(`🚀 Starting simple deployment for user ${userId} with ${files.length} files`);

      // Process and validate files
      const processedFiles = await processProjectFiles(files);
      if (!processedFiles.success) {
        return res.status(400).json(ApiResponse.error(
          processedFiles.error!,
          'INVALID_FILES'
        ));
      }

      // Detect project type
      const projectAnalysis = ProjectAnalyzer.analyzeProject(processedFiles.files!);
      console.log(`✅ Detected project type: ${projectAnalysis.projectType}`);

      // Handle manifest projects
      let finalFiles = processedFiles.files!;
      if (projectAnalysis.projectType === 'manifest') {
        console.log('🛠️ Processing manifest file...');
        const manifestFile = finalFiles.find(f => f.path === 'manifest.yaml' || f.path === 'manifest.yml');
        if (!manifestFile) {
          return res.status(400).json(ApiResponse.error(
            'Manifest file not found',
            'MANIFEST_NOT_FOUND'
          ));
        }

        try {
          const manifestEngine = ManifestEngine.getInstance();
          const generatedFiles = manifestEngine.generateProject(manifestFile.content);
          
          // Merge generated files with user files
          const userFilePaths = new Set(finalFiles.map(f => f.path));
          const additionalFiles = generatedFiles
            .filter(f => !userFilePaths.has(f.path))
            .map(f => ({ path: f.path, content: f.content }));
          
          finalFiles = [...finalFiles, ...additionalFiles];
          console.log(`✅ Generated ${generatedFiles.length} files from manifest`);
        } catch (manifestError) {
          return res.status(400).json(ApiResponse.error(
            `Invalid manifest: ${manifestError instanceof Error ? manifestError.message : 'Unknown error'}`,
            'INVALID_MANIFEST'
          ));
        }
      }

      // Deploy project
      console.log(`🚀 Deploying ${projectAnalysis.projectType} project...`);
      const deploymentResult = await orchestrationService.deployProject(
        userId,
        finalFiles,
        { timeout: 300000, port: 3000 } // 5 minute timeout, port 3000
      );

      const executionTime = Date.now() - startTime;
      console.log(`✅ Deployment completed in ${executionTime}ms`);
      console.log(`🌐 Application URL: ${deploymentResult.url}`);

      // Return simplified success response
      res.status(201).json(ApiResponse.success({
        deploymentId: deploymentResult.id,
        url: deploymentResult.url,
        status: deploymentResult.status,
        projectType: projectAnalysis.projectType,
        framework: projectAnalysis.framework
      }, 'Deployment successful'));

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`❌ Deployment failed after ${executionTime}ms:`, error);

      // Simplified error handling
      let statusCode = 500;
      let errorCode = 'DEPLOYMENT_FAILED';
      let errorMessage = 'Deployment failed';

      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Basic error classification
        if (error.message.includes('timeout')) {
          statusCode = 408;
          errorCode = 'TIMEOUT';
        } else if (error.message.includes('manifest')) {
          statusCode = 400;
          errorCode = 'INVALID_MANIFEST';
        } else if (error.message.includes('sandbox')) {
          statusCode = 503;
          errorCode = 'SANDBOX_ERROR';
        }
      }

      res.status(statusCode).json(ApiResponse.error(errorMessage, errorCode));
    }
  }
);

/**
 * Simple file validation for deployment
 */
function validateFiles(files: any[]): { valid: boolean; error?: string } {
  let totalSize = 0;
  
  for (const file of files) {
    if (!file.path || !file.content) {
      return { valid: false, error: 'Each file must have path and content' };
    }
    
    const fileContent = typeof file.content === 'string' ? file.content : '';
    const fileSize = Buffer.byteLength(fileContent, 'utf8');
    
    if (fileSize > SIMPLE_LIMITS.maxFileSize) {
      return { 
        valid: false, 
        error: `File '${file.path}' is too large (max ${Math.round(SIMPLE_LIMITS.maxFileSize / 1024 / 1024)}MB)` 
      };
    }
    
    totalSize += fileSize;
  }
  
  if (totalSize > SIMPLE_LIMITS.maxTotalSize) {
    return { 
      valid: false, 
      error: `Total project size too large (max ${Math.round(SIMPLE_LIMITS.maxTotalSize / 1024 / 1024)}MB)` 
    };
  }
  
  return { valid: true };
}

/**
 * Process and validate project files (simplified)
 */
async function processProjectFiles(files: any[]): Promise<{
  success: boolean;
  files?: ProjectFile[];
  error?: string;
}> {
  try {
    // Basic validation first
    const validation = validateFiles(files);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const processedFiles: ProjectFile[] = [];
    const seenPaths = new Set<string>();

    for (const file of files) {
      // Normalize file path
      let normalizedPath = file.path.trim();
      
      // Basic security check
      if (normalizedPath.includes('..') || normalizedPath.startsWith('/')) {
        return {
          success: false,
          error: `Invalid file path: ${file.path}`
        };
      }

      // Remove ./ prefix if present
      if (normalizedPath.startsWith('./')) {
        normalizedPath = normalizedPath.substring(2);
      }

      // Check for duplicate paths
      if (seenPaths.has(normalizedPath)) {
        return {
          success: false,
          error: `Duplicate file path: ${normalizedPath}`
        };
      }
      seenPaths.add(normalizedPath);

      processedFiles.push({
        path: normalizedPath,
        content: file.content,
        size: Buffer.byteLength(file.content, 'utf8')
      });
    }

    return { success: true, files: processedFiles };

  } catch (error) {
    console.error('Error processing files:', error);
    return {
      success: false,
      error: 'Failed to process files'
    };
  }
}

// Removed createOrGetProject function - we'll create projects automatically in deployments

// Removed complex config validation - using simple defaults

// Removed utility functions to keep it simple

export default router;