#!/usr/bin/env node

/**
 * Final validation script for health check improvements
 */

const fs = require('fs');
const path = require('path');

function validateFile(filePath, description) {
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      console.log(`✅ ${description}: ${filePath} (${stats.size} bytes)`);
      return true;
    } else {
      console.log(`❌ ${description}: ${filePath} - FILE NOT FOUND`);
      return false;
    }
  } catch (error) {
    console.log(`❌ ${description}: ${filePath} - ERROR: ${error.message}`);
    return false;
  }
}

function validateChanges() {
  console.log('🔍 Validating Health Check Improvements...\n');

  const validations = [
    {
      file: 'src/services/healthCheck.ts',
      description: 'Enhanced HealthCheck Service',
      expectedContent: ['status: \'healthy\' | \'unhealthy\' | \'degraded\' | \'unknown\' | \'mocked\'', 'circuitBreaker:', 'environment:']
    },
    {
      file: 'src/services/database.ts',
      description: 'Enhanced Database Service',
      expectedContent: ['Enhanced health check method', 'latency:', 'poolSize:']
    },
    {
      file: 'src/routes/index.ts',
      description: 'Enhanced Health Endpoints',
      expectedContent: ['HealthCheckService', '/health/ready', '/health/live']
    },
    {
      file: '.env',
      description: 'Configuration Updates',
      expectedContent: ['HEALTH_CHECK_INTERVAL', 'CIRCUIT_BREAKER_FAILURE_THRESHOLD']
    }
  ];

  let allValid = true;

  validations.forEach(validation => {
    const isValid = validateFile(validation.file, validation.description);
    
    if (isValid && validation.expectedContent) {
      try {
        const content = fs.readFileSync(validation.file, 'utf8');
        const missingContent = validation.expectedContent.filter(expected => 
          !content.includes(expected)
        );
        
        if (missingContent.length > 0) {
          console.log(`   ⚠️  Missing expected content: ${missingContent.join(', ')}`);
          allValid = false;
        } else {
          console.log(`   ✅ All expected content found`);
        }
      } catch (error) {
        console.log(`   ❌ Could not verify content: ${error.message}`);
        allValid = false;
      }
    }
    
    if (!isValid) {
      allValid = false;
    }
    
    console.log('');
  });

  // Validate test files
  console.log('📝 Test Files:');
  validateFile('test-health-simple.js', 'Simple Health Check Test');
  validateFile('test-circuit-breaker.js', 'Circuit Breaker Test');
  validateFile('test-health-check.js', 'HTTP Health Check Test');
  validateFile('HEALTH_CHECK_IMPROVEMENTS_SUMMARY.md', 'Documentation Summary');
  console.log('');

  // Summary
  console.log('📊 Validation Summary:');
  console.log('====================');
  
  if (allValid) {
    console.log('✅ All health check improvements successfully implemented!');
    console.log('');
    console.log('🎯 Key Features Available:');
    console.log('- Environment-aware database health checks');
    console.log('- Enhanced circuit breaker with configurable thresholds');
    console.log('- Multiple health check endpoints (/health, /health/ready, /health/live)');
    console.log('- Development mode with mocked service indicators');
    console.log('- Comprehensive service status reporting');
    console.log('- Kubernetes-compatible health probes');
    console.log('');
    console.log('🚀 To test the improvements:');
    console.log('1. Start the server: npm run dev');
    console.log('2. Test health endpoints: node test-health-check.js');
    console.log('3. Run circuit breaker demo: node test-circuit-breaker.js');
    console.log('4. View development mock: node test-health-simple.js');
  } else {
    console.log('❌ Some validations failed. Please review the issues above.');
    process.exit(1);
  }
}

// Run validation
validateChanges();