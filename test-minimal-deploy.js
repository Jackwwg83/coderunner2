#!/usr/bin/env node

const axios = require('axios');

const API_BASE = 'http://localhost:8080/api';

async function testAuth() {
  console.log('🧪 Testing Simple Authentication...\n');
  
  try {
    // Test health check first
    const healthResponse = await axios.get(`${API_BASE}/health`);
    console.log('✅ Health check passed');
    console.log(`   Status: ${healthResponse.data.data.overall}`);
    
    // Try to create a user with simpler approach
    const randomEmail = `test${Date.now()}@example.com`;
    const password = 'TmpPass123@';
    
    console.log(`\n📝 Creating test user: ${randomEmail}`);
    
    try {
      const regResponse = await axios.post(`${API_BASE}/auth/register`, {
        email: randomEmail,
        password: password,
        firstName: 'Test',
        lastName: 'User'
      });
      console.log('✅ User created successfully');
    } catch (regError) {
      console.log('❌ User creation failed:', regError.response?.data?.error || regError.message);
      return;
    }
    
    // Login
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: randomEmail,
      password: password
    });
    
    console.log('✅ Login successful');
    const token = loginResponse.data.data.token;
    
    // Test simple Node.js deployment
    console.log('\n🚀 Testing simple deployment...');
    
    const simpleFiles = [
      {
        path: 'package.json',
        content: '{"name": "test", "version": "1.0.0", "main": "index.js", "scripts": {"start": "node index.js"}}'
      },
      {
        path: 'index.js',
        content: 'console.log("Hello World!"); setTimeout(() => process.exit(0), 5000);'
      }
    ];
    
    const deployResponse = await axios.post(`${API_BASE}/deploy`, {
      files: simpleFiles
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Deployment successful!');
    console.log(`   Deployment ID: ${deployResponse.data.data.deploymentId}`);
    console.log(`   Status: ${deployResponse.data.data.status}`);
    console.log(`   Project Type: ${deployResponse.data.data.projectType}`);
    
    if (deployResponse.data.data.url) {
      console.log(`   URL: ${deployResponse.data.data.url}`);
    }
    
    console.log('\n🎉 Basic deployment test passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('   Full response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testAuth();