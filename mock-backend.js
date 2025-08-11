#!/usr/bin/env node

const express = require('express');
const cors = require('cors');

const app = express();
const port = 8080;

// CORS configuration
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

app.use(express.json());

// Health endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '2.0.0',
    environment: 'development'
  });
});

// Database templates endpoint
app.get('/api/orchestrator/templates', (req, res) => {
  res.json([
    {
      id: 'postgres-small',
      name: 'PostgreSQL Small',
      type: 'postgresql',
      description: 'Small PostgreSQL instance for development',
      cpu: 1,
      memory: 2048,
      storage: 20
    },
    {
      id: 'postgres-medium',
      name: 'PostgreSQL Medium',
      type: 'postgresql', 
      description: 'Medium PostgreSQL instance for production',
      cpu: 2,
      memory: 4096,
      storage: 50
    },
    {
      id: 'redis-small',
      name: 'Redis Small',
      type: 'redis',
      description: 'Small Redis instance for caching',
      cpu: 1,
      memory: 1024,
      storage: 10
    }
  ]);
});

// Database deployments endpoint
app.get('/api/orchestrator/deployments', (req, res) => {
  res.json([
    {
      id: 'deploy-001',
      name: 'Production Database',
      type: 'postgresql',
      status: 'running',
      created_at: new Date(Date.now() - 86400000).toISOString(),
      updated_at: new Date().toISOString(),
      template: 'postgres-medium',
      connection: {
        host: 'db-prod-001.example.com',
        port: 5432,
        database: 'app_production'
      }
    },
    {
      id: 'deploy-002',
      name: 'Dev Redis Cache',
      type: 'redis',
      status: 'running',
      created_at: new Date(Date.now() - 3600000).toISOString(),
      updated_at: new Date().toISOString(),
      template: 'redis-small',
      connection: {
        host: 'redis-dev-002.example.com',
        port: 6379
      }
    }
  ]);
});

// Deploy endpoint
app.post('/api/orchestrator/deploy', (req, res) => {
  const deployment = {
    id: 'deploy-' + Math.random().toString(36).substr(2, 9),
    name: req.body.name || 'New Database',
    type: req.body.template || 'postgresql',
    status: 'deploying',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    template: req.body.template
  };
  
  console.log('Deployment request received:', req.body);
  res.status(201).json(deployment);
});

// Auth endpoints
app.post('/api/auth/login', (req, res) => {
  res.json({
    success: true,
    token: 'mock-jwt-token',
    user: {
      id: '1',
      email: req.body.email,
      name: 'Test User'
    }
  });
});

app.get('/api/auth/verify', (req, res) => {
  res.json({
    valid: true,
    user: {
      id: '1',
      email: 'test@example.com',
      name: 'Test User'
    }
  });
});

// System status
app.get('/api/websocket/status', (req, res) => {
  res.json({
    connected: true,
    clients: 0,
    uptime: process.uptime()
  });
});

// Catch-all for API routes
app.use('/api/*', (req, res) => {
  console.log(`API endpoint not found: ${req.method} ${req.path}`);
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
});

app.listen(port, () => {
  console.log(`🚀 Mock Backend running on http://localhost:${port}`);
  console.log(`📡 Health check: http://localhost:${port}/api/health`);
  console.log(`🔥 Accepting requests from frontend on port 3000`);
});