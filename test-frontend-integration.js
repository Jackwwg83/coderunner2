#!/usr/bin/env node

/**
 * Frontend Integration Test Script
 * Tests the complete frontend-backend integration for P2-T03
 */

const axios = require('axios');

const API_URL = 'http://localhost:8088/api';
let authToken = null;
let testUserId = null;

// Test user credentials
const testUser = {
  email: `test-${Date.now()}@example.com`,
  password: 'testPassword123'
};

// ANSI colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testAuth() {
  log('\n📝 Testing Authentication...', 'cyan');
  
  try {
    // Test registration
    log('  → Testing registration...');
    const registerRes = await axios.post(`${API_URL}/auth/register`, testUser);
    
    if (registerRes.data.success) {
      log('  ✅ Registration successful', 'green');
      testUserId = registerRes.data.userId;
    }
    
    // Test login
    log('  → Testing login...');
    const loginRes = await axios.post(`${API_URL}/auth/login`, testUser);
    
    if (loginRes.data.success && loginRes.data.token) {
      authToken = loginRes.data.token;
      log('  ✅ Login successful', 'green');
      log(`  → Token received: ${authToken.substring(0, 20)}...`, 'yellow');
      return true;
    }
  } catch (error) {
    log(`  ❌ Auth test failed: ${error.response?.data?.error || error.message}`, 'red');
    return false;
  }
}

async function testDeployments() {
  log('\n📦 Testing Deployments API...', 'cyan');
  
  if (!authToken) {
    log('  ❌ No auth token available', 'red');
    return false;
  }
  
  const config = {
    headers: { Authorization: `Bearer ${authToken}` }
  };
  
  try {
    // Test fetching deployments
    log('  → Testing GET /api/deployments...');
    const deploymentsRes = await axios.get(`${API_URL}/deployments`, config);
    
    if (deploymentsRes.data.success) {
      log('  ✅ Deployments fetched successfully', 'green');
      log(`  → Found ${deploymentsRes.data.deployments.length} deployments`, 'yellow');
    }
    
    // Test creating deployment
    log('  → Testing POST /api/deploy...');
    const deployData = {
      projectName: 'test-project',
      projectDescription: 'Test project from integration test',
      files: [
        {
          path: 'index.js',
          content: 'console.log("Hello from test!");'
        }
      ],
      config: {
        env: { NODE_ENV: 'test' },
        port: 8090
      }
    };
    
    const deployRes = await axios.post(`${API_URL}/deploy`, deployData, config);
    
    if (deployRes.data.success) {
      log('  ✅ Deployment created successfully', 'green');
      const deploymentId = deployRes.data.deployment?.id;
      
      if (deploymentId) {
        // Test fetching single deployment
        log(`  → Testing GET /api/deployments/${deploymentId}...`);
        const singleRes = await axios.get(`${API_URL}/deployments/${deploymentId}`, config);
        
        if (singleRes.data.success) {
          log('  ✅ Single deployment fetched successfully', 'green');
        }
      }
    }
    
    return true;
  } catch (error) {
    log(`  ❌ Deployments test failed: ${error.response?.data?.error || error.message}`, 'red');
    return false;
  }
}

async function testWebSocket() {
  log('\n🔌 Testing WebSocket Connection...', 'cyan');
  
  if (!authToken) {
    log('  ❌ No auth token available', 'red');
    return false;
  }
  
  const config = {
    headers: { Authorization: `Bearer ${authToken}` }
  };
  
  try {
    // Test WebSocket status endpoint
    log('  → Testing GET /api/websocket/status...');
    const statusRes = await axios.get(`${API_URL}/websocket/status`, config);
    
    if (statusRes.data.success) {
      log('  ✅ WebSocket status fetched successfully', 'green');
      log(`  → Active connections: ${statusRes.data.status.totalConnections}`, 'yellow');
      log(`  → Server uptime: ${Math.floor(statusRes.data.status.uptime / 60)} minutes`, 'yellow');
    }
    
    return true;
  } catch (error) {
    log(`  ❌ WebSocket test failed: ${error.response?.data?.error || error.message}`, 'red');
    return false;
  }
}

async function testMetrics() {
  log('\n📊 Testing Metrics API...', 'cyan');
  
  if (!authToken) {
    log('  ❌ No auth token available', 'red');
    return false;
  }
  
  const config = {
    headers: { Authorization: `Bearer ${authToken}` }
  };
  
  try {
    // Test current metrics endpoint
    log('  → Testing GET /api/metrics/current...');
    const metricsRes = await axios.get(`${API_URL}/metrics/current`, config);
    
    if (metricsRes.data.success) {
      log('  ✅ Metrics fetched successfully', 'green');
      log(`  → System CPU: ${metricsRes.data.metrics.system.cpu.usage.toFixed(1)}%`, 'yellow');
      log(`  → Memory: ${(metricsRes.data.metrics.system.memory.used / 1024 / 1024).toFixed(0)} MB`, 'yellow');
    }
    
    return true;
  } catch (error) {
    log(`  ❌ Metrics test failed: ${error.response?.data?.error || error.message}`, 'red');
    return false;
  }
}

async function runTests() {
  log('\n' + '='.repeat(60), 'cyan');
  log('🚀 CodeRunner Frontend Integration Test Suite', 'cyan');
  log('='.repeat(60), 'cyan');
  
  let allTestsPassed = true;
  
  // Run tests in sequence
  const tests = [
    { name: 'Authentication', fn: testAuth },
    { name: 'Deployments', fn: testDeployments },
    { name: 'WebSocket', fn: testWebSocket },
    { name: 'Metrics', fn: testMetrics }
  ];
  
  for (const test of tests) {
    const passed = await test.fn();
    if (!passed) {
      allTestsPassed = false;
    }
  }
  
  // Summary
  log('\n' + '='.repeat(60), 'cyan');
  if (allTestsPassed) {
    log('✅ All integration tests passed!', 'green');
  } else {
    log('❌ Some tests failed. Please check the output above.', 'red');
  }
  log('='.repeat(60), 'cyan');
  
  process.exit(allTestsPassed ? 0 : 1);
}

// Check if backend is running
axios.get(`${API_URL}/health`)
  .then(() => {
    log('✅ Backend is running', 'green');
    runTests();
  })
  .catch(() => {
    log('❌ Backend is not running. Please start it with: npm run dev', 'red');
    process.exit(1);
  });