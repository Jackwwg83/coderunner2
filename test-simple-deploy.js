#!/usr/bin/env node

const axios = require('axios');

const API_BASE = 'http://localhost:8080/api';

async function testSimpleDeploy() {
  console.log('🧪 Testing Simple Deployment API...\n');
  
  try {
    // 1. Test with simple Node.js project
    console.log('1️⃣ Testing Node.js project deployment...');
    
    const nodeJsFiles = [
      {
        path: 'package.json',
        content: JSON.stringify({
          "name": "test-app",
          "version": "1.0.0",
          "main": "index.js",
          "scripts": {
            "start": "node index.js"
          },
          "dependencies": {
            "express": "^4.18.2"
          }
        }, null, 2)
      },
      {
        path: 'index.js',
        content: `const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({ 
    message: 'Hello from CodeRunner!', 
    timestamp: new Date().toISOString() 
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});`
      }
    ];

    // First try to create a test user, then login
    let token;
    
    try {
      await axios.post(`${API_BASE}/auth/register`, {
        email: 'testdeploy@example.com',
        password: 'TestDeploy123@',
        firstName: 'Test',
        lastName: 'Deploy'
      });
      console.log('✅ Test user created');
    } catch (regError) {
      console.log('📝 Test user might already exist, continuing...');
    }
    
    // Login with the test user
    const authResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'testdeploy@example.com',
      password: 'TestDeploy123@'
    });
    
    token = authResponse.data.data.token;
    console.log('✅ Authentication successful');

    // Deploy Node.js project
    const deployResponse = await axios.post(`${API_BASE}/deploy`, {
      files: nodeJsFiles
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Node.js deployment successful!');
    console.log(`   Deployment ID: ${deployResponse.data.data.deploymentId}`);
    console.log(`   URL: ${deployResponse.data.data.url}`);
    console.log(`   Status: ${deployResponse.data.data.status}`);
    console.log(`   Project Type: ${deployResponse.data.data.projectType}`);
    
    const deploymentId = deployResponse.data.data.deploymentId;

    // Test deployment status
    console.log('\n2️⃣ Testing deployment status...');
    const statusResponse = await axios.get(`${API_BASE}/deployments/${deploymentId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log('✅ Deployment status retrieved');
    console.log(`   Status: ${statusResponse.data.data.status}`);
    console.log(`   Public URL: ${statusResponse.data.data.publicUrl}`);

    // Test deployment logs
    console.log('\n3️⃣ Testing deployment logs...');
    const logsResponse = await axios.get(`${API_BASE}/deployments/${deploymentId}/logs`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log('✅ Deployment logs retrieved');
    console.log(`   Log entries: ${logsResponse.data.data.logs.length}`);

    // Test with Manifest project
    console.log('\n4️⃣ Testing Manifest project deployment...');
    
    const manifestFiles = [
      {
        path: 'manifest.yaml',
        content: `name: Blog API
version: 1.0.0
entities:
  - name: Post
    fields:
      - name: title
        type: string
        required: true
      - name: content
        type: string
        required: true
      - name: author
        type: string
        required: false
      - name: published
        type: boolean
        required: false
  - name: Comment
    fields:
      - name: content
        type: string
        required: true
      - name: author
        type: string
        required: true`
      }
    ];

    const manifestDeployResponse = await axios.post(`${API_BASE}/deploy`, {
      files: manifestFiles
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Manifest deployment successful!');
    console.log(`   Deployment ID: ${manifestDeployResponse.data.data.deploymentId}`);
    console.log(`   URL: ${manifestDeployResponse.data.data.url}`);
    console.log(`   Project Type: ${manifestDeployResponse.data.data.projectType}`);

    // List all deployments
    console.log('\n5️⃣ Testing deployment list...');
    const listResponse = await axios.get(`${API_BASE}/deployments`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log('✅ Deployments list retrieved');
    console.log(`   Total deployments: ${listResponse.data.data.length}`);

    console.log('\n🎉 All tests passed! Simple Deployment API is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    if (error.response?.data?.error) {
      console.error('   Error details:', error.response.data.error);
    }
  }
}

// Run the test
testSimpleDeploy();