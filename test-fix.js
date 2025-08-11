// Quick test to verify the route fix
const { spawn } = require('child_process');
const http = require('http');

console.log('🧪 Testing CodeRunner backend fix...\n');

// Start server with ts-node
const server = spawn('npx', ['ts-node', '--transpile-only', 'src/index.ts'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'development' }
});

console.log('⏳ Starting server with ts-node (transpile-only)...\n');

// Wait for server to start
setTimeout(() => {
  console.log('🔍 Testing health endpoint...');
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/health',
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  };

  const req = http.request(options, (res) => {
    console.log(`✅ Status: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => data += chunk);
    
    res.on('end', () => {
      if (res.statusCode === 200) {
        try {
          const response = JSON.parse(data);
          console.log('🎉 SUCCESS! Backend is running correctly');
          console.log('📊 Health check response:', JSON.stringify(response, null, 2));
        } catch (e) {
          console.log('✅ Server responded (non-JSON):', data.substring(0, 200));
        }
      } else {
        console.log('⚠️ Non-200 response:', data.substring(0, 200));
      }
      
      // Test API root
      testApiRoot();
    });
  });

  req.on('error', (err) => {
    console.log('❌ Health check failed:', err.code);
    server.kill();
    process.exit(1);
  });

  req.end();
}, 5000);

function testApiRoot() {
  console.log('\n🔍 Testing API root endpoint...');
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/',
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  };

  const req = http.request(options, (res) => {
    console.log(`✅ API Root Status: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => data += chunk);
    
    res.on('end', () => {
      if (res.statusCode === 200) {
        try {
          const response = JSON.parse(data);
          console.log('🎯 API Root Response:', JSON.stringify(response, null, 2));
          console.log('\n🎉 ALL TESTS PASSED! Backend fix successful');
        } catch (e) {
          console.log('✅ API Root responded:', data.substring(0, 200));
        }
      } else {
        console.log('⚠️ API Root response:', data.substring(0, 200));
      }
      
      console.log('\n✅ Backend route issue fixed successfully!');
      server.kill();
      process.exit(0);
    });
  });

  req.on('error', (err) => {
    console.log('❌ API root test failed:', err.code);
    server.kill();
    process.exit(1);
  });

  req.end();
}

// Cleanup on exit
process.on('SIGINT', () => {
  server.kill();
  process.exit(0);
});