import { Router, Request, Response } from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { ApiResponse } from '../utils/response';
import { ManifestEngine } from '../services/manifestEngine';
import { logger } from '../utils/logger';

const router = Router();
const manifestEngine = ManifestEngine.getInstance();

// Apply authentication to all project routes
router.use(AuthMiddleware.authenticateToken);

/**
 * POST /api/projects/analyze
 * Analyze project files and detect type/framework
 */
router.post('/analyze', 
  AuthMiddleware.sanitizeInput,
  async (req: Request, res: Response) => {
    try {
      const { name, type, files } = req.body;
      
      // Input validation
      if (!name || !files || !Array.isArray(files)) {
        return res.status(400).json(ApiResponse.error(
          'Name and files array are required',
          'INVALID_INPUT'
        ));
      }

      // Sanitize input
      if (typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json(ApiResponse.error(
          'Project name must be a non-empty string',
          'INVALID_PROJECT_NAME'
        ));
      }

      if (files.some((f: any) => typeof f !== 'object' || !f.name || !f.content)) {
        return res.status(400).json(ApiResponse.error(
          'Invalid file format. Each file must have name and content',
          'INVALID_FILE_FORMAT'
        ));
      }

      // Analyze project based on type
      let analysisResult;
      
      if (type === 'manifest') {
        // Analyze manifest files
        const manifestFile = files.find((f: any) => f.name.endsWith('.yml') || f.name.endsWith('.yaml'));
        if (!manifestFile) {
          return res.status(400).json(ApiResponse.error(
            'Manifest project must contain a .yml or .yaml file',
            'MANIFEST_FILE_REQUIRED'
          ));
        }

        try {
          const manifestResult = await manifestEngine.parseManifest(manifestFile.content);
          analysisResult = {
            type: 'manifest',
            framework: 'manifest',
            endpoints: manifestResult.endpoints || [],
            environment: manifestResult.environment || {}
          };
        } catch (error) {
          logger.error('Manifest parsing error:', error);
          return res.status(400).json(ApiResponse.error(
            'Invalid manifest file format',
            'INVALID_MANIFEST'
          ));
        }
      } else if (type === 'nodejs') {
        // Analyze Node.js project
        const packageJsonFile = files.find((f: any) => f.name === 'package.json');
        if (!packageJsonFile) {
          return res.status(400).json(ApiResponse.error(
            'Node.js project must contain a package.json file',
            'PACKAGE_JSON_REQUIRED'
          ));
        }

        try {
          const packageJson = JSON.parse(packageJsonFile.content);
          analysisResult = {
            type: 'nodejs',
            framework: detectFramework(packageJson),
            dependencies: packageJson.dependencies || {},
            scripts: packageJson.scripts || {},
            main: packageJson.main || 'index.js'
          };
        } catch (error) {
          logger.error('Package.json parsing error:', error);
          return res.status(400).json(ApiResponse.error(
            'Invalid package.json format',
            'INVALID_PACKAGE_JSON'
          ));
        }
      } else {
        // Auto-detect project type
        const packageJsonFile = files.find((f: any) => f.name === 'package.json');
        const manifestFile = files.find((f: any) => f.name.endsWith('.yml') || f.name.endsWith('.yaml'));
        
        if (packageJsonFile) {
          try {
            const packageJson = JSON.parse(packageJsonFile.content);
            analysisResult = {
              type: 'nodejs',
              framework: detectFramework(packageJson),
              dependencies: packageJson.dependencies || {},
              scripts: packageJson.scripts || {}
            };
          } catch (error) {
            logger.error('Auto-detection package.json error:', error);
          }
        } else if (manifestFile) {
          try {
            const manifestResult = await manifestEngine.parseManifest(manifestFile.content);
            analysisResult = {
              type: 'manifest',
              framework: 'manifest',
              endpoints: manifestResult.endpoints || []
            };
          } catch (error) {
            logger.error('Auto-detection manifest error:', error);
          }
        }

        if (!analysisResult) {
          analysisResult = {
            type: 'unknown',
            framework: 'unknown',
            files: files.map((f: any) => f.name)
          };
        }
      }

      res.status(200).json(ApiResponse.success(analysisResult, 'Project analysis completed'));
      
    } catch (error) {
      logger.error('Project analysis error:', error);
      res.status(500).json(ApiResponse.error(
        'Project analysis failed',
        'ANALYSIS_FAILED'
      ));
    }
  }
);

/**
 * Helper function to detect framework from package.json
 */
function detectFramework(packageJson: any): string {
  const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  if (dependencies.express) return 'express';
  if (dependencies.fastify) return 'fastify';
  if (dependencies.koa) return 'koa';
  if (dependencies.next) return 'nextjs';
  if (dependencies.nuxt) return 'nuxt';
  if (dependencies.react) return 'react';
  if (dependencies.vue) return 'vue';
  if (dependencies.angular) return 'angular';
  
  return 'nodejs';
}

export default router;