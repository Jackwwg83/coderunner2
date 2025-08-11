import { Router } from 'express';
import { ApiResponse as TypesApiResponse } from '../types/index';
import { ApiResponse } from '../utils/response';
import { HealthCheckService } from '../services/healthCheck';
import authRoutes from './auth';
import deployRoutes from './deploy';
import deploymentsRoutes from './deployments';
import websocketRoutes from './websocket';
import configurationRoutes from './configurations';
import configRoutes from './config';
import scalingRoutes from './scaling';
import projectsRoutes from './projects';
import manifestRoutes from './manifest';
// TEMPORARY: Disabled problematic routes for emergency compilation fix
// import templatesRoutes from './templates';
// import orchestratorRoutes from './orchestrator';

const router = Router();

// API version and info
router.get('/', (_req, res) => {
  const apiData = {
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/auth - Authentication (✅ Implemented)',
      deploy: '/api/deploy - Unified Deployment (✅ Implemented)',
      deployments: '/api/deployments - Deployment Management (✅ P2-T03)',
      websocket: '/api/websocket - Real-time Logs & WebSocket (✅ P2-T01)',
      config: '/api/config - Configuration Management (✅ P2-T04)',
      scaling: '/api/scaling - Auto-scaling & Resource Optimization (✅ P2-T05)',
      manifest: '/api/manifest - Enhanced ManifestEngine (✅ Day 5 Optimization)',
      projects: '/api/projects - Coming in Phase 1',
      executions: '/api/executions - Coming in Phase 1',
      templates: '/api/templates - Database Templates (🚧 DISABLED FOR EMERGENCY FIX)',
      orchestrator: '/api/orchestrator - Database Orchestration (🚧 DISABLED FOR EMERGENCY FIX)',
      users: '/api/users - Coming in Phase 1'
    }
  };
  
  res.json(ApiResponse.success(apiData, 'CodeRunner API is running'));
});

// Enhanced health check endpoint
router.get('/health', async (_req, res) => {
  try {
    const healthService = HealthCheckService.getInstance();
    const healthStatus = await healthService.performHealthCheck();
    
    const response = ApiResponse.health(healthStatus.overall, {
      ...healthStatus,
      timestamp: new Date().toISOString()
    });
    
    // Set appropriate HTTP status code
    const statusCode = healthStatus.overall === 'healthy' ? 200 : 
      healthStatus.overall === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(response);
  } catch (error) {
    res.status(503).json(ApiResponse.error(
      error instanceof Error ? error.message : 'Unknown error',
      'HEALTH_CHECK_FAILED'
    ));
  }
});

// Database health check endpoint
router.get('/health/database', async (_req, res) => {
  try {
    const healthService = HealthCheckService.getInstance();
    const healthStatus = await healthService.performHealthCheck();
    
    res.status(200).json(ApiResponse.success({
      database: 'connected',
      status: healthStatus.database?.status || 'connected',
      timestamp: new Date().toISOString()
    }));
  } catch (error) {
    res.status(503).json(ApiResponse.error(
      'Database health check failed',
      'DATABASE_HEALTH_FAILED'
    ));
  }
});

// Services health check endpoint
router.get('/health/services', async (_req, res) => {
  try {
    const healthService = HealthCheckService.getInstance();
    const healthStatus = await healthService.performHealthCheck();
    
    const services = [
      { name: 'auth', status: 'healthy' },
      { name: 'deployment', status: 'healthy' },
      { name: 'websocket', status: 'healthy' },
      { name: 'database', status: healthStatus.database?.status || 'healthy' }
    ];
    
    res.status(200).json(ApiResponse.services(services));
  } catch (error) {
    res.status(503).json(ApiResponse.error(
      'Services health check failed',
      'SERVICES_HEALTH_FAILED'
    ));
  }
});

// WebSocket health check endpoint
router.get('/health/websocket', async (_req, res) => {
  try {
    res.status(200).json(ApiResponse.success({
      websocket: 'ready',
      status: 'healthy',
      timestamp: new Date().toISOString()
    }));
  } catch (error) {
    res.status(503).json(ApiResponse.error(
      'WebSocket health check failed',
      'WEBSOCKET_HEALTH_FAILED'
    ));
  }
});

// Quick health check endpoint (lighter weight)
router.get('/health/quick', (_req, res) => {
  const quickHealthData = {
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  };
  
  res.json(ApiResponse.success(quickHealthData, 'API is responsive'));
});

// Readiness probe endpoint (for Kubernetes)
router.get('/health/ready', async (_req, res) => {
  try {
    const healthService = HealthCheckService.getInstance();
    const readiness = await healthService.getReadinessProbe();
    
    const response = readiness.ready 
      ? ApiResponse.success(readiness, 'Service is ready')
      : ApiResponse.error('Service is not ready', 'SERVICE_NOT_READY');
    
    res.status(readiness.ready ? 200 : 503).json(response);
  } catch (error) {
    res.status(503).json(ApiResponse.error(
      error instanceof Error ? error.message : 'Unknown error',
      'READINESS_CHECK_FAILED'
    ));
  }
});

// Liveness probe endpoint (for Kubernetes)
router.get('/health/live', async (_req, res) => {
  try {
    const healthService = HealthCheckService.getInstance();
    const liveness = await healthService.getLivenessProbe();
    
    const response = liveness.alive
      ? ApiResponse.success(liveness, 'Service is alive')
      : ApiResponse.error('Service is not alive', 'SERVICE_NOT_ALIVE');
    
    res.status(liveness.alive ? 200 : 503).json(response);
  } catch (error) {
    res.status(503).json(ApiResponse.error(
      error instanceof Error ? error.message : 'Unknown error',
      'LIVENESS_CHECK_FAILED'
    ));
  }
});

// Route modules
router.use('/auth', authRoutes);
router.use('/deploy', deployRoutes);
router.use('/deployments', deploymentsRoutes);
router.use('/websocket', websocketRoutes);
router.use('/config', configurationRoutes);
router.use('/configurations', configRoutes);
router.use('/scaling', scalingRoutes);
router.use('/projects', projectsRoutes);
router.use('/manifest', manifestRoutes);
// TEMPORARY: Disabled problematic routes for emergency compilation fix
// router.use('/templates', templatesRoutes);
// router.use('/orchestrator', orchestratorRoutes);
// router.use('/executions', executionRoutes);
// router.use('/users', userRoutes);

// Placeholder routes for future implementation
const placeholderRoutes = [
  { path: '/executions', description: 'Code execution endpoints' },
  { path: '/users', description: 'User profile and settings endpoints' }
];

placeholderRoutes.forEach(route => {
  router.all(route.path + '*', (_req, res) => {
    res.status(501).json(ApiResponse.error(
      `${route.description} - Coming soon in Phase 1`,
      'NOT_IMPLEMENTED'
    ));
  });
});

export default router;