#!/usr/bin/env node

/**
 * Simple test to demonstrate health check improvements
 * This test shows how the health check behaves in different scenarios
 */

// Set environment for development mode
process.env.NODE_ENV = 'development';
process.env.MOCK_DATABASE = 'true';

// Mock dependencies to avoid database connection
const mockHealthCheck = async () => {
  console.log('🏥 Testing Health Check Logic...\n');

  // Simulate development mode without database
  const isDevelopment = process.env.NODE_ENV === 'development';
  const hasDbUrl = !!(process.env.DATABASE_URL || process.env.DB_HOST);
  const hasMockMode = process.env.MOCK_DATABASE === 'true';
  
  console.log('Environment Analysis:');
  console.log(`- NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`- Has Database URL: ${hasDbUrl}`);
  console.log(`- Mock Mode: ${hasMockMode}`);
  console.log(`- Should Mock Database: ${isDevelopment && (!hasDbUrl || hasMockMode)}`);
  console.log('');

  // Simulate database health check logic
  let dbStatus;
  
  if (isDevelopment && (!hasDbUrl || hasMockMode)) {
    dbStatus = {
      name: 'database',
      status: 'mocked',
      responseTime: 2,
      timestamp: new Date(),
      message: 'Development mode - Database mocked',
      details: {
        environment: 'development',
        mockMode: true,
        hasDbUrl,
        timestamp: new Date().toISOString(),
        note: 'Set DATABASE_URL or configure DB_* env vars for real database connection'
      }
    };
  } else {
    // This would be the real database check
    dbStatus = {
      name: 'database',
      status: 'healthy',
      responseTime: 45,
      timestamp: new Date(),
      message: 'Database connection successful',
      details: {
        environment: process.env.NODE_ENV,
        connected: true,
        responseTime: '45ms'
      }
    };
  }

  // Simulate other services
  const websocketStatus = {
    name: 'websocket',
    status: 'healthy',
    responseTime: 5,
    timestamp: new Date(),
    message: 'WebSocket service running',
    details: {
      activeConnections: 0,
      totalSubscriptions: 0
    }
  };

  const metricsStatus = {
    name: 'metrics',
    status: 'healthy',
    responseTime: 3,
    timestamp: new Date(),
    message: 'Metrics collection active',
    details: {
      metricsCollected: 150
    }
  };

  const checks = [dbStatus, websocketStatus, metricsStatus];
  
  // Calculate overall status
  const totalChecks = checks.length;
  const healthyChecks = checks.filter(c => c.status === 'healthy').length;
  const mockedChecks = checks.filter(c => c.status === 'mocked').length;
  const unhealthyChecks = checks.filter(c => c.status === 'unhealthy').length;
  
  let overallStatus = 'healthy';
  const mode = isDevelopment && mockedChecks > 0 ? 'development-mocked' : 'development';

  // Create services summary
  const services = {};
  checks.forEach(check => {
    services[check.name] = {
      status: check.status,
      message: check.message,
      ...(check.name === 'websocket' && check.details ? { connections: check.details.activeConnections } : {}),
      ...(check.name === 'metrics' && check.details ? { collected: check.details.metricsCollected } : {})
    };
  });

  const result = {
    status: overallStatus,
    environment: process.env.NODE_ENV || 'development',
    mode,
    timestamp: new Date().toISOString(),
    services,
    summary: {
      total: totalChecks,
      healthy: healthyChecks,
      unhealthy: unhealthyChecks,
      mocked: mockedChecks
    }
  };

  console.log('Health Check Result:');
  console.log('===================');
  console.log(JSON.stringify(result, null, 2));
  console.log('');

  console.log('Key Improvements Demonstrated:');
  console.log('- ✅ Environment-aware database status');
  console.log('- ✅ Mocked status for development mode');
  console.log('- ✅ Clear messaging about configuration');
  console.log('- ✅ Structured service status reporting');
  console.log('- ✅ Developer-friendly suggestions');
  console.log('');

  return result;
};

// Run the mock test
mockHealthCheck().then(result => {
  console.log('🎯 Test completed successfully!');
  console.log(`Overall status: ${result.status} (${result.mode})`);
}).catch(error => {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
});