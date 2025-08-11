#!/usr/bin/env node

/**
 * WebSocket Client Example
 * 
 * This example demonstrates how to connect to the CodeRunner WebSocket server
 * and subscribe to real-time deployment logs.
 * 
 * Usage:
 *   node examples/websocket-client.js <JWT_TOKEN> <DEPLOYMENT_ID>
 * 
 * Example:
 *   node examples/websocket-client.js eyJhbGciOiJIUzI1NiIs... deployment-123
 */

const { io } = require('socket.io-client');

// Configuration
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const JWT_TOKEN = process.argv[2];
const DEPLOYMENT_ID = process.argv[3];

if (!JWT_TOKEN || !DEPLOYMENT_ID) {
  console.error('❌ Missing required arguments');
  console.log('Usage: node websocket-client.js <JWT_TOKEN> <DEPLOYMENT_ID>');
  process.exit(1);
}

console.log('🔌 Connecting to WebSocket server...');
console.log(`📡 Server: ${SERVER_URL}`);
console.log(`📋 Deployment ID: ${DEPLOYMENT_ID}`);
console.log(`🔑 Token: ${JWT_TOKEN.substring(0, 20)}...`);

// Create WebSocket client
const socket = io(SERVER_URL, {
  auth: {
    token: JWT_TOKEN
  },
  transports: ['websocket', 'polling'], // Fallback to polling if websocket fails
  timeout: 10000,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  maxReconnectionAttempts: 5
});

// Connection event handlers
socket.on('connect', () => {
  console.log('✅ Connected to WebSocket server');
  console.log(`🆔 Connection ID: ${socket.id}`);
  
  // Subscribe to deployment logs
  console.log(`📋 Subscribing to deployment logs...`);
  socket.emit('subscribe', {
    type: 'subscribe',
    deploymentId: DEPLOYMENT_ID,
    options: {
      tail: 50, // Get last 50 logs initially
      follow: true // Stream new logs
    }
  });
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection failed:', error.message);
  if (error.message.includes('Authentication')) {
    console.log('💡 Check that your JWT token is valid and not expired');
  }
});

socket.on('disconnect', (reason) => {
  console.log(`❌ Disconnected: ${reason}`);
  
  if (reason === 'io server disconnect') {
    console.log('💡 Server initiated disconnect - reconnecting...');
    socket.connect();
  }
});

socket.on('reconnect', (attemptNumber) => {
  console.log(`🔄 Reconnected after ${attemptNumber} attempts`);
});

socket.on('reconnect_error', (error) => {
  console.error('❌ Reconnection failed:', error.message);
});

socket.on('reconnect_failed', () => {
  console.error('❌ All reconnection attempts failed');
  process.exit(1);
});

// Server message handlers
socket.on('connection:status', (message) => {
  console.log('📊 Connection status:', message);
  if (message.serverInfo) {
    console.log('🚀 Server features:', message.serverInfo.features.join(', '));
  }
});

socket.on('subscription:success', (response) => {
  console.log('✅ Successfully subscribed to deployment logs');
  console.log(`📋 Deployment: ${response.deploymentId}`);
  
  if (response.initialLogs && response.initialLogs.length > 0) {
    console.log(`📜 Received ${response.initialLogs.length} initial logs:`);
    console.log('─'.repeat(80));
    
    response.initialLogs.forEach((log, index) => {
      const timestamp = new Date(log.timestamp).toLocaleString();
      const level = log.level.toUpperCase().padEnd(5);
      const source = log.source.padEnd(12);
      
      console.log(`${index + 1:2}: [${timestamp}] ${level} ${source} ${log.message}`);
      
      if (log.data && Object.keys(log.data).length > 0) {
        console.log(`    Data: ${JSON.stringify(log.data)}`);
      }
    });
    console.log('─'.repeat(80));
  }
  
  console.log('👀 Watching for new logs... (Press Ctrl+C to exit)');
});

socket.on('subscription:error', (error) => {
  console.error('❌ Subscription failed:', error.error);
  console.log('💡 Error code:', error.code);
  
  if (error.code === 'ACCESS_DENIED') {
    console.log('💡 Make sure you own this deployment or have access to it');
  }
  
  process.exit(1);
});

// Real-time log streaming
socket.on('log', (message) => {
  const log = message.payload;
  const timestamp = new Date(log.timestamp).toLocaleString();
  const level = getLevelIcon(log.level) + ' ' + log.level.toUpperCase().padEnd(5);
  const source = log.source.padEnd(12);
  
  console.log(`[${timestamp}] ${level} ${source} ${log.message}`);
  
  if (log.data && Object.keys(log.data).length > 0) {
    console.log(`    📄 Data: ${JSON.stringify(log.data)}`);
  }
  
  if (log.tags && log.tags.length > 0) {
    console.log(`    🏷️  Tags: ${log.tags.join(', ')}`);
  }
});

// Deployment status updates
socket.on('status', (message) => {
  const status = message.payload;
  const timestamp = new Date(status.timestamp).toLocaleString();
  
  console.log('─'.repeat(80));
  console.log(`🔄 DEPLOYMENT STATUS CHANGE [${timestamp}]`);
  console.log(`   Deployment: ${status.deploymentId}`);
  console.log(`   Status: ${status.previousStatus || 'unknown'} → ${status.status}`);
  console.log('─'.repeat(80));
});

// Heartbeat/ping handling
socket.on('pong', (response) => {
  const latency = Date.now() - response.timestamp.getTime();
  console.log(`💓 Heartbeat: ${latency}ms latency`);
});

// Error handling
socket.on('error', (error) => {
  console.error('❌ Socket error:', error);
});

// System messages
socket.on('system:shutdown', (message) => {
  console.log('🚨 System shutdown notice:', message.message);
  console.log('💡 Server is shutting down, client will exit...');
  process.exit(0);
});

socket.on('system:alert', (message) => {
  console.log('⚠️ System alert:', message);
});

// Utility functions
function getLevelIcon(level) {
  switch (level.toLowerCase()) {
    case 'error': return '❌';
    case 'warn': return '⚠️';
    case 'info': return 'ℹ️';
    case 'debug': return '🔍';
    case 'trace': return '🔎';
    default: return '📝';
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🔄 Shutting down client...');
  
  // Unsubscribe from deployment
  socket.emit('unsubscribe', {
    type: 'unsubscribe',
    deploymentId: DEPLOYMENT_ID
  });
  
  setTimeout(() => {
    socket.disconnect();
    console.log('✅ Client disconnected');
    process.exit(0);
  }, 1000);
});

process.on('SIGTERM', () => {
  console.log('\n🔄 Received SIGTERM, shutting down...');
  socket.disconnect();
  process.exit(0);
});

// Send periodic heartbeats
setInterval(() => {
  if (socket.connected) {
    socket.emit('ping');
  }
}, 30000); // Every 30 seconds

console.log('\n📡 WebSocket client started');
console.log('🔗 Attempting to connect...');