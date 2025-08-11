const { v4: uuidv4 } = require('uuid');

module.exports = {
  generateDeploymentId,
  setupWebSocketAuth,
  trackWebSocketMetrics,
  handleWebSocketEvents
};

/**
 * Generates a random deployment ID for testing
 */
function generateDeploymentId(context, events, done) {
  context.vars.deploymentId = uuidv4();
  return done();
}

/**
 * Sets up WebSocket authentication
 */
function setupWebSocketAuth(context, events, done) {
  // Use test auth token or create one
  const testToken = process.env.TEST_AUTH_TOKEN || 'test-token-for-websocket-load';
  context.vars.authToken = testToken;
  
  events.emit('counter', 'websocket.auth_setup', 1);
  return done();
}

/**
 * Tracks WebSocket connection metrics
 */
function trackWebSocketMetrics(context, events, done) {
  const startTime = Date.now();
  context.vars.connectionStartTime = startTime;
  
  // Track connection attempt
  events.emit('counter', 'websocket.connection_attempt', 1);
  events.emit('histogram', 'websocket.connection_time', startTime);
  
  return done();
}

/**
 * Handles WebSocket events and responses
 */
function handleWebSocketEvents(context, events, done) {
  // Track different types of WebSocket events
  context.ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      
      // Track message types
      if (message.event) {
        events.emit('counter', `websocket.event.${message.event}`, 1);
      }
      
      // Track specific events
      switch (message.event) {
        case 'deployment:log':
          events.emit('counter', 'websocket.logs_received', 1);
          events.emit('histogram', 'websocket.log_latency', Date.now() - message.timestamp);
          break;
          
        case 'deployment:status':
          events.emit('counter', 'websocket.status_received', 1);
          break;
          
        case 'deployment:scaling':
          events.emit('counter', 'websocket.scaling_received', 1);
          break;
          
        case 'deployment:metrics':
          events.emit('counter', 'websocket.metrics_received', 1);
          break;
          
        case 'deployment:action:response':
          events.emit('counter', 'websocket.action_response', 1);
          if (message.data && message.data.success) {
            events.emit('counter', 'websocket.action_success', 1);
          } else {
            events.emit('counter', 'websocket.action_failure', 1);
          }
          break;
          
        case 'error':
          events.emit('counter', 'websocket.errors', 1);
          console.error('WebSocket error:', message);
          break;
      }
      
    } catch (error) {
      events.emit('counter', 'websocket.parse_errors', 1);
      console.error('Error parsing WebSocket message:', error);
    }
  });
  
  context.ws.on('error', (error) => {
    events.emit('counter', 'websocket.connection_errors', 1);
    console.error('WebSocket connection error:', error);
  });
  
  context.ws.on('close', (code, reason) => {
    events.emit('counter', 'websocket.connections_closed', 1);
    
    // Track connection duration
    if (context.vars.connectionStartTime) {
      const duration = Date.now() - context.vars.connectionStartTime;
      events.emit('histogram', 'websocket.connection_duration', duration);
    }
    
    // Track close codes
    events.emit('counter', `websocket.close_code.${code}`, 1);
    
    if (code !== 1000) { // 1000 is normal closure
      events.emit('counter', 'websocket.abnormal_closures', 1);
      console.warn(`WebSocket closed abnormally: ${code} - ${reason}`);
    }
  });
  
  context.ws.on('open', () => {
    events.emit('counter', 'websocket.connections_opened', 1);
    
    // Track connection establishment time
    if (context.vars.connectionStartTime) {
      const connectionTime = Date.now() - context.vars.connectionStartTime;
      events.emit('histogram', 'websocket.connection_establishment', connectionTime);
    }
  });
  
  return done();
}

// Additional helper functions for specific test scenarios

/**
 * Simulates rapid log message generation
 */
function simulateRapidLogs(context, events, done) {
  const logCount = Math.floor(Math.random() * 20) + 10; // 10-30 logs
  
  for (let i = 0; i < logCount; i++) {
    setTimeout(() => {
      if (context.ws && context.ws.readyState === 1) { // WebSocket.OPEN
        context.ws.send(JSON.stringify({
          event: 'test:log',
          data: {
            deploymentId: context.vars.deploymentId,
            level: ['info', 'warn', 'error'][Math.floor(Math.random() * 3)],
            message: `Rapid test log message ${i}`,
            timestamp: Date.now()
          }
        }));
        
        events.emit('counter', 'websocket.test_logs_sent', 1);
      }
    }, i * 100); // Stagger messages by 100ms
  }
  
  return done();
}

/**
 * Tests WebSocket message batching
 */
function testMessageBatching(context, events, done) {
  const batchSize = 10;
  const messages = [];
  
  for (let i = 0; i < batchSize; i++) {
    messages.push({
      event: 'batch:test',
      data: {
        sequence: i,
        timestamp: Date.now(),
        payload: `Test message ${i}`
      }
    });
  }
  
  // Send batch
  if (context.ws && context.ws.readyState === 1) {
    context.ws.send(JSON.stringify({
      event: 'batch:messages',
      data: { messages }
    }));
    
    events.emit('counter', 'websocket.batch_sent', 1);
    events.emit('histogram', 'websocket.batch_size', batchSize);
  }
  
  return done();
}

/**
 * Tests connection recovery
 */
function testConnectionRecovery(context, events, done) {
  if (Math.random() < 0.1) { // 10% chance to test recovery
    // Simulate connection issue
    if (context.ws && context.ws.readyState === 1) {
      context.ws.close(1001, 'Testing connection recovery');
      events.emit('counter', 'websocket.recovery_test', 1);
    }
  }
  
  return done();
}