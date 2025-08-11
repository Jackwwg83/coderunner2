/**
 * Test helper utilities for AgentSphere integration testing
 * Provides mocks, stubs, and test data generators
 */

import { jest } from '@jest/globals';
import { DeploymentStatus } from '../../src/types/index';

// Enhanced mock sandbox with more realistic behavior
export class MockSandbox {
  private static instances: MockSandbox[] = [];
  private static nextId = 1;
  
  public sandboxId: string;
  public info: {
    sandbox_id: string;
    status: 'running' | 'stopped' | 'failed' | 'starting';
    started_at: Date;
    end_at: Date;
    metadata: Record<string, any>;
  };
  
  public commands: {
    run: jest.MockedFunction<(command: string, options?: { background?: boolean }) => Promise<any>>;
  };
  
  public files: {
    write: jest.MockedFunction<(files: Array<{ path: string; data: string }>) => Promise<void>>;
    read: jest.MockedFunction<(path: string) => Promise<string>>;
  };

  constructor() {
    this.sandboxId = `test-sandbox-${MockSandbox.nextId++}`;
    this.info = {
      sandbox_id: this.sandboxId,
      status: 'starting',
      started_at: new Date(),
      end_at: new Date(Date.now() + 3600000), // 1 hour
      metadata: {}
    };

    this.commands = {
      run: jest.fn().mockImplementation(async (command: string, options?: { background?: boolean }) => {
        // Mock realistic command responses
        if (command === 'npm install') {
          return {
            stdout: 'added 150 packages from 200 contributors',
            stderr: '',
            exitCode: 0
          };
        }
        
        if (command.includes('node') || command.includes('start')) {
          return {
            stdout: 'Server running on port 3000',
            stderr: '',
            exitCode: 0,
            pid: Math.floor(Math.random() * 10000) + 1000
          };
        }
        
        if (command.includes('tail') && command.includes('log')) {
          return {
            stdout: [
              '[2024-01-01T00:00:00.000Z] INFO: Server started',
              '[2024-01-01T00:00:01.000Z] INFO: Database connected',
              '[2024-01-01T00:00:02.000Z] INFO: API endpoints registered',
              '[2024-01-01T00:00:03.000Z] INFO: Ready to accept connections'
            ].join('\n'),
            stderr: '',
            exitCode: 0
          };
        }
        
        return {
          stdout: `Command executed: ${command}`,
          stderr: '',
          exitCode: 0
        };
      })
    };

    this.files = {
      write: jest.fn().mockResolvedValue(undefined),
      read: jest.fn().mockImplementation(async (path: string) => {
        return `Mock content for ${path}`;
      })
    };

    MockSandbox.instances.push(this);
  }

  async initialize(config: {
    timeout?: number;
    metadata?: Record<string, any>;
    envs?: Record<string, string>;
  }): Promise<void> {
    this.info.metadata = { ...this.info.metadata, ...config.metadata };
    this.info.status = 'running';
    await new Promise(resolve => setTimeout(resolve, 100)); // Mock delay
  }

  getInfo() {
    return { ...this.info };
  }

  getHost(port: number): string {
    return `${this.sandboxId}.test-domain.com`;
  }

  async kill(): Promise<void> {
    this.info.status = 'stopped';
    this.info.end_at = new Date();
    const index = MockSandbox.instances.indexOf(this);
    if (index > -1) {
      MockSandbox.instances.splice(index, 1);
    }
  }

  static async list() {
    return MockSandbox.instances.map(instance => instance.info);
  }

  static async connect(sandboxId: string) {
    const existing = MockSandbox.instances.find(i => i.sandboxId === sandboxId);
    if (existing) {
      return existing;
    }
    
    // Create a mock connected sandbox
    const sandbox = new MockSandbox();
    sandbox.sandboxId = sandboxId;
    sandbox.info.sandbox_id = sandboxId;
    sandbox.info.status = 'running';
    return sandbox;
  }

  static reset() {
    MockSandbox.instances = [];
    MockSandbox.nextId = 1;
  }
}

// Mock sandbox class constructor
export const MockSandboxClass = jest.fn(() => new MockSandbox());
MockSandboxClass.list = jest.fn().mockImplementation(() => MockSandbox.list());
MockSandboxClass.connect = jest.fn().mockImplementation((id: string) => MockSandbox.connect(id));

// Test data generators
export class TestDataGenerator {
  static generateUserId(): string {
    return `test-user-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  }

  static generateProjectId(): string {
    return `test-project-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  }

  static generateSandboxId(): string {
    return `sb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  static generateDeploymentId(): string {
    return `dep-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  static createSimpleNodeJSProject() {
    return [
      {
        path: 'package.json',
        content: JSON.stringify({
          name: 'test-app',
          version: '1.0.0',
          main: 'index.js',
          scripts: {
            start: 'node index.js'
          },
          dependencies: {
            express: '^4.18.0'
          }
        })
      },
      {
        path: 'index.js',
        content: `
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({ message: 'Hello World', timestamp: new Date().toISOString() });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', uptime: process.uptime() });
});

app.listen(port, () => {
  console.log(\`Server running on port \${port}\`);
});
        `.trim()
      }
    ];
  }

  static createComplexNodeJSProject() {
    return [
      {
        path: 'package.json',
        content: JSON.stringify({
          name: 'complex-test-app',
          version: '1.0.0',
          main: 'server.js',
          scripts: {
            start: 'node server.js',
            dev: 'nodemon server.js',
            test: 'jest'
          },
          dependencies: {
            express: '^4.18.0',
            cors: '^2.8.5',
            helmet: '^7.0.0',
            morgan: '^1.10.0'
          },
          devDependencies: {
            nodemon: '^3.0.0',
            jest: '^29.0.0'
          }
        })
      },
      {
        path: 'server.js',
        content: `
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json({
    name: 'Complex Test App',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

app.get('/api/data', (req, res) => {
  res.json({
    data: [1, 2, 3, 4, 5],
    count: 5,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/echo', (req, res) => {
  res.json({
    echo: req.body,
    timestamp: new Date().toISOString()
  });
});

const server = app.listen(port, () => {
  console.log(\`Complex test server running on port \${port}\`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});
        `.trim()
      },
      {
        path: '.env.example',
        content: `
NODE_ENV=development
PORT=3000
API_KEY=your-api-key-here
DATABASE_URL=postgresql://localhost:5432/testdb
        `.trim()
      },
      {
        path: 'README.md',
        content: `
# Complex Test Application

A test application with multiple dependencies and middleware.

## Features
- Express.js with security middleware
- CORS support
- Request logging
- Health checks
- API endpoints

## Usage
\`\`\`bash
npm install
npm start
\`\`\`
        `.trim()
      }
    ];
  }

  static createManifestProject() {
    return [
      {
        path: 'manifest.yaml',
        content: `
name: test-manifest-app
description: Test application from manifest
version: 1.0.0

routes:
  - path: /
    method: GET
    response:
      message: Hello from Manifest App
      timestamp: "{{timestamp}}"
      
  - path: /health
    method: GET
    response:
      status: healthy
      service: manifest-app
      timestamp: "{{timestamp}}"
      
  - path: /api/users
    method: GET
    response:
      - id: 1
        name: John Doe
        email: john@example.com
      - id: 2
        name: Jane Smith
        email: jane@example.com
        
  - path: /api/users
    method: POST
    response:
      success: true
      message: User created successfully
      timestamp: "{{timestamp}}"
      
  - path: /api/config
    method: GET
    response:
      environment: "{{env.NODE_ENV}}"
      version: "1.0.0"
      debug: false

middleware:
  - cors: true
  - json: true
  - logging: true

environment:
  NODE_ENV: development
  PORT: 3000
  API_VERSION: v1
        `.trim()
      }
    ];
  }

  static createInvalidProject() {
    return [
      {
        path: 'package.json',
        content: '{ invalid json content'
      }
    ];
  }

  static createProjectWithMissingStart() {
    return [
      {
        path: 'package.json',
        content: JSON.stringify({
          name: 'no-start-script',
          version: '1.0.0',
          main: 'index.js'
          // Missing start script
        })
      },
      {
        path: 'index.js',
        content: 'console.log("Hello World");'
      }
    ];
  }
}

// Database mock helpers
export class DatabaseMockHelper {
  static createMockDeployment(overrides = {}) {
    return {
      id: TestDataGenerator.generateDeploymentId(),
      project_id: TestDataGenerator.generateProjectId(),
      status: DeploymentStatus.PENDING,
      runtime_type: 'template-nodejs-18',
      app_sandbox_id: null,
      public_url: null,
      created_at: new Date(),
      updated_at: new Date(),
      ...overrides
    };
  }

  static createMockRunningDeployment(overrides = {}) {
    const sandboxId = TestDataGenerator.generateSandboxId();
    return {
      id: TestDataGenerator.generateDeploymentId(),
      project_id: TestDataGenerator.generateProjectId(),
      status: DeploymentStatus.RUNNING,
      runtime_type: 'template-nodejs-18',
      app_sandbox_id: sandboxId,
      public_url: `https://${sandboxId}.test-domain.com`,
      created_at: new Date(Date.now() - 300000), // 5 minutes ago
      updated_at: new Date(),
      ...overrides
    };
  }

  static setupMockDatabase() {
    const mockDb = {
      createDeployment: jest.fn(),
      updateDeployment: jest.fn(),
      getDeploymentById: jest.fn(),
      query: jest.fn()
    };

    // Default implementations
    mockDb.createDeployment.mockImplementation((input) => 
      Promise.resolve(DatabaseMockHelper.createMockDeployment(input))
    );
    
    mockDb.updateDeployment.mockImplementation((id, updates) => 
      Promise.resolve({ id, ...updates })
    );
    
    mockDb.getDeploymentById.mockImplementation((id) => 
      Promise.resolve(DatabaseMockHelper.createMockRunningDeployment({ id }))
    );
    
    mockDb.query.mockResolvedValue({ rows: [] });

    return mockDb;
  }
}

// Configuration mock helpers
export class ConfigurationMockHelper {
  static setupMockConfiguration() {
    return {
      getConfigurationForDeployment: jest.fn().mockResolvedValue({
        variables: {
          NODE_ENV: 'development',
          API_KEY: 'test-api-key',
          DATABASE_URL: 'postgresql://test:test@localhost:5432/test'
        }
      }),
      getConfiguration: jest.fn().mockResolvedValue({}),
      setConfiguration: jest.fn().mockResolvedValue(true)
    };
  }
}

// Error simulation helpers
export class ErrorSimulator {
  static createTimeoutError(operation: string) {
    const error = new Error(`${operation} timed out`);
    error.name = 'TimeoutError';
    return error;
  }

  static createNetworkError(operation: string) {
    const error = new Error(`Network error during ${operation}`);
    error.name = 'NetworkError';
    return error;
  }

  static createSandboxError(operation: string) {
    const error = new Error(`Sandbox error during ${operation}`);
    error.name = 'SandboxError';
    return error;
  }

  static createNotFoundError(resource: string) {
    const error = new Error(`${resource} not found`);
    error.name = 'NotFoundError';
    return error;
  }

  static simulateIntermittentFailure(successRate = 0.7) {
    return Math.random() < successRate;
  }
}

// Test assertion helpers
export class TestAssertions {
  static assertDeploymentStructure(deployment: any) {
    expect(deployment).toBeDefined();
    expect(deployment.id).toBeDefined();
    expect(deployment.url).toBeDefined();
    expect(deployment.sandboxId).toBeDefined();
    expect(deployment.status).toBeDefined();
  }

  static assertMonitoringStructure(monitoring: any) {
    expect(monitoring).toBeDefined();
    expect(monitoring.status).toBeDefined();
    expect(monitoring.health).toBeDefined();
    expect(monitoring.metrics).toBeDefined();
    expect(monitoring.logs).toBeDefined();
    expect(Array.isArray(monitoring.logs)).toBe(true);
  }

  static assertCleanupResultStructure(result: any) {
    expect(result).toBeDefined();
    expect(typeof result.cleaned).toBe('number');
    expect(Array.isArray(result.errors)).toBe(true);
    expect(Array.isArray(result.details)).toBe(true);
  }

  static assertSandboxListStructure(sandboxes: any[]) {
    expect(Array.isArray(sandboxes)).toBe(true);
    if (sandboxes.length > 0) {
      sandboxes.forEach(sandbox => {
        expect(sandbox.sandboxId).toBeDefined();
        expect(sandbox.metadata).toBeDefined();
        expect(sandbox.startedAt).toBeDefined();
        expect(sandbox.endAt).toBeDefined();
      });
    }
  }

  static assertExecutionStatsStructure(stats: any) {
    expect(stats).toBeDefined();
    expect(typeof stats.totalExecutions).toBe('number');
    expect(typeof stats.activeExecutions).toBe('number');
    expect(typeof stats.queuedExecutions).toBe('number');
    expect(typeof stats.averageExecutionTime).toBe('number');
  }
}

// Performance testing helpers
export class PerformanceTestHelper {
  static async measureExecutionTime<T>(operation: () => Promise<T>): Promise<{ result: T; executionTime: number }> {
    const startTime = Date.now();
    const result = await operation();
    const executionTime = Date.now() - startTime;
    return { result, executionTime };
  }

  static async runConcurrentTests<T>(
    operations: (() => Promise<T>)[],
    maxConcurrency = 5
  ): Promise<{ results: T[]; errors: Error[]; executionTime: number }> {
    const startTime = Date.now();
    const results: T[] = [];
    const errors: Error[] = [];

    // Run operations in batches
    for (let i = 0; i < operations.length; i += maxConcurrency) {
      const batch = operations.slice(i, i + maxConcurrency);
      const batchPromises = batch.map(async (op, index) => {
        try {
          const result = await op();
          results[i + index] = result;
        } catch (error) {
          errors.push(error as Error);
        }
      });

      await Promise.all(batchPromises);
    }

    const executionTime = Date.now() - startTime;
    return { results: results.filter(Boolean), errors, executionTime };
  }

  static createLoadTestScenario(
    operationFactory: () => () => Promise<any>,
    concurrency: number,
    duration: number
  ) {
    const operations = Array.from({ length: concurrency }, operationFactory);
    
    return {
      operations,
      run: async () => {
        const endTime = Date.now() + duration;
        const results: any[] = [];
        const errors: Error[] = [];

        while (Date.now() < endTime) {
          const batchResults = await PerformanceTestHelper.runConcurrentTests(operations, concurrency);
          results.push(...batchResults.results);
          errors.push(...batchResults.errors);
          
          // Small delay to prevent overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        return {
          totalOperations: results.length,
          successfulOperations: results.length - errors.length,
          errorCount: errors.length,
          successRate: ((results.length - errors.length) / results.length) * 100,
          errors
        };
      }
    };
  }
}

// Test setup and teardown helpers
export class TestSetupHelper {
  static setupBeforeAll() {
    // Global test setup
    jest.setTimeout(30000); // 30 second timeout for integration tests
  }

  static setupBeforeEach() {
    // Reset mocks before each test
    jest.clearAllMocks();
    MockSandbox.reset();
  }

  static setupAfterEach() {
    // Cleanup after each test
    MockSandbox.reset();
  }

  static setupAfterAll() {
    // Global cleanup
    jest.clearAllTimers();
    jest.restoreAllMocks();
  }

  static createTestEnvironment() {
    const mockDb = DatabaseMockHelper.setupMockDatabase();
    const mockConfig = ConfigurationMockHelper.setupMockConfiguration();
    const testUserId = TestDataGenerator.generateUserId();
    const testProjectId = TestDataGenerator.generateProjectId();

    return {
      mockDb,
      mockConfig,
      testUserId,
      testProjectId,
      sampleFiles: TestDataGenerator.createSimpleNodeJSProject(),
      complexFiles: TestDataGenerator.createComplexNodeJSProject(),
      manifestFiles: TestDataGenerator.createManifestProject()
    };
  }
}