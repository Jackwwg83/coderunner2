# 🧪 CodeRunner v2.0 Testing Guide

**Version**: P2-T06 Implementation  
**Date**: 2025-08-08  
**Coverage Target**: >80%  

## 📋 Overview

This document provides comprehensive guidance for testing CodeRunner v2.0, including all Phase 2 features: WebSocket real-time logs, monitoring/metrics, V0 frontend integration, configuration management, and auto-scaling system.

## 🏗️ Testing Architecture

```mermaid
graph TB
    TestSuite[Comprehensive Test Suite] --> UnitTests[Unit Tests - Jest]
    TestSuite --> IntegrationTests[Integration Tests - Jest + Supertest]
    TestSuite --> E2ETests[E2E Tests - Playwright]
    TestSuite --> PerformanceTests[Performance Tests - Artillery]
    
    UnitTests --> Services[Services Testing]
    UnitTests --> Utils[Utilities Testing]
    UnitTests --> Middleware[Middleware Testing]
    
    IntegrationTests --> APITests[API Endpoint Tests]
    IntegrationTests --> WebSocketTests[WebSocket Tests]
    IntegrationTests --> DatabaseTests[Database Integration]
    
    E2ETests --> AuthFlow[Authentication Flow]
    E2ETests --> DeploymentFlow[Deployment Management]
    E2ETests --> RealtimeLogs[Real-time Log Streaming]
    E2ETests --> ConfigFlow[Configuration Management]
    E2ETests --> ScalingFlow[Auto-scaling Dashboard]
    
    PerformanceTests --> LoadTests[API Load Tests]
    PerformanceTests --> WSLoad[WebSocket Load Tests]
    PerformanceTests --> StressTests[Stress Testing]
```

## 🚀 Quick Start

### Prerequisites

1. **Node.js 18+ or 20+**
2. **PostgreSQL 15+** (for integration/E2E tests)
3. **Redis** (optional, for caching tests)

### Environment Setup

```bash
# Clone and install
git clone <repository>
cd coderunner2
npm install

# Setup test database
createdb coderunner_test
cp .env.example .env.test

# Edit .env.test with test database credentials
DATABASE_URL=postgres://test:test@localhost:5432/coderunner_test
TEST_DATABASE_URL=postgres://test:test@localhost:5432/coderunner_test
NODE_ENV=test
JWT_SECRET=test-jwt-secret-key
ENCRYPTION_KEY=test-encryption-key-32-characters

# Run database migrations for tests
npm run migrate
```

### Quick Test Commands

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test types
npm run test:unit
npm run test:integration  
npm run test:websocket
npm run test:e2e
npm run test:performance

# Run tests in watch mode
npm run test:watch

# Run tests for CI/CD
npm run test:ci
```

## 📊 Test Types & Coverage

### 1. Unit Tests (`tests/services/`, `tests/utils/`, `tests/middleware/`)

**Coverage Target**: 90%+  
**Technology**: Jest  
**Focus**: Individual functions, methods, and components

#### Key Areas Tested:
- ✅ Authentication service and middleware
- ✅ Database service and connections
- ✅ Manifest engine and deployment logic
- ✅ Configuration management and encryption
- ✅ Auto-scaling engine and policies
- ✅ WebSocket service and event handling
- ✅ Health check and metrics collection
- ✅ Utility functions and analyzers

#### Running Unit Tests:
```bash
# All unit tests
npm run test:unit

# Specific service
npm test -- tests/services/auth.test.ts

# With coverage
npm run test:unit -- --coverage

# Watch mode for development
npm run test:unit -- --watch
```

### 2. Integration Tests (`tests/integration/`)

**Coverage Target**: 85%+  
**Technology**: Jest + Supertest  
**Focus**: Component interactions and API endpoints

#### Key Areas Tested:
- ✅ Complete API endpoint functionality
- ✅ Authentication flows (register, login, token validation)
- ✅ Deployment management (CRUD operations)
- ✅ Configuration management (environment variables, secrets)
- ✅ Auto-scaling operations (policies, manual scaling)
- ✅ WebSocket connections and real-time events
- ✅ Database transactions and data integrity
- ✅ Health checks and metrics endpoints

#### Running Integration Tests:
```bash
# All integration tests
npm run test:integration

# API endpoints only
npm test -- tests/integration/api-endpoints.test.ts

# WebSocket integration
npm test -- tests/integration/websocket.test.ts
```

### 3. End-to-End Tests (`tests/e2e/`)

**Coverage Target**: 80%+  
**Technology**: Playwright  
**Focus**: Complete user journeys across browsers

#### Key Areas Tested:
- ✅ **Authentication Flow**: Login, logout, session management
- ✅ **Deployment Management**: Create, view, manage deployments
- ✅ **Real-time Log Streaming**: WebSocket connections, filtering, controls
- ✅ **Configuration Management**: Environment variables, secrets, templates
- ✅ **Auto-scaling Dashboard**: Policies, manual scaling, metrics
- ✅ **Cross-browser Compatibility**: Chrome, Firefox, Safari, Edge
- ✅ **Mobile Responsive Testing**: Mobile Chrome, Mobile Safari

#### Running E2E Tests:
```bash
# All E2E tests (all browsers)
npm run test:e2e

# Specific browser
npm run test:e2e -- --project=chromium

# Headed mode (visible browser)
npm run test:e2e:headed

# Debug mode
npm run test:e2e -- --debug
```

#### E2E Test Structure:
```
tests/e2e/
├── auth.setup.ts              # Authentication setup
├── global-setup.ts            # Global test setup
├── global-teardown.ts         # Global cleanup
├── authentication.spec.ts     # Login/logout flows
├── deployments.spec.ts        # Deployment management
├── realtime-logs.spec.ts      # Log streaming tests
├── configuration.spec.ts      # Config management
└── auto-scaling.spec.ts       # Scaling dashboard
```

### 4. Performance Tests (`tests/performance/`)

**Coverage Target**: Key user paths  
**Technology**: Artillery  
**Focus**: Load testing, stress testing, performance validation

#### Key Areas Tested:
- ✅ **API Load Testing**: 200+ concurrent users
- ✅ **WebSocket Stress Testing**: Real-time connection limits
- ✅ **Authentication Performance**: Login/registration under load
- ✅ **Deployment Operations**: Creation and management at scale
- ✅ **Configuration Operations**: Variable management performance
- ✅ **Auto-scaling Performance**: Scaling decision response times

#### Running Performance Tests:
```bash
# API load tests
npm run test:performance

# WebSocket load tests
npx artillery run tests/performance/websocket-load-test.yml

# Custom target URL
TARGET_URL=https://staging.example.com npm run test:performance
```

## 🛠️ Test Utilities and Helpers

### Test Factories (`tests/helpers/test-factories.ts`)

Create realistic test data quickly:

```typescript
import { UserFactory, ProjectFactory, DeploymentFactory } from '../helpers/test-factories';

// Create test user with auth token
const userFactory = new UserFactory();
const user = await userFactory.create();

// Create project with deployments
const projectFactory = new ProjectFactory();
const { project, deployments } = await projectFactory.createWithDeployments(user.id, 3);

// Create deployment with scaling policies
const deploymentFactory = new DeploymentFactory();
const { deployment, policies } = await deploymentFactory.createWithScaling(project.id, user.id);
```

### WebSocket Test Client (`tests/helpers/test-server.ts`)

Test real-time functionality:

```typescript
import { TestWebSocketClient } from '../helpers/test-server';

const client = new TestWebSocketClient('ws://localhost:3000', authToken);
await client.connect();

// Subscribe to logs
client.subscribeToLogs(deploymentId);

// Wait for events
const logEvent = await client.waitForEvent('deployment:log', 5000);

// Clean up
client.disconnect();
```

### Test Database Management

```typescript
import { initializeTestDatabase, cleanupTestDatabase } from '../helpers/test-app';

// Setup
const db = await initializeTestDatabase();

// Cleanup (run after tests)
await cleanupTestDatabase();
```

## 📈 Coverage Requirements & Thresholds

### Current Coverage Targets:

| Test Type | Target | Critical Paths |
|-----------|--------|----------------|
| Unit Tests | 90%+ | Authentication, Deployment Logic |
| Integration Tests | 85%+ | API Endpoints, WebSocket Events |
| E2E Tests | 80%+ | User Journeys, Cross-browser |
| Performance Tests | Key Paths | Load Handling, Response Times |

### Coverage Configuration (`jest.config.js`):

```javascript
module.exports = {
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    },
    './src/services/': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95
    }
  }
};
```

### Generating Coverage Reports:

```bash
# Generate coverage report
npm run test:coverage

# Open HTML report
open coverage/lcov-report/index.html

# CI coverage report
npm run test:ci
```

## 🔧 Configuration & Environment

### Test Environment Variables

Create `.env.test` file:

```env
# Database
DATABASE_URL=postgres://test:test@localhost:5432/coderunner_test
TEST_DATABASE_URL=postgres://test:test@localhost:5432/coderunner_test

# Environment
NODE_ENV=test
PORT=3001

# Authentication  
JWT_SECRET=test-jwt-secret-key-for-testing-only
JWT_EXPIRES_IN=1h

# Encryption
ENCRYPTION_KEY=test-encryption-key-32-characters

# External Services (disabled for tests)
AGENTSPHERE_API_KEY=test-agentsphere-key
DISABLE_EXTERNAL_CALLS=true

# Logging
LOG_LEVEL=error
TEST_DEBUG=false

# Performance
RATE_LIMIT_ENABLED=false
```

### Playwright Configuration (`playwright.config.ts`)

Key settings for E2E tests:

```typescript
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, dependencies: ['setup'] },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, dependencies: ['setup'] },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, dependencies: ['setup'] }
  ]
});
```

## 🤖 CI/CD Integration

### GitHub Actions Workflows

1. **`.github/workflows/test.yml`** - Automated testing on push/PR
2. **`.github/workflows/manual-tests.yml`** - Manual test execution

### Test Stages in CI:

1. **Lint & Type Check**
2. **Unit & Integration Tests** (Node 18.x, 20.x)
3. **E2E Tests** (Chrome, Firefox, Safari)
4. **Performance Tests** (Weekly schedule)
5. **Security Scanning** (npm audit, CodeQL, Snyk)
6. **Coverage Reporting** (Codecov)

### Running Tests in CI:

```bash
# Install dependencies
npm ci

# Setup test environment
npm run migrate

# Run test suite
npm run test:ci

# Upload artifacts
# (Handled automatically by GitHub Actions)
```

## 🐛 Debugging Tests

### Debug Strategies:

#### 1. Unit Test Debugging:
```bash
# Run with verbose output
npm test -- --verbose

# Debug specific test
npm test -- --testNamePattern="should authenticate user"

# Run in debug mode
node --inspect-brk node_modules/.bin/jest --runInBand
```

#### 2. Integration Test Debugging:
```bash
# Enable debug logging
TEST_DEBUG=true npm run test:integration

# Test specific endpoint
npm test -- tests/integration/api-endpoints.test.ts --testNamePattern="auth"
```

#### 3. E2E Test Debugging:
```bash
# Run in headed mode (visible browser)
npm run test:e2e:headed

# Debug mode with breakpoints
npm run test:e2e -- --debug

# Screenshot on failure (default enabled)
npm run test:e2e -- --screenshot=only-on-failure
```

#### 4. WebSocket Test Debugging:
```bash
# Enable WebSocket debug logs
DEBUG=socket.io* npm run test:websocket

# Test specific WebSocket functionality
npm test -- tests/websocket/websocket.test.ts --testNamePattern="subscribe"
```

### Common Debugging Issues:

#### Database Connection Issues:
```bash
# Check database status
npm run db:health

# Reset test database
dropdb coderunner_test && createdb coderunner_test
npm run migrate
```

#### Port Conflicts:
```bash
# Check port usage
lsof -i :3000
lsof -i :5432

# Use different port for tests
PORT=3001 npm run test:e2e
```

#### WebSocket Connection Issues:
```bash
# Check WebSocket server status
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Key: test" http://localhost:3000

# Debug WebSocket in browser
# Open browser dev tools -> Network -> WS tab
```

## 📊 Test Reporting

### Coverage Reports:

```bash
# Generate HTML coverage report
npm run test:coverage
open coverage/lcov-report/index.html

# Generate JSON coverage for CI
npm run test:ci
```

### E2E Test Reports:

```bash
# Generate Playwright HTML report
npm run test:e2e
npx playwright show-report

# View test trace
npx playwright show-trace test-results/trace.zip
```

### Performance Test Reports:

```bash
# Artillery generates reports automatically
npm run test:performance

# View performance report
open artillery-report.html
```

## 🔄 Continuous Integration

### Pre-commit Hooks (optional):

```bash
# Install husky
npm install --save-dev husky

# Setup pre-commit hook
npx husky add .husky/pre-commit "npm run test:unit && npm run lint"
```

### Test Quality Gates:

All tests must pass with:
- ✅ >80% code coverage
- ✅ >95% authentication flow success rate  
- ✅ >90% deployment lifecycle success rate
- ✅ <100ms real-time log streaming latency
- ✅ Cross-browser compatibility
- ✅ <200ms API response time (95th percentile)
- ✅ WebSocket stability >99% uptime

## 🚨 Troubleshooting

### Common Issues & Solutions:

#### 1. Tests Timeout:
```bash
# Increase timeout in jest.config.js
module.exports = {
  testTimeout: 30000 // 30 seconds
};
```

#### 2. Database Lock Issues:
```bash
# Use test database isolation
NODE_ENV=test DATABASE_URL=postgres://test:test@localhost:5432/coderunner_test_$(date +%s) npm test
```

#### 3. WebSocket Connection Fails:
```bash
# Ensure server is running
npm run dev &
sleep 5
npm run test:websocket
```

#### 4. E2E Tests Flaky:
```bash
# Increase wait timeouts
# Use data-testid attributes consistently
# Add proper wait conditions in tests
```

#### 5. Performance Tests Inconsistent:
```bash
# Ensure system resources are available
# Run performance tests in isolation
# Use consistent load patterns
```

### Getting Help:

1. **Check Test Logs**: Always examine full test output
2. **Review Test Coverage**: Identify untested code paths
3. **Validate Environment**: Ensure test environment matches requirements
4. **Check Dependencies**: Verify all required services are running
5. **Update Documentation**: Keep this guide current with changes

---

## 📚 Additional Resources

- [Jest Testing Framework](https://jestjs.io/docs/getting-started)
- [Playwright E2E Testing](https://playwright.dev/docs/intro)
- [Artillery Load Testing](https://artillery.io/docs/)
- [Supertest API Testing](https://github.com/ladjs/supertest)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

**Last Updated**: 2025-08-08  
**Next Review**: Phase 3 Planning