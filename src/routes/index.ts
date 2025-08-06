import { Router } from 'express';
import { ApiResponse } from '../types/index';
import authRoutes from './auth';

const router = Router();

// API version and info
router.get('/', (_req, res) => {
  const response: ApiResponse = {
    success: true,
    message: 'CodeRunner API is running',
    data: {
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      endpoints: {
        auth: '/api/auth - Authentication (✅ Implemented)',
        projects: '/api/projects - Coming in Phase 1',
        executions: '/api/executions - Coming in Phase 1',
        templates: '/api/templates - Coming in Phase 1',
        users: '/api/users - Coming in Phase 1'
      }
    },
    timestamp: new Date()
  };
  
  res.json(response);
});

// Health check endpoint
router.get('/health', (_req, res) => {
  const response: ApiResponse = {
    success: true,
    message: 'API is healthy',
    data: {
      status: 'OK',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    },
    timestamp: new Date()
  };
  
  res.json(response);
});

// Route modules
router.use('/auth', authRoutes);
// TODO: Add remaining route modules when implemented
// router.use('/projects', projectRoutes);
// router.use('/executions', executionRoutes);
// router.use('/templates', templateRoutes);
// router.use('/users', userRoutes);

// Placeholder routes for future implementation
const placeholderRoutes = [
  { path: '/projects', description: 'Project management endpoints' },
  { path: '/executions', description: 'Code execution endpoints' },
  { path: '/templates', description: 'Project template endpoints' },
  { path: '/users', description: 'User profile and settings endpoints' }
];

placeholderRoutes.forEach(route => {
  router.all(route.path + '*', (_req, res) => {
    res.status(501).json({
      success: false,
      error: 'Not Implemented',
      message: `${route.description} - Coming soon in Phase 1`,
      timestamp: new Date()
    });
  });
});

export default router;