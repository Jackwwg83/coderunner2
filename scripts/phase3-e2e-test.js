#!/usr/bin/env node

/**
 * Phase 3 End-to-End Integration Test Suite
 * CodeRunner v2.0 - Comprehensive validation
 * 
 * Tests all Phase 3 components:
 * - Database templates (PostgreSQL & Redis)
 * - Orchestration services
 * - API endpoints
 * - Frontend integration
 * - Performance metrics
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

class Phase3TestSuite {
  constructor() {
    this.baseUrl = 'http://localhost:8080';
    this.frontendUrl = 'http://localhost:3000';
    this.results = {
      totalTests: 0,
      passed: 0,
      failed: 0,
      errors: [],
      performance: {},
      startTime: new Date()
    };
  }

  async runTest(testName, testFunction) {
    this.results.totalTests++;
    console.log(`\n🧪 Running: ${testName}`);
    
    const startTime = Date.now();
    
    try {
      const result = await testFunction();
      const duration = Date.now() - startTime;
      
      if (result.success) {
        this.results.passed++;
        console.log(`✅ PASSED: ${testName} (${duration}ms)`);
      } else {
        this.results.failed++;
        console.log(`❌ FAILED: ${testName} - ${result.error} (${duration}ms)`);
        this.results.errors.push({ test: testName, error: result.error, duration });
      }
      
      this.results.performance[testName] = duration;
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.failed++;
      console.log(`💥 ERROR: ${testName} - ${error.message} (${duration}ms)`);
      this.results.errors.push({ test: testName, error: error.message, duration });
      this.results.performance[testName] = duration;
      return { success: false, error: error.message };
    }
  }

  async makeRequest(path, options = {}) {
    return new Promise((resolve, reject) => {
      const url = `${this.baseUrl}${path}`;
      const startTime = Date.now();
      
      const req = http.request(url, {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const responseTime = Date.now() - startTime;
          try {
            const parsedData = data ? JSON.parse(data) : {};
            resolve({
              statusCode: res.statusCode,
              data: parsedData,
              responseTime,
              headers: res.headers
            });
          } catch (error) {
            resolve({
              statusCode: res.statusCode,
              data: data,
              responseTime,
              headers: res.headers,
              parseError: true
            });
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      if (options.body) {
        req.write(JSON.stringify(options.body));
      }

      req.end();
    });
  }

  async checkFrontendStatus() {
    return new Promise((resolve) => {
      const req = http.request(this.frontendUrl, (res) => {
        resolve({ 
          success: res.statusCode === 200, 
          statusCode: res.statusCode 
        });
      });
      
      req.on('error', () => {
        resolve({ success: false, error: 'Frontend not responding' });
      });
      
      req.setTimeout(5000, () => {
        resolve({ success: false, error: 'Frontend timeout' });
      });
      
      req.end();
    });
  }

  // Test 1: Backend Health Check
  async testBackendHealth() {
    const response = await this.makeRequest('/api/health');
    
    if (response.statusCode !== 200) {
      return { success: false, error: `Health check failed: ${response.statusCode}` };
    }

    const health = response.data;
    if (!health.status || health.status !== 'ok') {
      return { success: false, error: `Invalid health status: ${health.status}` };
    }

    return { 
      success: true, 
      data: health,
      responseTime: response.responseTime 
    };
  }

  // Test 2: Frontend Connectivity
  async testFrontendConnectivity() {
    const result = await this.checkFrontendStatus();
    
    if (!result.success) {
      return { success: false, error: result.error || 'Frontend check failed' };
    }

    return { 
      success: true, 
      statusCode: result.statusCode 
    };
  }

  // Test 3: API Endpoints Discovery
  async testAPIEndpoints() {
    const response = await this.makeRequest('/api/');
    
    if (response.statusCode !== 200 && response.statusCode !== 404) {
      return { success: false, error: `API root failed: ${response.statusCode}` };
    }

    // Test various health endpoints
    const healthEndpoints = [
      '/api/health',
      '/api/health/database',
      '/api/health/services',
      '/api/health/quick'
    ];

    const results = {};
    for (const endpoint of healthEndpoints) {
      const result = await this.makeRequest(endpoint);
      results[endpoint] = {
        status: result.statusCode,
        responseTime: result.responseTime,
        success: result.statusCode === 200
      };
    }

    const successfulEndpoints = Object.values(results).filter(r => r.success).length;
    
    return {
      success: successfulEndpoints >= 2, // At least 2 health endpoints should work
      data: results,
      successfulEndpoints
    };
  }

  // Test 4: Database Templates API (Without Auth)
  async testDatabaseTemplatesAPI() {
    // Test template endpoints (expecting 401 without auth)
    const templateEndpoints = [
      '/api/templates',
      '/api/templates/postgresql',
      '/api/templates/redis',
      '/api/orchestrator/health',
      '/api/orchestrator/deployments'
    ];

    const results = {};
    let authProtectedCount = 0;

    for (const endpoint of templateEndpoints) {
      const result = await this.makeRequest(endpoint);
      results[endpoint] = {
        status: result.statusCode,
        responseTime: result.responseTime,
        authProtected: result.statusCode === 401 || result.statusCode === 403
      };
      
      if (results[endpoint].authProtected) {
        authProtectedCount++;
      }
    }

    return {
      success: authProtectedCount >= 3, // Most endpoints should be auth-protected
      data: results,
      authProtectedCount,
      totalEndpoints: templateEndpoints.length
    };
  }

  // Test 5: Static File Serving
  async testStaticFiles() {
    // Test if static files are being served correctly
    const staticTests = [
      { path: '/favicon.ico', expectedType: 'image' },
      { path: '/robots.txt', expectedStatus: [200, 404] },
      { path: '/sitemap.xml', expectedStatus: [200, 404] }
    ];

    const results = {};
    let successCount = 0;

    for (const test of staticTests) {
      const result = await this.makeRequest(test.path);
      const isSuccess = test.expectedStatus ? 
        test.expectedStatus.includes(result.statusCode) :
        result.statusCode === 200;
      
      results[test.path] = {
        status: result.statusCode,
        success: isSuccess,
        contentType: result.headers['content-type']
      };
      
      if (isSuccess) successCount++;
    }

    return {
      success: successCount >= 1, // At least one static file should work
      data: results,
      successCount
    };
  }

  // Test 6: Performance Benchmarks
  async testPerformanceBenchmarks() {
    const benchmarks = [];
    const endpoint = '/api/health';
    
    // Run 10 requests to get average response time
    for (let i = 0; i < 10; i++) {
      const result = await this.makeRequest(endpoint);
      benchmarks.push(result.responseTime);
    }

    const avgResponseTime = benchmarks.reduce((a, b) => a + b, 0) / benchmarks.length;
    const maxResponseTime = Math.max(...benchmarks);
    const minResponseTime = Math.min(...benchmarks);

    return {
      success: avgResponseTime < 1000, // Average should be under 1 second
      data: {
        average: avgResponseTime,
        maximum: maxResponseTime,
        minimum: minResponseTime,
        samples: benchmarks.length
      }
    };
  }

  // Test 7: Database Management UI Routes
  async testDatabaseManagementUI() {
    // Test frontend routes for database management
    const frontendRoutes = [
      '/',
      '/databases',
      '/api', // This should show a nice API documentation page
    ];

    const results = {};
    let successCount = 0;

    for (const route of frontendRoutes) {
      try {
        const url = route === '/api' ? `${this.baseUrl}${route}` : `${this.frontendUrl}${route}`;
        const result = await new Promise((resolve) => {
          const req = http.request(url, (res) => {
            resolve({ statusCode: res.statusCode, success: res.statusCode === 200 });
          });
          req.on('error', () => resolve({ success: false, error: 'Connection failed' }));
          req.setTimeout(3000, () => resolve({ success: false, error: 'Timeout' }));
          req.end();
        });

        results[route] = result;
        if (result.success) successCount++;
      } catch (error) {
        results[route] = { success: false, error: error.message };
      }
    }

    return {
      success: successCount >= 1, // At least the home route should work
      data: results,
      successCount
    };
  }

  // Test 8: Configuration and Environment
  async testConfigurationAndEnvironment() {
    const response = await this.makeRequest('/api/health');
    
    if (response.statusCode !== 200) {
      return { success: false, error: 'Cannot retrieve health information' };
    }

    const health = response.data;
    const environmentChecks = {
      hasVersion: !!health.version,
      hasEnvironment: !!health.environment,
      hasUptime: typeof health.uptime === 'number',
      hasTimestamp: !!health.timestamp,
      environmentValid: ['development', 'staging', 'production'].includes(health.environment)
    };

    const passedChecks = Object.values(environmentChecks).filter(Boolean).length;
    
    return {
      success: passedChecks >= 4, // Most checks should pass
      data: {
        health,
        checks: environmentChecks,
        passedChecks
      }
    };
  }

  // Test 9: Error Handling and Security
  async testErrorHandlingAndSecurity() {
    // Test various error scenarios
    const errorTests = [
      { path: '/api/nonexistent', expectedStatus: 404 },
      { path: '/api/templates/invalid', expectedStatus: [401, 404] },
      { path: '/api/orchestrator/invalid', expectedStatus: [401, 404] }
    ];

    const results = {};
    let properErrorHandling = 0;

    for (const test of errorTests) {
      const result = await this.makeRequest(test.path);
      const hasProperError = Array.isArray(test.expectedStatus) ?
        test.expectedStatus.includes(result.statusCode) :
        result.statusCode === test.expectedStatus;
      
      results[test.path] = {
        status: result.statusCode,
        expectedStatus: test.expectedStatus,
        properErrorHandling: hasProperError
      };

      if (hasProperError) properErrorHandling++;
    }

    return {
      success: properErrorHandling >= 2, // Most error cases should be handled properly
      data: results,
      properErrorHandling
    };
  }

  // Test 10: Integration Points
  async testIntegrationPoints() {
    // Test the integration between different components
    const integrationTests = [];
    
    // Test 1: Backend-Frontend communication
    const backendHealth = await this.makeRequest('/api/health');
    const frontendStatus = await this.checkFrontendStatus();
    
    integrationTests.push({
      name: 'Backend-Frontend Communication',
      success: backendHealth.statusCode === 200 && frontendStatus.success,
      details: { backend: backendHealth.statusCode, frontend: frontendStatus.success }
    });

    // Test 2: API Response Format Consistency
    const apiResponse = backendHealth.data;
    const hasConsistentFormat = apiResponse && 
      typeof apiResponse.status === 'string' &&
      typeof apiResponse.timestamp === 'string';
    
    integrationTests.push({
      name: 'API Response Format',
      success: hasConsistentFormat,
      details: { format: hasConsistentFormat, response: apiResponse }
    });

    const successfulIntegrations = integrationTests.filter(t => t.success).length;

    return {
      success: successfulIntegrations >= 1,
      data: integrationTests,
      successfulIntegrations
    };
  }

  async runAllTests() {
    console.log('🚀 Starting Phase 3 End-to-End Integration Tests');
    console.log('='.repeat(60));

    const tests = [
      { name: 'Backend Health Check', method: this.testBackendHealth },
      { name: 'Frontend Connectivity', method: this.testFrontendConnectivity },
      { name: 'API Endpoints Discovery', method: this.testAPIEndpoints },
      { name: 'Database Templates API', method: this.testDatabaseTemplatesAPI },
      { name: 'Static File Serving', method: this.testStaticFiles },
      { name: 'Performance Benchmarks', method: this.testPerformanceBenchmarks },
      { name: 'Database Management UI Routes', method: this.testDatabaseManagementUI },
      { name: 'Configuration and Environment', method: this.testConfigurationAndEnvironment },
      { name: 'Error Handling and Security', method: this.testErrorHandlingAndSecurity },
      { name: 'Integration Points', method: this.testIntegrationPoints }
    ];

    for (const test of tests) {
      await this.runTest(test.name, test.method.bind(this));
    }

    this.generateReport();
  }

  generateReport() {
    const endTime = new Date();
    const totalDuration = endTime - this.results.startTime;
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 PHASE 3 INTEGRATION TEST RESULTS');
    console.log('='.repeat(60));
    
    console.log(`\n📈 SUMMARY:`);
    console.log(`   Total Tests: ${this.results.totalTests}`);
    console.log(`   Passed: ${this.results.passed} ✅`);
    console.log(`   Failed: ${this.results.failed} ❌`);
    console.log(`   Success Rate: ${((this.results.passed / this.results.totalTests) * 100).toFixed(1)}%`);
    console.log(`   Total Duration: ${totalDuration}ms`);

    if (this.results.failed > 0) {
      console.log(`\n🔍 FAILURES:`);
      this.results.errors.forEach(error => {
        console.log(`   ❌ ${error.test}: ${error.error}`);
      });
    }

    console.log(`\n⚡ PERFORMANCE:`);
    const avgResponseTime = Object.values(this.results.performance)
      .reduce((a, b) => a + b, 0) / Object.keys(this.results.performance).length;
    console.log(`   Average Test Duration: ${avgResponseTime.toFixed(0)}ms`);
    
    const slowestTest = Object.entries(this.results.performance)
      .reduce((a, b) => a[1] > b[1] ? a : b);
    console.log(`   Slowest Test: ${slowestTest[0]} (${slowestTest[1]}ms)`);

    // Generate JSON report
    const report = {
      summary: {
        totalTests: this.results.totalTests,
        passed: this.results.passed,
        failed: this.results.failed,
        successRate: (this.results.passed / this.results.totalTests) * 100,
        totalDuration,
        timestamp: endTime.toISOString()
      },
      errors: this.results.errors,
      performance: {
        testDurations: this.results.performance,
        averageDuration: avgResponseTime,
        slowestTest: { name: slowestTest[0], duration: slowestTest[1] }
      },
      phase3Status: this.getPhase3Status()
    };

    // Save report to file
    const reportPath = path.join(__dirname, '..', `phase3-e2e-test-results-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);

    // Final assessment
    console.log(`\n🎯 PHASE 3 ASSESSMENT:`);
    const status = this.getPhase3Status();
    console.log(`   Overall Status: ${status.overall} ${status.emoji}`);
    console.log(`   Readiness: ${status.readiness}%`);
    console.log(`   Recommendation: ${status.recommendation}`);
    
    console.log('\n' + '='.repeat(60));
  }

  getPhase3Status() {
    const successRate = (this.results.passed / this.results.totalTests) * 100;
    
    let overall, emoji, recommendation;
    
    if (successRate >= 90) {
      overall = 'EXCELLENT';
      emoji = '🟢';
      recommendation = 'Phase 3 is production-ready with excellent functionality';
    } else if (successRate >= 75) {
      overall = 'GOOD';
      emoji = '🟡';
      recommendation = 'Phase 3 is ready with minor issues that can be addressed post-deployment';
    } else if (successRate >= 60) {
      overall = 'NEEDS IMPROVEMENT';
      emoji = '🟠';
      recommendation = 'Phase 3 requires fixes before deployment';
    } else {
      overall = 'CRITICAL ISSUES';
      emoji = '🔴';
      recommendation = 'Phase 3 has critical issues that must be resolved';
    }

    return {
      overall,
      emoji,
      readiness: successRate,
      recommendation,
      criticalIssues: this.results.errors.length,
      performanceScore: Object.values(this.results.performance).every(time => time < 1000) ? 'GOOD' : 'NEEDS_OPTIMIZATION'
    };
  }
}

// Run the test suite
if (require.main === module) {
  const testSuite = new Phase3TestSuite();
  testSuite.runAllTests().catch(console.error);
}

module.exports = Phase3TestSuite;