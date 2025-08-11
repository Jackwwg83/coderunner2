import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { DatabaseService } from '../../src/services/database';
import { routes } from '../../src/routes';

// Load test environment variables
dotenv.config({ path: '.env.test' });

/**
 * Creates a test Express application with all middleware and routes
 */
export function createTestApp(): Express {
  const app = express();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: false, // Disabled for testing
  }));

  // CORS middleware
  app.use(cors({
    origin: process.env.NODE_ENV === 'test' ? '*' : process.env.FRONTEND_URL,
    credentials: true,
  }));

  // Request parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Logging middleware (only in non-test or explicit test debug)
  if (process.env.TEST_DEBUG === 'true') {
    app.use(morgan('combined'));
  }

  // Health check endpoint (before auth middleware)
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      environment: 'test'
    });
  });

  // API routes
  app.use('/api', routes);

  // Error handling middleware
  app.use((error: any, req: any, res: any, next: any) => {
    console.error('Test app error:', error);
    
    if (res.headersSent) {
      return next(error);
    }

    const status = error.status || error.statusCode || 500;
    const message = error.message || 'Internal server error';

    res.status(status).json({
      error: message,
      ...(process.env.NODE_ENV === 'test' && { stack: error.stack })
    });
  });

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      error: 'Not found',
      path: req.originalUrl
    });
  });

  return app;
}

/**
 * Initializes test database connection
 */
export async function initializeTestDatabase(): Promise<DatabaseService> {
  const db = DatabaseService.getInstance();
  
  // Override connection string for tests
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 
    'postgres://test:test@localhost:5432/coderunner_test';
  
  await db.connect();
  
  return db;
}

/**
 * Cleans up test database
 */
export async function cleanupTestDatabase(): Promise<void> {
  const db = DatabaseService.getInstance();
  
  try {
    // Clean up test data in reverse dependency order
    await db.query('TRUNCATE TABLE deployment_logs CASCADE');
    await db.query('TRUNCATE TABLE scaling_events CASCADE');
    await db.query('TRUNCATE TABLE scaling_policies CASCADE');
    await db.query('TRUNCATE TABLE environment_variables CASCADE');
    await db.query('TRUNCATE TABLE environment_configs CASCADE');
    await db.query('TRUNCATE TABLE deployments CASCADE');
    await db.query('TRUNCATE TABLE projects CASCADE');
    await db.query('TRUNCATE TABLE users CASCADE');
    
    console.log('Test database cleaned up');
  } catch (error) {
    console.error('Error cleaning up test database:', error);
  } finally {
    await db.disconnect();
  }
}

/**
 * Sets up test environment variables
 */
export function setupTestEnvironment(): void {
  // Ensure test environment
  process.env.NODE_ENV = 'test';
  
  // Database
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 
    'postgres://test:test@localhost:5432/coderunner_test';
  
  // JWT
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key';
  process.env.JWT_EXPIRES_IN = '1h';
  
  // Encryption
  process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-encryption-key-32-characters';
  
  // Disable external services
  process.env.AGENTSPHERE_API_KEY = 'test-agentsphere-key';
  process.env.DISABLE_EXTERNAL_CALLS = 'true';
  
  // Logging
  process.env.LOG_LEVEL = 'error'; // Reduce noise in tests
  
  // Performance
  process.env.RATE_LIMIT_ENABLED = 'false'; // Disable for tests
}

/**
 * Waits for a condition to be true with timeout
 */
export function waitFor(
  condition: () => boolean | Promise<boolean>, 
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const check = async () => {
      try {
        const result = await condition();
        if (result) {
          resolve();
          return;
        }
      } catch (error) {
        // Continue checking unless timeout exceeded
      }
      
      if (Date.now() - startTime > timeout) {
        reject(new Error(`Timeout waiting for condition after ${timeout}ms`));
        return;
      }
      
      setTimeout(check, interval);
    };
    
    check();
  });
}

/**
 * Generates test data with proper types
 */
export function generateTestData() {
  const timestamp = Date.now();
  
  return {
    user: {
      name: `Test User ${timestamp}`,
      email: `test-${timestamp}@coderunner.io`,
      password: 'TestPassword123!',
    },
    
    project: {
      name: `Test Project ${timestamp}`,
      description: `Test project created at ${new Date().toISOString()}`,
    },
    
    deployment: {
      name: `Test Deployment ${timestamp}`,
      manifest: {
        version: '1.0',
        name: `test-app-${timestamp}`,
        type: 'nodejs',
        runtime: { version: '18' },
        start: { command: 'npm start', port: 8080 },
        resources: { cpu: 0.5, memory: 512 },
        environment: {
          NODE_ENV: 'test',
          TEST_VAR: 'test-value'
        }
      },
    },
    
    configuration: {
      development: [
        {
          key: 'DEV_TEST_VAR',
          value: 'dev-test-value',
          description: 'Development test variable',
          isRequired: false,
          variableType: 'string'
        }
      ],
      
      production: [
        {
          key: 'PROD_SECRET_KEY',
          value: 'prod-secret-value',
          description: 'Production secret key',
          isSecret: true,
          isRequired: true,
          variableType: 'secret'
        }
      ]
    },
    
    scalingPolicy: {
      name: `Test Scaling Policy ${timestamp}`,
      metricType: 'cpu',
      threshold: 75,
      scaleDirection: 'out',
      scaleAmount: 2,
      cooldownPeriod: 300
    }
  };
}