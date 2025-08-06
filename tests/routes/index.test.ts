import request from 'supertest';
import express from 'express';
import router from '../../src/routes/index';

/**
 * Routes Index Integration Tests
 * 
 * Basic integration tests for the main API router endpoints:
 * - API info endpoint
 * - Health check endpoint
 * - Placeholder routes for future implementation
 */

describe('Routes Index', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api', router);
  });

  describe('GET /', () => {
    it('should return API information', async () => {
      const response = await request(app)
        .get('/api/')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'CodeRunner API is running');
      expect(response.body.data).toHaveProperty('version', '1.0.0');
      expect(response.body.data).toHaveProperty('environment');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data).toHaveProperty('endpoints');
      expect(response.body).toHaveProperty('timestamp');

      // Check endpoints structure
      const endpoints = response.body.data.endpoints;
      expect(endpoints).toHaveProperty('auth');
      expect(endpoints).toHaveProperty('projects');
      expect(endpoints).toHaveProperty('executions');
      expect(endpoints).toHaveProperty('templates');
      expect(endpoints).toHaveProperty('users');
    });

    it('should return correct environment in response', async () => {
      const response = await request(app)
        .get('/api/')
        .expect(200);

      expect(response.body.data.environment).toBe('test');
    });

    it('should return valid timestamp', async () => {
      const response = await request(app)
        .get('/api/')
        .expect(200);

      const timestamp = new Date(response.body.timestamp);
      const dataTimestamp = new Date(response.body.data.timestamp);
      
      expect(timestamp).toBeInstanceOf(Date);
      expect(dataTimestamp).toBeInstanceOf(Date);
      expect(isNaN(timestamp.getTime())).toBe(false);
      expect(isNaN(dataTimestamp.getTime())).toBe(false);
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'API is healthy');
      expect(response.body.data).toHaveProperty('status', 'OK');
      expect(response.body.data).toHaveProperty('uptime');
      expect(response.body.data).toHaveProperty('memory');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should return valid uptime', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(typeof response.body.data.uptime).toBe('number');
      expect(response.body.data.uptime).toBeGreaterThan(0);
    });

    it('should return valid memory usage', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      const memory = response.body.data.memory;
      expect(memory).toHaveProperty('rss');
      expect(memory).toHaveProperty('heapTotal');
      expect(memory).toHaveProperty('heapUsed');
      expect(memory).toHaveProperty('external');
      expect(typeof memory.rss).toBe('number');
      expect(typeof memory.heapTotal).toBe('number');
      expect(typeof memory.heapUsed).toBe('number');
    });
  });

  describe('Placeholder routes', () => {
    const placeholderPaths = [
      '/projects',
      '/executions', 
      '/templates',
      '/users'
    ];

    placeholderPaths.forEach(path => {
      it(`should return 501 for GET ${path}`, async () => {
        const response = await request(app)
          .get(`/api${path}`)
          .expect(501);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('error', 'Not Implemented');
        expect(response.body).toHaveProperty('message');
        expect(response.body).toHaveProperty('timestamp');
        expect(response.body.message).toContain('Coming soon in Phase 1');
      });

      it(`should return 501 for POST ${path}`, async () => {
        const response = await request(app)
          .post(`/api${path}`)
          .send({ test: 'data' })
          .expect(501);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('error', 'Not Implemented');
      });

      it(`should return 501 for PUT ${path}`, async () => {
        const response = await request(app)
          .put(`/api${path}`)
          .send({ test: 'data' })
          .expect(501);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('error', 'Not Implemented');
      });

      it(`should return 501 for DELETE ${path}`, async () => {
        const response = await request(app)
          .delete(`/api${path}`)
          .expect(501);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('error', 'Not Implemented');
      });
    });

    it('should handle nested placeholder routes', async () => {
      const response = await request(app)
        .get('/api/projects/some/nested/path')
        .expect(501);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Not Implemented');
      expect(response.body.message).toContain('Project management endpoints');
    });

    it('should handle deep nested placeholder routes', async () => {
      const response = await request(app)
        .get('/api/executions/user/123/project/456/run')
        .expect(501);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Not Implemented');
      expect(response.body.message).toContain('Code execution endpoints');
    });
  });

  describe('Invalid routes', () => {
    it('should handle non-existent routes', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      // Express default 404 behavior
      expect(response.text).toContain('Cannot GET /api/nonexistent');
    });

    it('should handle invalid methods on valid paths', async () => {
      const response = await request(app)
        .patch('/api/')
        .expect(404);

      expect(response.text).toContain('Cannot PATCH /api/');
    });
  });

  describe('Router structure', () => {
    it('should mount auth routes correctly', async () => {
      // Test that auth routes are mounted (we won't test auth functionality here)
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password' });

      // Should get a response from auth routes (not 404)
      expect(response.status).not.toBe(404);
    });
  });
});