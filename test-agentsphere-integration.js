#!/usr/bin/env node

/**
 * Comprehensive E2E test script for AgentSphere SDK integration
 * Tests complete sandbox lifecycle, deployment process, and resource management
 */

const { OrchestrationService } = require('./dist/src/services/orchestration');
const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_CONFIG = {
  userId: `test-user-${Date.now()}`,
  projectId: `test-project-${Date.now()}`,
  timeout: 30000, // 30 seconds
  maxRetries: 3,
  apiKeyCheck: process.env.AGENTSPHERE_API_KEY ? true : false
};

// Test data generators
function createNodeJSProject() {
  return [
    {
      path: 'package.json',
      content: JSON.stringify({
        name: 'e2e-test-app',
        version: '1.0.0',
        main: 'server.js',
        scripts: {
          start: 'node server.js',
          test: 'echo "Test passed"'
        },
        dependencies: {
          express: '^4.18.0',
          cors: '^2.8.5'
        }
      }, null, 2)
    },
    {
      path: 'server.js',
      content: `
const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    env: process.env.NODE_ENV || 'development'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'AgentSphere E2E Test Application',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// API endpoints
app.get('/api/status', (req, res) => {
  res.json({ api: 'working', timestamp: new Date().toISOString() });
});

app.post('/api/echo', (req, res) => {
  res.json({ echo: req.body, timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(\`🚀 E2E Test server running on port \${port}\`);
  console.log(\`Environment: \${process.env.NODE_ENV || 'development'}\`);
});
      `.trim()
    },
    {
      path: '.env.example',
      content: `
NODE_ENV=development
PORT=3000
API_SECRET=test-secret-key
      `.trim()
    },
    {
      path: 'README.md',
      content: `
# AgentSphere E2E Test Application

This is a test application for validating AgentSphere SDK integration.

## Features
- Express.js server with CORS support
- Health check endpoint at /health
- Basic API endpoints for testing
- Environment configuration support

## Endpoints
- GET / - Root endpoint with app info
- GET /health - Health check endpoint
- GET /api/status - API status endpoint
- POST /api/echo - Echo POST requests

## Usage
\`\`\`bash
npm install
npm start
\`\`\`
      `.trim()
    }
  ];
}

function createManifestProject() {
  return [
    {
      path: 'manifest.yaml',
      content: `
name: e2e-manifest-test
description: E2E test application generated from manifest
version: 1.0.0

routes:
  - path: /
    method: GET
    response:
      message: Hello from Manifest-generated app
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
      message: User created
      timestamp: "{{timestamp}}"

middleware:
  - cors: true
  - json: true
  - logging: true

environment:
  NODE_ENV: development
  PORT: 3000
      `.trim()
    }
  ];
}

// Test utilities
function createTestReport() {
  return {
    startTime: new Date(),
    endTime: null,
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    skippedTests: 0,
    results: [],
    errors: [],
    summary: null
  };
}

function logTest(report, testName, status, details = null, error = null) {
  const result = {
    name: testName,
    status, // 'pass', 'fail', 'skip'
    timestamp: new Date(),
    details,
    error: error ? error.message : null
  };
  
  report.results.push(result);
  report.totalTests++;
  
  switch (status) {
    case 'pass':
      report.passedTests++;
      console.log(`   ✅ ${testName}${details ? ': ' + details : ''}`);
      break;
    case 'fail':
      report.failedTests++;
      console.log(`   ❌ ${testName}${error ? ': ' + error.message : ''}`);
      if (error) report.errors.push({ test: testName, error: error.message });
      break;
    case 'skip':
      report.skippedTests++;
      console.log(`   ⏭️  ${testName}${details ? ': ' + details : ''}`);
      break;
  }
}

async function runWithTimeout(promise, timeoutMs, description) {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`${description} timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

async function validateApiKey() {
  if (!process.env.AGENTSPHERE_API_KEY) {
    console.log('⚠️  AGENTSPHERE_API_KEY not set - using mock implementation');
    return false;
  }
  
  console.log('✅ AGENTSPHERE_API_KEY found');
  return true;
}

async function testOrchestrationServiceInitialization(report) {
  console.log('\n1️⃣  Testing OrchestrationService Initialization');
  
  try {
    const orchestrationService = OrchestrationService.getInstance();
    
    // Test singleton pattern
    const secondInstance = OrchestrationService.getInstance();
    if (orchestrationService === secondInstance) {
      logTest(report, 'Singleton pattern', 'pass', 'Same instance returned');
    } else {
      logTest(report, 'Singleton pattern', 'fail', 'Different instances returned');
    }
    
    // Test service properties
    if (typeof orchestrationService.listActiveSandboxes === 'function') {
      logTest(report, 'listActiveSandboxes method', 'pass', 'Method exists');
    } else {
      logTest(report, 'listActiveSandboxes method', 'fail', 'Method missing');
    }
    
    if (typeof orchestrationService.deployProject === 'function') {
      logTest(report, 'deployProject method', 'pass', 'Method exists');
    } else {
      logTest(report, 'deployProject method', 'fail', 'Method missing');
    }
    
    return orchestrationService;
    
  } catch (error) {
    logTest(report, 'Service initialization', 'fail', null, error);
    throw error;
  }
}

async function testSandboxListing(orchestrationService, report) {
  console.log('\n2️⃣  Testing Sandbox Listing');
  
  try {
    const sandboxes = await runWithTimeout(
      orchestrationService.listActiveSandboxes(),
      TEST_CONFIG.timeout,
      'List active sandboxes'
    );
    
    logTest(report, 'List active sandboxes', 'pass', `Found ${sandboxes.length} sandboxes`);
    
    // Validate response structure
    if (Array.isArray(sandboxes)) {
      logTest(report, 'Sandbox list structure', 'pass', 'Returned array');
      
      if (sandboxes.length > 0) {
        const firstSandbox = sandboxes[0];
        if (firstSandbox.sandboxId && firstSandbox.metadata && firstSandbox.startedAt) {
          logTest(report, 'Sandbox object structure', 'pass', 'Has required fields');
        } else {
          logTest(report, 'Sandbox object structure', 'fail', 'Missing required fields');
        }
      } else {
        logTest(report, 'Sandbox object structure', 'skip', 'No sandboxes to validate');
      }
    } else {
      logTest(report, 'Sandbox list structure', 'fail', 'Did not return array');
    }
    
    return sandboxes;
    
  } catch (error) {
    logTest(report, 'List active sandboxes', 'fail', null, error);
    return [];
  }
}

async function testUserSandboxLookup(orchestrationService, report) {
  console.log('\n3️⃣  Testing User Sandbox Lookup');
  
  try {
    // Test finding non-existent user sandbox
    const nonExistentSandbox = await runWithTimeout(
      orchestrationService.findUserSandbox('non-existent-user'),
      TEST_CONFIG.timeout,
      'Find non-existent user sandbox'
    );
    
    if (nonExistentSandbox === null) {
      logTest(report, 'Find non-existent user sandbox', 'pass', 'Returned null as expected');
    } else {
      logTest(report, 'Find non-existent user sandbox', 'fail', 'Should return null');
    }
    
    // Test finding user sandbox with project filter
    const filteredSandbox = await runWithTimeout(
      orchestrationService.findUserSandbox(TEST_CONFIG.userId, 'non-existent-project'),
      TEST_CONFIG.timeout,
      'Find user sandbox with project filter'
    );
    
    if (filteredSandbox === null) {
      logTest(report, 'Find user sandbox with project filter', 'pass', 'Returned null as expected');
    } else {
      logTest(report, 'Find user sandbox with project filter', 'fail', 'Should return null');
    }
    
  } catch (error) {
    logTest(report, 'User sandbox lookup', 'fail', null, error);
  }
}

async function testNodeJSProjectDeployment(orchestrationService, report) {
  console.log('\n4️⃣  Testing Node.js Project Deployment');
  
  const files = createNodeJSProject();
  let deployment = null;
  
  try {
    // Deploy project
    deployment = await runWithTimeout(
      orchestrationService.deployProject(
        TEST_CONFIG.userId,
        files,
        {
          timeout: TEST_CONFIG.timeout,
          env: {
            NODE_ENV: 'development',
            TEST_MODE: 'true'
          }
        }
      ),
      TEST_CONFIG.timeout * 2, // Allow longer for deployment
      'Node.js project deployment'
    );
    
    logTest(report, 'Node.js project deployment', 'pass', `Deployed ${deployment.id}`);
    
    // Validate deployment structure
    if (deployment.id && deployment.url && deployment.sandboxId) {
      logTest(report, 'Deployment object structure', 'pass', 'Has required fields');
    } else {
      logTest(report, 'Deployment object structure', 'fail', 'Missing required fields');
    }
    
    if (deployment.status === 'running') {
      logTest(report, 'Deployment status', 'pass', 'Status is running');
    } else {
      logTest(report, 'Deployment status', 'fail', `Status is ${deployment.status}`);
    }
    
    return deployment;
    
  } catch (error) {
    logTest(report, 'Node.js project deployment', 'fail', null, error);
    return null;
  }
}

async function testManifestProjectDeployment(orchestrationService, report) {
  console.log('\n5️⃣  Testing Manifest Project Deployment');
  
  const files = createManifestProject();
  let deployment = null;
  
  try {
    deployment = await runWithTimeout(
      orchestrationService.deployProject(
        TEST_CONFIG.userId,
        files,
        {
          timeout: TEST_CONFIG.timeout,
          env: {
            NODE_ENV: 'production'
          }
        }
      ),
      TEST_CONFIG.timeout * 2,
      'Manifest project deployment'
    );
    
    logTest(report, 'Manifest project deployment', 'pass', `Deployed ${deployment.id}`);
    
    if (deployment.status === 'running') {
      logTest(report, 'Manifest deployment status', 'pass', 'Status is running');
    } else {
      logTest(report, 'Manifest deployment status', 'fail', `Status is ${deployment.status}`);
    }
    
    return deployment;
    
  } catch (error) {
    logTest(report, 'Manifest project deployment', 'fail', null, error);
    return null;
  }
}

async function testDeploymentMonitoring(orchestrationService, deployment, report) {
  if (!deployment) {
    logTest(report, 'Deployment monitoring', 'skip', 'No deployment to monitor');
    return;
  }
  
  console.log('\n6️⃣  Testing Deployment Monitoring');
  
  try {
    const monitoring = await runWithTimeout(
      orchestrationService.monitorDeployment(deployment.id),
      TEST_CONFIG.timeout,
      'Deployment monitoring'
    );
    
    logTest(report, 'Get deployment monitoring', 'pass', `Health: ${monitoring.health}`);
    
    // Validate monitoring structure
    if (monitoring.status && monitoring.health && monitoring.metrics && monitoring.logs) {
      logTest(report, 'Monitoring object structure', 'pass', 'Has required fields');
    } else {
      logTest(report, 'Monitoring object structure', 'fail', 'Missing required fields');
    }
    
    if (Array.isArray(monitoring.logs)) {
      logTest(report, 'Deployment logs', 'pass', `${monitoring.logs.length} log entries`);
    } else {
      logTest(report, 'Deployment logs', 'fail', 'Logs is not an array');
    }
    
    if (typeof monitoring.metrics.uptime === 'number') {
      logTest(report, 'Deployment uptime metric', 'pass', `${monitoring.metrics.uptime}ms uptime`);
    } else {
      logTest(report, 'Deployment uptime metric', 'fail', 'Invalid uptime metric');
    }
    
  } catch (error) {
    logTest(report, 'Deployment monitoring', 'fail', null, error);
  }
}

async function testSandboxCleanup(orchestrationService, report) {
  console.log('\n7️⃣  Testing Sandbox Cleanup');
  
  try {
    // Test cleanup with user filter
    const userCleanup = await runWithTimeout(
      orchestrationService.cleanupSandboxes({
        userId: TEST_CONFIG.userId,
        force: false
      }),
      TEST_CONFIG.timeout,
      'User-specific cleanup'
    );
    
    logTest(report, 'User-specific cleanup', 'pass', 
      `Cleaned: ${userCleanup.cleaned}, Errors: ${userCleanup.errors.length}`);
    
    // Test forced cleanup
    const forcedCleanup = await runWithTimeout(
      orchestrationService.cleanupSandboxes({
        force: true
      }),
      TEST_CONFIG.timeout,
      'Forced cleanup'
    );
    
    logTest(report, 'Forced cleanup', 'pass', 
      `Cleaned: ${forcedCleanup.cleaned}, Errors: ${forcedCleanup.errors.length}`);
    
    // Validate cleanup result structure
    if (typeof forcedCleanup.cleaned === 'number' && 
        Array.isArray(forcedCleanup.errors) && 
        Array.isArray(forcedCleanup.details)) {
      logTest(report, 'Cleanup result structure', 'pass', 'Has required fields');
    } else {
      logTest(report, 'Cleanup result structure', 'fail', 'Missing required fields');
    }
    
  } catch (error) {
    logTest(report, 'Sandbox cleanup', 'fail', null, error);
  }
}

async function testExecutionStatistics(orchestrationService, report) {
  console.log('\n8️⃣  Testing Execution Statistics');
  
  try {
    const stats = await runWithTimeout(
      orchestrationService.getExecutionStats(),
      TEST_CONFIG.timeout,
      'Get execution statistics'
    );
    
    logTest(report, 'Get execution statistics', 'pass', 
      `Active: ${stats.activeExecutions}, Total: ${stats.totalExecutions}`);
    
    // Validate stats structure
    if (typeof stats.totalExecutions === 'number' &&
        typeof stats.activeExecutions === 'number' &&
        typeof stats.queuedExecutions === 'number' &&
        typeof stats.averageExecutionTime === 'number') {
      logTest(report, 'Statistics object structure', 'pass', 'Has required numeric fields');
    } else {
      logTest(report, 'Statistics object structure', 'fail', 'Invalid field types');
    }
    
  } catch (error) {
    logTest(report, 'Execution statistics', 'fail', null, error);
  }
}

async function testErrorHandling(orchestrationService, report) {
  console.log('\n9️⃣  Testing Error Handling');
  
  try {
    // Test invalid deployment monitoring
    try {
      await runWithTimeout(
        orchestrationService.monitorDeployment('invalid-deployment-id'),
        TEST_CONFIG.timeout,
        'Monitor invalid deployment'
      );
      logTest(report, 'Invalid deployment monitoring', 'fail', 'Should have thrown error');
    } catch (error) {
      if (error.message.includes('not found')) {
        logTest(report, 'Invalid deployment monitoring', 'pass', 'Correctly threw not found error');
      } else {
        logTest(report, 'Invalid deployment monitoring', 'fail', `Wrong error type: ${error.message}`);
      }
    }
    
    // Test deployment with empty files
    try {
      await runWithTimeout(
        orchestrationService.deployProject(TEST_CONFIG.userId, []),
        TEST_CONFIG.timeout,
        'Deploy with empty files'
      );
      logTest(report, 'Empty files deployment', 'fail', 'Should have thrown error');
    } catch (error) {
      logTest(report, 'Empty files deployment', 'pass', 'Correctly rejected empty files');
    }
    
  } catch (error) {
    logTest(report, 'Error handling tests', 'fail', null, error);
  }
}

function generateTestReport(report) {
  report.endTime = new Date();
  const duration = report.endTime - report.startTime;
  
  report.summary = {
    duration: `${(duration / 1000).toFixed(2)}s`,
    successRate: report.totalTests > 0 ? `${((report.passedTests / report.totalTests) * 100).toFixed(1)}%` : '0%',
    timestamp: report.endTime.toISOString()
  };
  
  return report;
}

function printTestSummary(report) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 E2E TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`⏱️  Duration: ${report.summary.duration}`);
  console.log(`📈 Success Rate: ${report.summary.successRate}`);
  console.log(`✅ Passed: ${report.passedTests}`);
  console.log(`❌ Failed: ${report.failedTests}`);
  console.log(`⏭️  Skipped: ${report.skippedTests}`);
  console.log(`📊 Total: ${report.totalTests}`);
  
  if (report.errors.length > 0) {
    console.log('\n🚨 ERRORS:');
    report.errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error.test}: ${error.error}`);
    });
  }
  
  console.log('\n✨ Test completed at:', report.summary.timestamp);
}

async function saveTestReport(report) {
  const filename = `agentsphere-e2e-test-results-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const filepath = path.join(__dirname, filename);
  
  try {
    await fs.promises.writeFile(filepath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Test report saved to: ${filepath}`);
  } catch (error) {
    console.error('❌ Failed to save test report:', error.message);
  }
}

async function testAgentSphereIntegration() {
  const report = createTestReport();
  let orchestrationService;
  
  console.log('🧪 AgentSphere SDK E2E Integration Test');
  console.log('='.repeat(60));
  console.log(`🔧 Test Configuration:`);
  console.log(`   User ID: ${TEST_CONFIG.userId}`);
  console.log(`   Project ID: ${TEST_CONFIG.projectId}`);
  console.log(`   Timeout: ${TEST_CONFIG.timeout}ms`);
  console.log(`   API Key: ${TEST_CONFIG.apiKeyCheck ? 'Found' : 'Not found (using mock)'}`);
  
  try {
    // API Key validation
    await validateApiKey();
    
    // Initialize orchestration service
    orchestrationService = await testOrchestrationServiceInitialization(report);
    
    // Test sandbox management
    await testSandboxListing(orchestrationService, report);
    await testUserSandboxLookup(orchestrationService, report);
    
    // Test deployments
    const nodeDeployment = await testNodeJSProjectDeployment(orchestrationService, report);
    const manifestDeployment = await testManifestProjectDeployment(orchestrationService, report);
    
    // Test monitoring (use whichever deployment succeeded)
    const deploymentToMonitor = nodeDeployment || manifestDeployment;
    await testDeploymentMonitoring(orchestrationService, deploymentToMonitor, report);
    
    // Test system operations
    await testExecutionStatistics(orchestrationService, report);
    await testErrorHandling(orchestrationService, report);
    
    // Test cleanup (should be last)
    await testSandboxCleanup(orchestrationService, report);
    
  } catch (error) {
    console.error('\n💥 Critical test failure:', error.message);
    logTest(report, 'Critical failure', 'fail', null, error);
  } finally {
    // Generate and display results
    generateTestReport(report);
    printTestSummary(report);
    await saveTestReport(report);
    
    // Cleanup
    if (orchestrationService) {
      try {
        await orchestrationService.cleanup();
        console.log('\n🧹 Orchestration service cleaned up');
      } catch (error) {
        console.warn('⚠️  Cleanup warning:', error.message);
      }
    }
    
    // Exit with appropriate code
    if (report.failedTests > 0) {
      console.log('\n❌ Some tests failed - exiting with error code');
      process.exit(1);
    } else {
      console.log('\n✅ All tests completed successfully');
      process.exit(0);
    }
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testAgentSphereIntegration().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = { testAgentSphereIntegration };