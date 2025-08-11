# 📝 Test Writing Guide for CodeRunner v2.0

**Purpose**: Guidelines for writing high-quality, maintainable tests  
**Audience**: Developers contributing to CodeRunner v2.0  
**Last Updated**: 2025-08-08  

## 🎯 Testing Philosophy

### Core Principles

1. **Test Behavior, Not Implementation**: Focus on what the code does, not how it does it
2. **Test User Journeys**: Ensure critical user paths work end-to-end  
3. **Fail Fast, Fail Clear**: Tests should quickly identify what broke and why
4. **Maintainable Tests**: Tests should be easy to understand and modify
5. **Test Isolation**: Each test should be independent and not affect others

### Testing Pyramid

```
    /\     E2E Tests (Few, Slow, High Value)
   /  \    - Complete user journeys
  /____\   - Cross-browser compatibility
 /      \  
/________\  Integration Tests (Some, Medium Speed)
\        /  - Component interactions  
 \______/   - API endpoint testing
 \      /   
  \____/    Unit Tests (Many, Fast, Focused)
  \    /    - Individual functions
   \__/     - Business logic
```

## 📋 Test Structure & Naming

### File Organization

```
tests/
├── unit/                     # Unit tests
│   ├── services/            # Service layer tests
│   ├── middleware/          # Middleware tests  
│   └── utils/               # Utility function tests
├── integration/             # Integration tests
│   ├── api-endpoints.test.ts
│   └── websocket.test.ts
├── e2e/                     # End-to-end tests
│   ├── authentication.spec.ts
│   ├── deployments.spec.ts
│   └── realtime-logs.spec.ts
├── performance/             # Performance tests
│   └── load-tests.yml
└── helpers/                 # Test utilities
    ├── test-factories.ts
    └── test-app.ts
```

### Naming Conventions

#### Test Files:
- Unit tests: `*.test.ts`
- Integration tests: `*.test.ts`  
- E2E tests: `*.spec.ts`
- Performance tests: `*.yml` or `*.js`

#### Test Descriptions:
```typescript
// ✅ Good: Describes behavior and expected outcome
describe('AuthService', () => {
  describe('login', () => {
    it('should return user data and token for valid credentials', () => {});
    it('should throw error for invalid password', () => {});
    it('should handle non-existent user gracefully', () => {});
  });
});

// ❌ Bad: Describes implementation details
describe('AuthService', () => {
  describe('login method', () => {
    it('should call bcrypt.compare', () => {});
    it('should query database', () => {});
  });
});
```

## 🔧 Writing Unit Tests

### Structure: Arrange-Act-Assert (AAA)

```typescript
import { AuthService } from '../../src/services/auth';
import { DatabaseService } from '../../src/services/database';

describe('AuthService', () => {
  let authService: AuthService;
  let mockDb: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    // Arrange: Setup test dependencies
    mockDb = {
      query: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn()
    } as any;
    
    authService = new AuthService(mockDb);
  });

  describe('register', () => {
    it('should create user with hashed password', async () => {
      // Arrange
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      };
      
      const mockUser = { id: '123', name: 'Test User', email: 'test@example.com' };
      mockDb.query.mockResolvedValue({ rows: [mockUser] });

      // Act
      const result = await authService.register(
        userData.email, 
        userData.password, 
        userData.name
      );

      // Assert
      expect(result).toHaveProperty('id', '123');
      expect(result).toHaveProperty('token');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        expect.arrayContaining([userData.name, userData.email, expect.any(String)])
      );
    });

    it('should reject duplicate email addresses', async () => {
      // Arrange
      const duplicateError = new Error('duplicate key value violates unique constraint');
      mockDb.query.mockRejectedValue(duplicateError);

      // Act & Assert
      await expect(authService.register('test@example.com', 'pass', 'Test'))
        .rejects
        .toThrow('Email already exists');
    });
  });
});
```

### Mocking Best Practices

#### 1. Mock External Dependencies:
```typescript
// ✅ Good: Mock external services
jest.mock('../../src/services/database');
jest.mock('agentsphere-js');

// ✅ Good: Mock with proper types
const mockDb = {
  query: jest.fn().mockImplementation(() => Promise.resolve({ rows: [] }))
} as jest.Mocked<DatabaseService>;
```

#### 2. Use Factory Functions for Test Data:
```typescript
// ✅ Good: Reusable test data factory
const createTestUser = (overrides = {}) => ({
  id: '123',
  name: 'Test User',
  email: 'test@example.com',
  createdAt: new Date(),
  ...overrides
});

const createTestDeployment = (overrides = {}) => ({
  id: '456',
  name: 'Test App',
  status: 'running',
  manifest: { version: '1.0', type: 'nodejs' },
  ...overrides
});
```

#### 3. Test Error Conditions:
```typescript
describe('error handling', () => {
  it('should handle database connection failure', async () => {
    mockDb.query.mockRejectedValue(new Error('Connection failed'));
    
    await expect(authService.login('test@example.com', 'password'))
      .rejects
      .toThrow('Authentication service unavailable');
  });

  it('should handle malformed input gracefully', async () => {
    await expect(authService.login('', ''))
      .rejects
      .toThrow('Email and password are required');
  });
});
```

## 🔗 Writing Integration Tests

### API Endpoint Testing with Supertest

```typescript
import request from 'supertest';
import { Express } from 'express';
import { createTestApp, initializeTestDatabase } from '../helpers/test-app';

describe('Authentication API', () => {
  let app: Express;
  let authToken: string;

  beforeAll(async () => {
    // Setup test application and database
    app = createTestApp();
    await initializeTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('POST /api/auth/register', () => {
    it('should register new user successfully', async () => {
      const userData = {
        name: 'Integration Test User',
        email: 'integration@example.com',
        password: 'IntegrationTest123!'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user).not.toHaveProperty('password');
      
      // Store token for subsequent tests
      authToken = response.body.token;
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'invalid-email',
          password: 'password123'
        })
        .expect(400);

      expect(response.body.error).toContain('Invalid email format');
    });
  });

  describe('Protected endpoints', () => {
    it('should require authentication', async () => {
      await request(app)
        .get('/api/deployments')
        .expect(401);
    });

    it('should accept valid token', async () => {
      const response = await request(app)
        .get('/api/deployments')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body.deployments)).toBe(true);
    });
  });
});
```

### WebSocket Integration Testing

```typescript
import { TestWebSocketClient } from '../helpers/test-server';
import { createTestServer } from '../helpers/test-server';

describe('WebSocket Integration', () => {
  let client: TestWebSocketClient;
  let authToken: string;

  beforeAll(async () => {
    // Setup test server and get auth token
    const testServer = createTestServer(createTestApp());
    authToken = await createTestAuthToken();
  });

  beforeEach(async () => {
    client = new TestWebSocketClient('ws://localhost:3000', authToken);
    await client.connect();
  });

  afterEach(() => {
    client.disconnect();
  });

  describe('Log streaming', () => {
    it('should receive deployment logs', async () => {
      const deploymentId = await createTestDeployment();
      
      client.subscribeToLogs(deploymentId);
      
      // Emit a test log
      emitTestLog(deploymentId, {
        level: 'info',
        message: 'Test log message',
        timestamp: new Date().toISOString()
      });

      // Wait for log to arrive
      const logEvent = await client.waitForEvent('deployment:log', 5000);
      
      expect(logEvent.deploymentId).toBe(deploymentId);
      expect(logEvent.message).toBe('Test log message');
      expect(logEvent.level).toBe('info');
    });

    it('should filter logs by level', async () => {
      const deploymentId = await createTestDeployment();
      
      client.subscribeToLogs(deploymentId, { level: 'error' });
      
      // Emit different level logs
      emitTestLog(deploymentId, { level: 'info', message: 'Info log' });
      emitTestLog(deploymentId, { level: 'error', message: 'Error log' });
      
      // Should only receive error log
      const logEvent = await client.waitForEvent('deployment:log', 5000);
      expect(logEvent.level).toBe('error');
      expect(logEvent.message).toBe('Error log');
    });
  });
});
```

## 🎭 Writing E2E Tests with Playwright

### Page Object Model

```typescript
// tests/e2e/pages/LoginPage.ts
export class LoginPage {
  constructor(private page: Page) {}

  async navigate() {
    await this.page.goto('/auth');
  }

  async login(email: string, password: string) {
    await this.page.fill('[data-testid="email"]', email);
    await this.page.fill('[data-testid="password"]', password);
    await this.page.click('[data-testid="login-submit"]');
  }

  async getErrorMessage() {
    return await this.page.textContent('[data-testid="error-message"]');
  }

  async isLoggedIn() {
    return await this.page.locator('[data-testid="user-menu"]').isVisible();
  }
}

// tests/e2e/pages/DashboardPage.ts
export class DashboardPage {
  constructor(private page: Page) {}

  async waitForLoad() {
    await this.page.waitForURL('/dashboard');
    await this.page.waitForSelector('[data-testid="dashboard-content"]');
  }

  async getWelcomeMessage() {
    return await this.page.textContent('[data-testid="welcome-message"]');
  }
}
```

### E2E Test Structure

```typescript
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';

test.describe('Authentication Flow', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    await loginPage.navigate();
  });

  test('successful login redirects to dashboard', async ({ page }) => {
    // Use test data factory
    const testUser = {
      email: 'test@coderunner.io',
      password: 'TestPassword123!'
    };

    await loginPage.login(testUser.email, testUser.password);
    await dashboardPage.waitForLoad();

    expect(await dashboardPage.getWelcomeMessage()).toContain('Welcome');
    expect(await loginPage.isLoggedIn()).toBe(true);
  });

  test('invalid credentials show error message', async ({ page }) => {
    await loginPage.login('invalid@email.com', 'wrongpassword');

    const errorMessage = await loginPage.getErrorMessage();
    expect(errorMessage).toContain('Invalid credentials');
    
    // Should stay on login page
    expect(page.url()).toContain('/auth');
  });

  test('validates email format', async ({ page }) => {
    await loginPage.login('invalid-email', 'password123');

    const errorMessage = await loginPage.getErrorMessage();
    expect(errorMessage).toContain('Invalid email format');
  });
});
```

### E2E Testing Best Practices

#### 1. Use Data Test IDs:
```html
<!-- ✅ Good: Stable selectors -->
<button data-testid="login-submit">Login</button>
<div data-testid="error-message">Error text</div>

<!-- ❌ Bad: Fragile selectors -->
<button class="btn btn-primary">Login</button>
<div class="alert alert-danger">Error text</div>
```

#### 2. Wait for Conditions:
```typescript
// ✅ Good: Wait for specific conditions
await expect(page.locator('[data-testid="deployment-status"]')).toContainText('running');

// ✅ Good: Wait for network requests
await page.waitForResponse('**/api/deployments');

// ❌ Bad: Arbitrary timeouts
await page.waitForTimeout(5000);
```

#### 3. Test User Journeys:
```typescript
test('complete deployment creation flow', async ({ page }) => {
  // Login
  await loginPage.login('test@example.com', 'password');
  await dashboardPage.waitForLoad();

  // Navigate to create deployment
  await page.click('[data-testid="create-deployment"]');
  await expect(page).toHaveURL('/deploy/new');

  // Fill deployment form
  await page.fill('[data-testid="deployment-name"]', 'Test App');
  await page.fill('[data-testid="manifest-editor"]', validManifest);
  
  // Submit and verify
  await page.click('[data-testid="deploy-button"]');
  await expect(page).toHaveURL(/\/deployments\/[\w-]+/);
  await expect(page.locator('[data-testid="deployment-status"]')).toBeVisible();
});
```

## ⚡ Writing Performance Tests

### Artillery Configuration

```yaml
# tests/performance/api-load-test.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
      rampTo: 50
      name: "Load ramp-up"
    - duration: 120
      arrivalRate: 50
      name: "Sustained load"

scenarios:
  - name: "Authentication and deployment flow"
    weight: 70
    flow:
      - post:
          url: "/api/auth/register"
          name: "Register user"
          json:
            name: "Load Test User"
            email: "loadtest-{{ $uuid }}@example.com"
            password: "LoadTest123!"
          capture:
            - json: "$.token"
              as: "authToken"
      
      - get:
          url: "/api/deployments"
          name: "Get deployments"
          headers:
            Authorization: "Bearer {{ authToken }}"

# Performance expectations
expect:
  - statusCode: 200
    p95: 500  # 95th percentile under 500ms
  - statusCode: [400, 401, 500]
    maxCount: 10  # Max 10 errors total
```

### WebSocket Load Testing

```javascript
// tests/performance/processors/websocket-processor.js
module.exports = {
  setupWebSocketLoad,
  trackConnectionMetrics
};

function setupWebSocketLoad(context, events, done) {
  context.vars.startTime = Date.now();
  events.emit('counter', 'websocket.connections', 1);
  return done();
}

function trackConnectionMetrics(context, events, done) {
  // Track WebSocket connection metrics
  context.ws.on('message', (data) => {
    const latency = Date.now() - JSON.parse(data).timestamp;
    events.emit('histogram', 'websocket.message_latency', latency);
  });
  
  context.ws.on('close', (code) => {
    const duration = Date.now() - context.vars.startTime;
    events.emit('histogram', 'websocket.connection_duration', duration);
  });
  
  return done();
}
```

## 🧪 Test Data Management

### Using Test Factories

```typescript
import { UserFactory, DeploymentFactory } from '../helpers/test-factories';

describe('Deployment Management', () => {
  let userFactory: UserFactory;
  let deploymentFactory: DeploymentFactory;
  let testUser: TestUser;

  beforeEach(async () => {
    userFactory = new UserFactory();
    deploymentFactory = new DeploymentFactory();
    testUser = await userFactory.create();
  });

  it('should create deployment with valid manifest', async () => {
    const deployment = await deploymentFactory.create(
      testUser.projectId,
      testUser.id,
      {
        name: 'Test Node.js App',
        status: 'running'
      }
    );

    expect(deployment.name).toBe('Test Node.js App');
    expect(deployment.status).toBe('running');
    expect(deployment.manifest).toHaveProperty('version');
  });
});
```

### Test Database Management

```typescript
describe('Database Integration', () => {
  beforeEach(async () => {
    // Clean slate for each test
    await cleanupTestData();
  });

  afterAll(async () => {
    // Final cleanup
    await cleanupTestDatabase();
  });

  it('should maintain referential integrity', async () => {
    const user = await createTestUser();
    const project = await createTestProject(user.id);
    const deployment = await createTestDeployment(project.id, user.id);

    // Delete user should cascade
    await deleteUser(user.id);
    
    // Verify cascading delete worked
    const remainingDeployment = await getDeployment(deployment.id);
    expect(remainingDeployment).toBeNull();
  });
});
```

## 📊 Testing Patterns

### Testing Async Operations

```typescript
describe('Async operations', () => {
  it('should handle deployment creation', async () => {
    const deploymentPromise = deploymentService.create(manifest);
    
    // Test immediate response
    expect(deploymentPromise).toBeInstanceOf(Promise);
    
    // Test resolved value
    const deployment = await deploymentPromise;
    expect(deployment.status).toBe('creating');
    
    // Wait for async processing
    await waitFor(() => deployment.status === 'running', 10000);
    expect(deployment.status).toBe('running');
  });

  it('should handle timeout scenarios', async () => {
    jest.setTimeout(15000); // Extend timeout for this test
    
    const slowOperation = deploymentService.createWithDelay(manifest, 10000);
    
    await expect(slowOperation).resolves.toBeDefined();
  }, 15000);
});
```

### Testing Error Scenarios

```typescript
describe('Error handling', () => {
  it('should handle network failures gracefully', async () => {
    // Mock network failure
    mockAxios.get.mockRejectedValue(new Error('Network Error'));
    
    const result = await service.fetchData();
    
    expect(result).toEqual({ error: 'Service temporarily unavailable' });
  });

  it('should retry failed requests', async () => {
    // First call fails, second succeeds
    mockAxios.get
      .mockRejectedValueOnce(new Error('Timeout'))
      .mockResolvedValue({ data: 'success' });
    
    const result = await service.fetchDataWithRetry();
    
    expect(result.data).toBe('success');
    expect(mockAxios.get).toHaveBeenCalledTimes(2);
  });
});
```

### Testing Real-time Features

```typescript
describe('Real-time log streaming', () => {
  it('should stream logs continuously', async () => {
    const logEvents: any[] = [];
    
    // Setup log listener
    const client = new TestWebSocketClient(serverUrl, authToken);
    await client.connect();
    
    client.on('deployment:log', (data) => {
      logEvents.push(data);
    });
    
    client.subscribeToLogs(deploymentId);
    
    // Generate test logs
    await emitTestLogs(deploymentId, 5);
    
    // Wait for all logs to arrive
    await waitFor(() => logEvents.length === 5, 5000);
    
    expect(logEvents).toHaveLength(5);
    expect(logEvents[0]).toHaveProperty('level');
    expect(logEvents[0]).toHaveProperty('message');
    expect(logEvents[0]).toHaveProperty('timestamp');
  });
});
```

## ✅ Test Quality Checklist

### Before Writing Tests:
- [ ] Understand the requirement/user story
- [ ] Identify critical paths and edge cases
- [ ] Plan test data and environment setup
- [ ] Choose appropriate test type (unit/integration/e2e)

### Writing Tests:
- [ ] Use descriptive test names
- [ ] Follow AAA (Arrange-Act-Assert) pattern
- [ ] Test one thing at a time
- [ ] Include positive and negative test cases
- [ ] Use proper assertions
- [ ] Handle async operations correctly

### Test Quality:
- [ ] Tests are fast and reliable
- [ ] Tests are independent (can run in any order)
- [ ] Tests clean up after themselves
- [ ] Tests use realistic test data
- [ ] Tests are maintainable and readable
- [ ] Tests provide good error messages

### Before Committing:
- [ ] All tests pass locally
- [ ] Code coverage meets threshold
- [ ] Tests follow project conventions
- [ ] Tests are documented if complex
- [ ] Performance impact is acceptable

---

## 📚 Quick Reference

### Common Jest Matchers:
```typescript
expect(value).toBe(expected);                    // Strict equality
expect(value).toEqual(expected);                 // Deep equality
expect(value).toHaveProperty('key', 'value');    // Object properties
expect(array).toContain(item);                   // Array contains
expect(string).toMatch(/pattern/);               // Regex match
expect(fn).toHaveBeenCalledWith(args);          // Function calls
expect(promise).resolves.toBe(value);           // Promise resolution
expect(promise).rejects.toThrow(error);         // Promise rejection
```

### Common Playwright Actions:
```typescript
await page.goto(url);                           // Navigate
await page.click(selector);                     // Click element
await page.fill(selector, value);               // Fill input
await page.selectOption(selector, value);       // Select option
await page.waitForSelector(selector);           // Wait for element
await page.waitForURL(url);                     // Wait for navigation
await expect(page.locator(selector)).toBeVisible(); // Assertions
```

### Test Data Patterns:
```typescript
// Factory functions
const createUser = (overrides = {}) => ({ id: '123', ...overrides });

// Test builders
const userBuilder = () => ({
  withId: (id) => ({ ...user, id }),
  withEmail: (email) => ({ ...user, email }),
  build: () => user
});

// Fixtures
const fixtures = {
  validManifest: { version: '1.0', type: 'nodejs' },
  invalidManifest: { type: 'invalid' }
};
```

**Remember**: Good tests are your safety net. They should give you confidence to refactor, deploy, and maintain your code. Invest time in writing quality tests—it pays dividends in reliability and developer productivity.