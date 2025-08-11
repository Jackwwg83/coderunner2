import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { ApiResponse } from '../utils/response';
import { logger } from '../utils/logger';

const router = Router();

// Apply authentication to all scaling routes
router.use(authenticateToken);

/**
 * GET /api/scaling/policies
 * Get all scaling policies
 */
router.get('/policies', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    
    // Mock scaling policies for now
    const policies = [
      {
        id: 'policy-1',
        name: 'CPU Based Auto-scaling',
        trigger: 'cpu_usage',
        threshold: 80,
        action: 'scale_up',
        cooldown: 300,
        enabled: true
      },
      {
        id: 'policy-2', 
        name: 'Memory Based Scaling',
        trigger: 'memory_usage',
        threshold: 75,
        action: 'scale_up',
        cooldown: 180,
        enabled: false
      }
    ];
    
    res.json(ApiResponse.policies(policies));
  } catch (error) {
    logger.error('Failed to get scaling policies:', error);
    res.status(500).json(ApiResponse.error(
      'Failed to get scaling policies',
      'GET_POLICIES_FAILED'
    ));
  }
});

/**
 * POST /api/scaling/policies
 * Create a new scaling policy
 */
router.post('/policies', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { name, trigger, threshold, action, cooldown } = req.body;
    
    // Input validation
    if (!name || !trigger || !threshold || !action) {
      return res.status(400).json(ApiResponse.error(
        'Name, trigger, threshold, and action are required',
        'INVALID_INPUT'
      ));
    }
    
    // Create mock policy
    const newPolicy = {
      id: `policy-${Date.now()}`,
      name,
      trigger,
      threshold,
      action,
      cooldown: cooldown || 300,
      enabled: true,
      createdAt: new Date().toISOString()
    };
    
    res.status(201).json(ApiResponse.success(
      newPolicy,
      'Scaling policy created successfully'
    ));
  } catch (error) {
    logger.error('Failed to create scaling policy:', error);
    res.status(500).json(ApiResponse.error(
      'Failed to create scaling policy',
      'CREATE_POLICY_FAILED'
    ));
  }
});

export default router;