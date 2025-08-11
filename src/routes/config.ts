import { Router, Request, Response } from 'express';
import { AuthMiddleware } from '../middleware/auth';

const router = Router();

/**
 * GET /api/config
 * Get basic configuration (requires authentication)
 */
router.get('/',
  AuthMiddleware.authenticateToken,
  async (req: Request, res: Response) => {
  try {
    const config = {
      version: '2.0.0',
      environment: process.env.NODE_ENV || 'development',
      features: {
        authentication: true,
        deployment: true,
        websockets: true,
        monitoring: true
      },
      limits: {
        maxProjectSize: '10MB',
        maxProjects: {
          free: 3,
          personal: 10,
          team: -1
        }
      }
    };

    res.json({
      success: true,
      data: config,
      message: 'Configuration retrieved successfully',
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Config retrieval error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve configuration',
      code: 'CONFIG_ERROR',
      timestamp: new Date()
    });
  }
});

/**
 * GET /api/config/sensitive  
 * Protected sensitive configuration endpoint
 */
router.get('/sensitive',
  AuthMiddleware.authenticateToken,
  async (req: Request, res: Response) => {
    try {
      // Only allow admin users to access sensitive config
      if (req.user?.planType !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied - admin privileges required',
          code: 'ACCESS_DENIED',
          timestamp: new Date()
        });
      }

      // Return encrypted/masked sensitive data
      const sensitiveConfig = {
        database: {
          host: process.env.DB_HOST?.replace(/./g, '*') || 'hidden',
          port: process.env.DB_PORT || 5432,
          name: process.env.DB_NAME?.substring(0, 3) + '***' || 'hidden'
        },
        jwt: {
          algorithm: 'HS256',
          expiresIn: '7d'
        },
        external: {
          agentSphere: {
            connected: true,
            endpoint: 'https://api.agentsphere.ai'
          }
        }
      };

      res.json({
        success: true,
        data: sensitiveConfig,
        message: 'Sensitive configuration retrieved successfully',
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Sensitive config retrieval error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve sensitive configuration',
        code: 'SENSITIVE_CONFIG_ERROR',
        timestamp: new Date()
      });
    }
  }
);

export default router;