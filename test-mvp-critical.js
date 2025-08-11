#!/usr/bin/env node

/**
 * CodeRunner v2.0 - Day 6 MVP Critical Testing Script
 * This script runs manual tests to verify core functionality
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

const BACKEND_URL = 'http://localhost:8080';
const FRONTEND_URL = 'http://localhost:8083';

class MVPTester {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      tests: []
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const colors = {
      info: '\x1b[36m',    // Cyan
      success: '\x1b[32m', // Green
      error: '\x1b[31m',   // Red
      warning: '\x1b[33m', // Yellow
      reset: '\x1b[0m'     // Reset
    };
    
    console.log(`${colors[type]}[${timestamp}] ${message}${colors.reset}`);
  }

  async test(description, testFn) {
    try {
      this.log(`Testing: ${description}`, 'info');
      const startTime = performance.now();
      
      const result = await testFn();
      const duration = Math.round(performance.now() - startTime);
      
      this.results.passed++;
      this.results.tests.push({ description, status: 'PASS', duration, result });
      this.log(`✅ PASS: ${description} (${duration}ms)`, 'success');
      
      return result;
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      this.results.failed++;
      this.results.tests.push({ description, status: 'FAIL', duration, error: error.message });
      this.log(`❌ FAIL: ${description} - ${error.message}`, 'error');
      
      return null;
    }
  }

  async warn(description, testFn) {
    try {
      await testFn();
    } catch (error) {
      this.results.warnings++;
      this.log(`⚠️  WARNING: ${description} - ${error.message}`, 'warning');
    }
  }

  async testBackendHealth() {
    return await this.test('Backend Health Check', async () => {
      const response = await axios.get(`${BACKEND_URL}/api/health`, { timeout: 5000 });
      
      if (response.status !== 200) {
        throw new Error(`Health check returned status ${response.status}`);
      }
      
      const health = response.data;
      if (!health.data || !health.data.checks) {
        throw new Error('Invalid health response format');
      }
      
      // Check critical services
      const dbCheck = health.data.checks.find(check => check.name === 'database');
      if (!dbCheck || dbCheck.status !== 'healthy') {
        throw new Error('Database is not healthy');
      }
      
      return {
        status: health.data.overall,
        database: dbCheck.status,
        responseTime: health.data.summary.responseTime
      };
    });
  }

  async testFrontendLoad() {
    return await this.test('Frontend Load Test', async () => {
      const startTime = performance.now();
      const response = await axios.get(FRONTEND_URL, { timeout: 10000 });
      const loadTime = Math.round(performance.now() - startTime);
      
      if (response.status !== 200) {
        throw new Error(`Frontend returned status ${response.status}`);
      }
      
      if (!response.data.includes('CodeRunner')) {
        throw new Error('Frontend does not contain expected CodeRunner content');
      }
      
      if (loadTime > 3000) {
        throw new Error(`Load time ${loadTime}ms exceeds 3s budget`);
      }
      
      return { loadTime, size: response.data.length };
    });
  }

  async testAPIEndpoints() {
    const endpoints = [
      { path: '/api', expectedStatus: 200 },
      { path: '/api/health/database', expectedStatus: 200 },
      { path: '/api/auth/validate-password', method: 'POST', expectedStatus: 200, 
        data: { password: 'TestPassword123!' } },
      { path: '/api/nonexistent', expectedStatus: 404 }
    ];
    
    for (const endpoint of endpoints) {
      await this.test(`API Endpoint ${endpoint.path}`, async () => {
        const config = {
          method: endpoint.method || 'GET',
          url: `${BACKEND_URL}${endpoint.path}`,
          timeout: 5000
        };
        
        if (endpoint.data) {
          config.data = endpoint.data;
          config.headers = { 'Content-Type': 'application/json' };
        }
        
        try {
          const response = await axios(config);
          
          if (response.status !== endpoint.expectedStatus) {
            throw new Error(`Expected status ${endpoint.expectedStatus}, got ${response.status}`);
          }
          
          return { status: response.status, data: response.data };
        } catch (error) {
          if (error.response && error.response.status === endpoint.expectedStatus) {
            return { status: error.response.status };
          }
          throw error;
        }
      });
    }
  }

  async testFrontendPages() {
    const pages = [
      '/',
      '/deployments', 
      '/projects',
      '/databases',
      '/test-editor'
    ];
    
    for (const page of pages) {
      await this.test(`Frontend Page ${page}`, async () => {
        const response = await axios.get(`${FRONTEND_URL}${page}`, { timeout: 10000 });
        
        if (response.status !== 200) {
          throw new Error(`Page returned status ${response.status}`);
        }
        
        // Basic content checks
        const content = response.data;
        if (!content.includes('<html') || !content.includes('</html>')) {
          throw new Error('Page does not contain valid HTML structure');
        }
        
        return { status: response.status, size: content.length };
      });
    }
  }

  async testPerformance() {
    return await this.test('Performance Benchmarks', async () => {
      // Test API response time
      const apiStart = performance.now();
      await axios.get(`${BACKEND_URL}/api`);
      const apiTime = Math.round(performance.now() - apiStart);
      
      // Test frontend load time
      const frontendStart = performance.now();
      await axios.get(FRONTEND_URL);
      const frontendTime = Math.round(performance.now() - frontendStart);
      
      const results = { apiTime, frontendTime };
      
      if (apiTime > 500) {
        throw new Error(`API response time ${apiTime}ms exceeds 500ms budget`);
      }
      
      if (frontendTime > 3000) {
        throw new Error(`Frontend load time ${frontendTime}ms exceeds 3s budget`);
      }
      
      return results;
    });
  }

  async testSecurity() {
    await this.test('Security Headers Check', async () => {
      const response = await axios.get(FRONTEND_URL, { timeout: 5000 });
      
      // Check for basic security headers
      const headers = response.headers;
      const securityHeaders = ['x-frame-options', 'x-content-type-options'];
      
      const results = {};
      for (const header of securityHeaders) {
        results[header] = headers[header] || 'missing';
      }
      
      return results;
    });

    await this.warn('SQL Injection Protection', async () => {
      // Test for basic SQL injection protection
      const response = await axios.get(`${BACKEND_URL}/api/health`, {
        headers: { 'X-Test': "'; DROP TABLE users; --" }
      });
      
      // Should not cause any issues
      if (response.status !== 200) {
        throw new Error('API vulnerable to header injection');
      }
    });
  }

  async runAllTests() {
    this.log('🚀 Starting CodeRunner v2.0 MVP Testing Suite', 'info');
    this.log('='.repeat(50), 'info');
    
    // Critical Path Tests
    await this.testBackendHealth();
    await this.testFrontendLoad();
    await this.testAPIEndpoints();
    await this.testFrontendPages();
    await this.testPerformance();
    await this.testSecurity();
    
    // Generate Report
    this.generateReport();
  }

  generateReport() {
    this.log('='.repeat(50), 'info');
    this.log('📊 TEST RESULTS SUMMARY', 'info');
    this.log('='.repeat(50), 'info');
    
    const total = this.results.passed + this.results.failed;
    const passRate = Math.round((this.results.passed / total) * 100);
    
    this.log(`✅ Passed: ${this.results.passed}`, 'success');
    this.log(`❌ Failed: ${this.results.failed}`, 'error');
    this.log(`⚠️  Warnings: ${this.results.warnings}`, 'warning');
    this.log(`📈 Pass Rate: ${passRate}%`, passRate >= 80 ? 'success' : 'error');
    
    // MVP Readiness Assessment
    if (this.results.failed === 0 && passRate >= 90) {
      this.log('🎉 MVP IS READY FOR PRODUCTION!', 'success');
    } else if (this.results.failed <= 2 && passRate >= 80) {
      this.log('⚠️  MVP has minor issues but is demo-ready', 'warning');
    } else {
      this.log('❌ MVP needs fixes before deployment', 'error');
    }
    
    // Detailed Results
    this.log('\n📋 DETAILED RESULTS:', 'info');
    for (const test of this.results.tests) {
      const status = test.status === 'PASS' ? '✅' : '❌';
      this.log(`  ${status} ${test.description} (${test.duration}ms)`);
    }
    
    // Save results to file
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filename = `mvp-test-results-${timestamp}.json`;
    
    require('fs').writeFileSync(filename, JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        passed: this.results.passed,
        failed: this.results.failed,
        warnings: this.results.warnings,
        passRate,
        mvpReady: this.results.failed === 0 && passRate >= 90
      },
      tests: this.results.tests
    }, null, 2));
    
    this.log(`💾 Results saved to: ${filename}`, 'info');
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new MVPTester();
  tester.runAllTests().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = MVPTester;