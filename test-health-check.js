#!/usr/bin/env node

/**
 * Test script to validate health check improvements
 */

const http = require('http');

const config = {
  host: 'localhost',
  port: 3005,
  timeout: 10000
};

async function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: config.host,
      port: config.port,
      path,
      method: 'GET',
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: jsonData
          });
        } catch (error) {
          reject(new Error(`Failed to parse JSON: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

async function testHealthChecks() {
  console.log('🏥 Testing Health Check Improvements...\n');

  const endpoints = [
    { path: '/api/health', name: 'Enhanced Health Check' },
    { path: '/api/health/quick', name: 'Quick Health Check' },
    { path: '/api/health/ready', name: 'Readiness Probe' },
    { path: '/api/health/live', name: 'Liveness Probe' }
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`🔍 Testing ${endpoint.name} (${endpoint.path})...`);
      
      const response = await makeRequest(endpoint.path);
      
      console.log(`   ✅ Status: ${response.statusCode}`);
      console.log(`   📊 Response: ${JSON.stringify(response.data, null, 2).substring(0, 500)}...\n`);
      
      // Validate response structure
      if (response.data.success !== undefined && response.data.message && response.data.timestamp) {
        console.log(`   ✅ Response structure is valid\n`);
      } else {
        console.log(`   ⚠️  Response structure may be incomplete\n`);
      }
      
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
    }
  }

  console.log('🎯 Health Check Test Results Summary:');
  console.log('=====================================');
  console.log('If the server is running:');
  console.log('- Enhanced health check should show detailed service status');
  console.log('- In development mode, database should show "mocked" status');
  console.log('- Circuit breaker states should be visible');
  console.log('- Environment-specific messaging should be clear');
  console.log('\nIf database is not connected in dev mode:');
  console.log('- Database status should be "mocked" with helpful message');
  console.log('- Overall system should still be "healthy"');
  console.log('- Suggestion to configure DATABASE_URL should be shown');
}

// Run the tests
testHealthChecks().catch(console.error);