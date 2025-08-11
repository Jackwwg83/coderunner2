#!/usr/bin/env node

/**
 * Simple OAuth Setup Test
 * Tests if OAuth routes are accessible and configured correctly
 */

const http = require('http');
const dotenv = require('dotenv');
const fs = require('fs');

// Load test OAuth environment variables
if (fs.existsSync('.env.test.oauth')) {
  dotenv.config({ path: '.env.test.oauth' });
}

console.log('🧪 Testing OAuth Setup...\n');

const BASE_URL = process.env.OAUTH_CALLBACK_URL || 'http://localhost:8080';

/**
 * Test OAuth providers endpoint
 */
async function testProvidersEndpoint() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 8080,
      path: '/api/auth/providers',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    };

    console.log('📍 Testing GET /api/auth/providers');

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log(`   Status: ${res.statusCode}`);
          console.log(`   Response:`, response);
          
          if (res.statusCode === 200 && response.success) {
            console.log('   ✅ Providers endpoint working\n');
            resolve(true);
          } else {
            console.log('   ❌ Providers endpoint failed\n');
            resolve(false);
          }
        } catch (error) {
          console.log(`   ❌ Failed to parse response: ${error.message}\n`);
          resolve(false);
        }
      });
    });

    req.on('error', (error) => {
      console.log(`   ❌ Request failed: ${error.message}\n`);
      resolve(false);
    });

    req.setTimeout(5000, () => {
      console.log('   ❌ Request timeout\n');
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

/**
 * Test OAuth redirect endpoints (should redirect)
 */
async function testOAuthRedirects() {
  const endpoints = [
    '/api/auth/google',
    '/api/auth/github'
  ];

  for (const endpoint of endpoints) {
    await new Promise((resolve) => {
      const options = {
        hostname: 'localhost',
        port: 8080,
        path: endpoint,
        method: 'GET',
        headers: {
          'User-Agent': 'OAuth-Test/1.0',
        },
      };

      console.log(`📍 Testing GET ${endpoint}`);

      const req = http.request(options, (res) => {
        console.log(`   Status: ${res.statusCode}`);
        
        if (res.statusCode === 302) {
          console.log(`   Location: ${res.headers.location || 'No location header'}`);
          console.log('   ✅ OAuth redirect working\n');
        } else if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('   ⚠️ Expected redirect (302) but got success status\n');
        } else {
          console.log('   ❌ OAuth redirect failed\n');
        }
        
        resolve();
      });

      req.on('error', (error) => {
        console.log(`   ❌ Request failed: ${error.message}\n`);
        resolve();
      });

      req.setTimeout(5000, () => {
        console.log('   ❌ Request timeout\n');
        req.destroy();
        resolve();
      });

      req.end();
    });
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('Environment Variables:');
  console.log(`  GOOGLE_CLIENT_ID: ${process.env.GOOGLE_CLIENT_ID ? '✅ Set' : '❌ Not set'}`);
  console.log(`  GOOGLE_CLIENT_SECRET: ${process.env.GOOGLE_CLIENT_SECRET ? '✅ Set' : '❌ Not set'}`);
  console.log(`  GITHUB_CLIENT_ID: ${process.env.GITHUB_CLIENT_ID ? '✅ Set' : '❌ Not set'}`);
  console.log(`  GITHUB_CLIENT_SECRET: ${process.env.GITHUB_CLIENT_SECRET ? '✅ Set' : '❌ Not set'}`);
  console.log(`  OAUTH_CALLBACK_URL: ${process.env.OAUTH_CALLBACK_URL || 'Default'}`);
  console.log(`  FRONTEND_URL: ${process.env.FRONTEND_URL || 'Default'}`);
  console.log('');

  // Test if server is running
  console.log('📍 Checking if server is running...');
  try {
    await new Promise((resolve, reject) => {
      const req = http.request({ hostname: 'localhost', port: 8080, path: '/health', method: 'GET' }, (res) => {
        if (res.statusCode === 200) {
          console.log('   ✅ Server is running\n');
          resolve();
        } else {
          console.log(`   ❌ Server responded with status ${res.statusCode}\n`);
          reject(new Error(`Server error: ${res.statusCode}`));
        }
      });
      
      req.on('error', (error) => {
        console.log('   ❌ Server is not running or not accessible\n');
        console.log('   💡 Make sure to start the server with: npm start\n');
        reject(error);
      });
      
      req.setTimeout(3000, () => {
        req.destroy();
        reject(new Error('Timeout'));
      });
      
      req.end();
    });
  } catch (error) {
    console.log('❌ Cannot proceed with tests - server not running');
    process.exit(1);
  }

  // Run OAuth tests
  const providersWorking = await testProvidersEndpoint();
  await testOAuthRedirects();

  // Summary
  console.log('📋 Test Summary:');
  console.log(`   Providers endpoint: ${providersWorking ? '✅' : '❌'}`);
  console.log('   OAuth redirects: See individual results above');
  console.log('');
  console.log('🎯 Next Steps:');
  console.log('   1. Set up real OAuth credentials in your .env file');
  console.log('   2. Configure OAuth applications in Google/GitHub developer console');
  console.log('   3. Set up the frontend callback handling');
  console.log('   4. Test with real OAuth flow');
}

// Run tests
runTests().catch(error => {
  console.error('❌ Test execution failed:', error.message);
  process.exit(1);
});