import request from 'supertest';
import express from 'express';
import router from '../../src/routes/index';
import { DatabaseService } from '../../src/services/database';

// Mock dependencies
jest.mock('../../src/services/database');

describe('Main Routes', () => {
  let app: express.Application;
  let mockDb: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    // Create Express app with main routes
    app = express();
    app.use(express.json());
    app.use('/api', router);

    // Clear mocks
    jest.clearAllMocks();

    // Mock DatabaseService
    mockDb = {
      getInstance: jest.fn(),
      healthCheck: jest.fn(),
    } as any;

    (DatabaseService.getInstance as jest.Mock).mockReturnValue(mockDb);
  });

  describe('GET /api/health', () => {
    test('should return health status successfully', async () => {
      const mockHealthCheck = {
        status: 'healthy',
        database: 'connected',
        timestamp: new Date(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
      };

      mockDb.healthCheck.mockResolvedValue(mockHealthCheck);

      const response = await request(app)
        .get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        status: 'healthy',
        services: expect.objectContaining({
          database: mockHealthCheck
        }),
        system: expect.objectContaining({
          uptime: expect.any(Number),
          memory: expect.any(Object),
          version: expect.any(String)
        })
      });
    });

    test('should handle database health check failure', async () => {
      mockDb.healthCheck.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/health');

      expect(response.status).toBe(503);
      expect(response.body.success).toBe(false);
      expect(response.body.data.status).toBe('unhealthy');
    });
  });

  describe('GET /api/status', () => {
    test('should return basic status information', async () => {
      const response = await request(app)
        .get('/api/status');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'running',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        environment: process.env.NODE_ENV || 'development'
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/nonexistent-route');

      expect(response.status).toBe(404);
    });

    test('should handle internal server errors gracefully', async () => {
      // Mock a service that throws an error
      mockDb.healthCheck.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const response = await request(app)
        .get('/api/health');

      expect(response.status).toBe(503);
      expect(response.body.success).toBe(false);
    });
  });
});