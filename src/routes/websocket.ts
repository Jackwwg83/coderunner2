import express from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { WebSocketService } from '../services/websocket';
import { LogStreamManager } from '../services/logStream';
import { AuthenticatedRequest } from '../types';

const router = express.Router();

/**
 * @route GET /api/websocket/status
 * @desc Get WebSocket server status and metrics
 * @access Private
 */
router.get('/status', AuthMiddleware.authenticateToken, async (_req: AuthenticatedRequest, res) => {
  try {
    const wsService = WebSocketService.getInstance();
    const logStreamManager = LogStreamManager.getInstance();
    
    // Get WebSocket metrics
    const wsMetrics = wsService.getMetrics();
    const connectionInfo = wsService.getConnectionInfo();
    
    // Get log stream statistics
    const logStats = logStreamManager.getOverallStats();
    const activeDeployments = logStreamManager.getActiveDeployments();
    
    const status = {
      websocket: {
        status: 'active',
        metrics: wsMetrics,
        connections: connectionInfo
      },
      logStream: {
        status: 'active',
        statistics: logStats,
        activeDeployments: activeDeployments.length,
        deployments: activeDeployments
      },
      server: {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        nodeVersion: process.version,
        memoryUsage: process.memoryUsage()
      }
    };
    
    res.json({
      success: true,
      data: status,
      message: 'WebSocket status retrieved successfully'
    });
    
  } catch (error) {
    console.error('Error getting WebSocket status:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get WebSocket status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/websocket/deployments/:deploymentId/logs
 * @desc Get cached logs for a deployment
 * @access Private
 */
router.get('/deployments/:deploymentId/logs', AuthMiddleware.authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { deploymentId } = req.params;
    const userId = req.user!.userId;
    
    // Parse query parameters
    const tail = parseInt(req.query.tail as string) || 50;
    const level = req.query.level ? (req.query.level as string).split(',') : undefined;
    const source = req.query.source ? (req.query.source as string).split(',') : undefined;
    const search = req.query.search as string;
    const tags = req.query.tags ? (req.query.tags as string).split(',') : undefined;
    
    let startTime: Date | undefined;
    let endTime: Date | undefined;
    
    if (req.query.startTime) {
      startTime = new Date(req.query.startTime as string);
    }
    
    if (req.query.endTime) {
      endTime = new Date(req.query.endTime as string);
    }
    
    // Validate deployment access (same logic as WebSocket service)
    const { DatabaseService } = require('../services/database');
    const db = DatabaseService.getInstance();
    
    const deployment = await db.getDeploymentById(deploymentId);
    if (!deployment) {
      return res.status(404).json({
        success: false,
        error: 'Deployment not found'
      });
    }
    
    const project = await db.getProjectById(deployment.project_id);
    if (!project || project.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to deployment'
      });
    }
    
    // Get logs from LogStreamManager
    const logStreamManager = LogStreamManager.getInstance();
    const logs = logStreamManager.getLogs(deploymentId, {
      deploymentId,
      tail,
      level: level as any,
      source: source as any,
      ...(startTime && { startTime }),
      ...(endTime && { endTime }),
      ...(search && { search }),
      ...(tags && { tags })
    });
    
    // Get deployment statistics
    const stats = logStreamManager.getStats(deploymentId);
    
    res.json({
      success: true,
      data: {
        deploymentId,
        logs,
        statistics: stats,
        totalLogs: logs.length,
        filters: {
          tail,
          level,
          source,
          search,
          tags,
          startTime: startTime?.toISOString(),
          endTime: endTime?.toISOString()
        }
      },
      message: 'Deployment logs retrieved successfully'
    });
    
  } catch (error) {
    console.error('Error getting deployment logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get deployment logs',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return;
  }
});

/**
 * @route GET /api/websocket/deployments/:deploymentId/stats
 * @desc Get log streaming statistics for a deployment
 * @access Private
 */
router.get('/deployments/:deploymentId/stats', AuthMiddleware.authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { deploymentId } = req.params;
    const userId = req.user!.userId;
    
    // Validate deployment access
    const { DatabaseService } = require('../services/database');
    const db = DatabaseService.getInstance();
    
    const deployment = await db.getDeploymentById(deploymentId);
    if (!deployment) {
      return res.status(404).json({
        success: false,
        error: 'Deployment not found'
      });
    }
    
    const project = await db.getProjectById(deployment.project_id);
    if (!project || project.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to deployment'
      });
    }
    
    // Get statistics from LogStreamManager
    const logStreamManager = LogStreamManager.getInstance();
    const stats = logStreamManager.getStats(deploymentId);
    const hasBuffer = logStreamManager.hasBuffer(deploymentId);
    
    res.json({
      success: true,
      data: {
        deploymentId,
        hasActiveBuffer: hasBuffer,
        statistics: stats || {
          deploymentId,
          totalLogs: 0,
          bufferSize: 0,
          subscriberCount: 0,
          lastActivity: null,
          logRate: 0,
          avgLatency: 0
        }
      },
      message: 'Deployment statistics retrieved successfully'
    });
    
  } catch (error) {
    console.error('Error getting deployment stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get deployment statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return;
  }
});

/**
 * @route POST /api/websocket/deployments/:deploymentId/logs
 * @desc Add a log entry to a deployment (for testing/admin purposes)
 * @access Private
 */
router.post('/deployments/:deploymentId/logs', AuthMiddleware.authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { deploymentId } = req.params;
    const userId = req.user!.userId;
    const { level, message, source = 'system', data, tags } = req.body;
    
    // Validate required fields
    if (!level || !message) {
      return res.status(400).json({
        success: false,
        error: 'Level and message are required'
      });
    }
    
    // Validate level
    const validLevels = ['info', 'warn', 'error', 'debug', 'trace'];
    if (!validLevels.includes(level)) {
      return res.status(400).json({
        success: false,
        error: `Level must be one of: ${validLevels.join(', ')}`
      });
    }
    
    // Validate source
    const validSources = ['system', 'application', 'build', 'deployment'];
    if (!validSources.includes(source)) {
      return res.status(400).json({
        success: false,
        error: `Source must be one of: ${validSources.join(', ')}`
      });
    }
    
    // Validate deployment access
    const { DatabaseService } = require('../services/database');
    const db = DatabaseService.getInstance();
    
    const deployment = await db.getDeploymentById(deploymentId);
    if (!deployment) {
      return res.status(404).json({
        success: false,
        error: 'Deployment not found'
      });
    }
    
    const project = await db.getProjectById(deployment.project_id);
    if (!project || project.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to deployment'
      });
    }
    
    // Add log entry
    const logStreamManager = LogStreamManager.getInstance();
    
    let logEntry;
    if (source === 'system') {
      logEntry = logStreamManager.createSystemLog(deploymentId, level, message, data);
    } else {
      logEntry = logStreamManager.createApplicationLog(deploymentId, level, message, data);
    }
    
    // Add tags if provided
    if (tags && Array.isArray(tags)) {
      logEntry.tags = [...(logEntry.tags || []), ...tags];
    }
    
    res.status(201).json({
      success: true,
      data: logEntry,
      message: 'Log entry added successfully'
    });
    
  } catch (error) {
    console.error('Error adding log entry:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add log entry',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return;
  }
});

/**
 * @route DELETE /api/websocket/deployments/:deploymentId/logs
 * @desc Clear logs for a deployment
 * @access Private
 */
router.delete('/deployments/:deploymentId/logs', AuthMiddleware.authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { deploymentId } = req.params;
    const userId = req.user!.userId;
    
    // Validate deployment access
    const { DatabaseService } = require('../services/database');
    const db = DatabaseService.getInstance();
    
    const deployment = await db.getDeploymentById(deploymentId);
    if (!deployment) {
      return res.status(404).json({
        success: false,
        error: 'Deployment not found'
      });
    }
    
    const project = await db.getProjectById(deployment.project_id);
    if (!project || project.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to deployment'
      });
    }
    
    // Clear logs
    const logStreamManager = LogStreamManager.getInstance();
    const cleared = logStreamManager.clearLogs(deploymentId);
    
    if (cleared) {
      res.json({
        success: true,
        message: 'Deployment logs cleared successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'No logs found for deployment'
      });
    }
    
  } catch (error) {
    console.error('Error clearing deployment logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear deployment logs',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return;
  }
});

/**
 * @route GET /api/websocket/connection-info
 * @desc Get information about current user's WebSocket connections
 * @access Private
 */
router.get('/connection-info', AuthMiddleware.authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const wsService = WebSocketService.getInstance();
    
    // Get overall connection info
    const connectionInfo = wsService.getConnectionInfo();
    
    // Filter user-specific information
    const userConnections = connectionInfo.connectionsByUser[userId] || 0;
    
    res.json({
      success: true,
      data: {
        userId,
        userConnections,
        totalConnections: connectionInfo.totalConnections,
        activeRooms: connectionInfo.activeRooms,
        serverMetrics: wsService.getMetrics()
      },
      message: 'Connection information retrieved successfully'
    });
    
  } catch (error) {
    console.error('Error getting connection info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get connection information',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return;
  }
});

export default router;