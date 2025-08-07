/**
 * Demo script showing how to use the /deploy API endpoint
 * 
 * This script demonstrates:
 * 1. Authentication with the API
 * 2. Node.js project deployment
 * 3. Manifest project deployment
 * 4. Error handling
 * 
 * Usage: node deploy-endpoint-demo.js
 */

const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';

// Example 1: Register a new user and get token
async function registerUser() {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: `test-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      planType: 'free'
    })
  });

  const result = await response.json();
  if (result.success) {
    console.log('✅ User registered successfully');
    return result.data.token;
  } else {
    throw new Error(`Registration failed: ${result.error}`);
  }
}

// Example 2: Deploy a Node.js project
async function deployNodeJsProject(token) {
  const projectFiles = [
    {
      path: 'package.json',
      content: JSON.stringify({
        name: 'demo-api',
        version: '1.0.0',
        main: 'server.js',
        scripts: {
          start: 'node server.js'
        },
        dependencies: {
          express: '^4.18.0'
        }
      }, null, 2)
    },
    {
      path: 'server.js',
      content: `
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Hello from deployed API!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

app.get('/api/users', (req, res) => {
  res.json({
    users: [
      { id: 1, name: 'John Doe', email: 'john@example.com' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
    ]
  });
});

app.post('/api/users', (req, res) => {
  const user = req.body;
  res.status(201).json({
    id: Date.now(),
    ...user,
    created_at: new Date().toISOString()
  });
});

app.listen(port, () => {
  console.log(\`🚀 Demo API server running on port \${port}\`);
});
      `
    },
    {
      path: 'README.md',
      content: `# Demo API

This is a demo Express.js API deployed via the CodeRunner deployment system.

## Endpoints

- \`GET /\` - Welcome message
- \`GET /health\` - Health check
- \`GET /api/users\` - List users
- \`POST /api/users\` - Create user

## Deployment

This project was deployed using the CodeRunner /api/deploy endpoint.
      `
    }
  ];

  const response = await fetch(`${baseUrl}/api/deploy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      projectName: 'nodejs-demo-api',
      projectDescription: 'Demo Node.js API with Express',
      files: projectFiles,
      config: {
        env: {
          NODE_ENV: 'production'
        },
        port: 3000,
        timeout: 300
      }
    })
  });

  const result = await response.json();
  console.log('\n📦 Node.js Project Deployment Result:');
  console.log(JSON.stringify(result, null, 2));
  return result;
}

// Example 3: Deploy a Manifest project
async function deployManifestProject(token) {
  const manifestFiles = [
    {
      path: 'manifest.yaml',
      content: `
name: blog-api
version: 1.0.0
description: A simple blog API generated from manifest

entities:
  - name: User
    fields:
      - name: id
        type: number
        required: true
      - name: username
        type: string
        required: true
      - name: email
        type: string
        required: true
      - name: created_at
        type: date
        required: false

  - name: Post
    fields:
      - name: id
        type: number
        required: true
      - name: title
        type: string
        required: true
      - name: content
        type: string
        required: true
      - name: user_id
        type: number
        required: true
      - name: published
        type: boolean
        required: false
      - name: created_at
        type: date
        required: false

  - name: Comment
    fields:
      - name: id
        type: number
        required: true
      - name: post_id
        type: number
        required: true
      - name: user_id
        type: number
        required: true
      - name: content
        type: string
        required: true
      - name: created_at
        type: date
        required: false
      `
    },
    {
      path: 'config.json',
      content: JSON.stringify({
        api: {
          version: 'v1',
          prefix: '/api/v1'
        },
        database: {
          type: 'sqlite',
          filename: 'blog.db'
        }
      }, null, 2)
    }
  ];

  const response = await fetch(`${baseUrl}/api/deploy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      projectName: 'manifest-blog-api',
      projectDescription: 'Blog API generated from Manifest',
      files: manifestFiles,
      config: {
        port: 3000,
        timeout: 300
      }
    })
  });

  const result = await response.json();
  console.log('\n📋 Manifest Project Deployment Result:');
  console.log(JSON.stringify(result, null, 2));
  return result;
}

// Example 4: Test error scenarios
async function testErrorScenarios(token) {
  console.log('\n🧪 Testing Error Scenarios:');

  // Test 1: Missing required fields
  try {
    const response = await fetch(`${baseUrl}/api/deploy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        // Missing projectName and files
      })
    });
    const result = await response.json();
    console.log('❌ Missing fields test:', result.message);
  } catch (error) {
    console.log('❌ Missing fields error:', error.message);
  }

  // Test 2: Path traversal attempt
  try {
    const response = await fetch(`${baseUrl}/api/deploy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        projectName: 'malicious-project',
        files: [
          {
            path: '../../../etc/passwd',
            content: 'malicious content'
          }
        ]
      })
    });
    const result = await response.json();
    console.log('🛡️ Path traversal blocked:', result.message);
  } catch (error) {
    console.log('🛡️ Path traversal error:', error.message);
  }

  // Test 3: Empty files array
  try {
    const response = await fetch(`${baseUrl}/api/deploy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        projectName: 'empty-project',
        files: []
      })
    });
    const result = await response.json();
    console.log('📁 Empty files test:', result.message);
  } catch (error) {
    console.log('📁 Empty files error:', error.message);
  }
}

// Main demo function
async function runDemo() {
  try {
    console.log('🚀 Starting Deployment API Demo\n');

    // Step 1: Register user and get token
    console.log('1️⃣ Registering user...');
    const token = await registerUser();

    // Step 2: Deploy Node.js project
    console.log('\n2️⃣ Deploying Node.js project...');
    const nodejsResult = await deployNodeJsProject(token);

    // Step 3: Deploy Manifest project
    console.log('\n3️⃣ Deploying Manifest project...');
    const manifestResult = await deployManifestProject(token);

    // Step 4: Test error scenarios
    console.log('\n4️⃣ Testing error scenarios...');
    await testErrorScenarios(token);

    // Summary
    console.log('\n📊 Demo Summary:');
    if (nodejsResult.success) {
      console.log(`✅ Node.js project deployed: ${nodejsResult.data.url}`);
    }
    if (manifestResult.success) {
      console.log(`✅ Manifest project deployed: ${manifestResult.data.url}`);
    }

    console.log('\n🎉 Demo completed successfully!');

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Handle base64 encoding example
function demonstrateBase64Encoding() {
  console.log('\n🔤 Base64 Encoding Example:');
  
  const fileContent = `
console.log('Hello World!');
const message = 'This file was base64 encoded';
console.log(message);
  `;

  const base64Content = Buffer.from(fileContent).toString('base64');
  
  console.log('Original content:');
  console.log(fileContent);
  console.log('\nBase64 encoded:');
  console.log(base64Content);
  console.log('\nYou can use either format in the files array.');
}

// Run demo if this file is executed directly
if (require.main === module) {
  demonstrateBase64Encoding();
  
  // Only run the full demo if API_BASE_URL is provided or defaults work
  if (process.argv.includes('--run-demo')) {
    runDemo();
  } else {
    console.log('\n💡 To run the full demo against a running API server:');
    console.log('   node deploy-endpoint-demo.js --run-demo');
    console.log('\n   Or set API_BASE_URL environment variable:');
    console.log('   API_BASE_URL=http://localhost:3000 node deploy-endpoint-demo.js --run-demo');
  }
}

module.exports = {
  registerUser,
  deployNodeJsProject,
  deployManifestProject,
  testErrorScenarios,
  runDemo
};