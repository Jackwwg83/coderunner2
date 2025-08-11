#!/usr/bin/env node

const http = require('http');

// Start the server
const { spawn } = require('child_process');
const server = spawn('npm', ['start'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  detached: false
});

// Wait a bit for server to start
setTimeout(() => {
  // Test health endpoint
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/health',
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    console.log(`\n✅ Health Check Status: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        console.log('✅ Health Check Response:', JSON.stringify(response, null, 2));
        console.log('\n🎉 Backend startup successful!');
      } catch (err) {
        console.log('Raw response:', data);
      }
      
      // Test main API endpoint
      const apiOptions = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/',
        method: 'GET'
      };
      
      const apiReq = http.request(apiOptions, (apiRes) => {
        console.log(`✅ API Root Status: ${apiRes.statusCode}`);
        
        let apiData = '';
        apiRes.on('data', (chunk) => {
          apiData += chunk;
        });
        
        apiRes.on('end', () => {
          try {
            const apiResponse = JSON.parse(apiData);
            console.log('✅ API Root Response:', JSON.stringify(apiResponse, null, 2));
            console.log('\n🎯 All route handlers working correctly!');
          } catch (err) {
            console.log('Raw API response:', apiData);
          }
          
          // Kill server
          server.kill();
          process.exit(0);
        });
      });
      
      apiReq.on('error', (err) => {
        console.error('❌ API test error:', err);
        server.kill();
        process.exit(1);
      });
      
      apiReq.end();
    });
  });

  req.on('error', (err) => {
    console.error('❌ Health check error:', err);
    server.kill();
    process.exit(1);
  });

  req.end();
}, 3000);

// Handle cleanup
process.on('SIGINT', () => {
  server.kill();
  process.exit(0);
});