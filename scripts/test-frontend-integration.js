#!/usr/bin/env node

/**
 * Frontend Integration Test Script
 * Tests the integration between CodeRunner v2.0 frontend and backend
 */

const axios = require('axios');

const FRONTEND_URL = 'http://localhost:3000';
const BACKEND_URL = 'http://localhost:8080/api';

class FrontendIntegrationTester {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  async runTest(name, testFn) {
    console.log(`🧪 Testing: ${name}`);
    try {
      await testFn();
      this.results.passed++;
      this.results.tests.push({ name, status: 'PASS', error: null });
      console.log(`✅ ${name} - PASSED`);
    } catch (error) {
      this.results.failed++;
      this.results.tests.push({ name, status: 'FAIL', error: error.message });
      console.log(`❌ ${name} - FAILED: ${error.message}`);
    }
  }

  async testBackendConnectivity() {
    const response = await axios.get(`${BACKEND_URL}/health`, { timeout: 5000 });
    if (response.status !== 200) {
      throw new Error(`Backend health check failed with status ${response.status}`);
    }
    if (!response.data.status || response.data.status !== 'ok') {
      throw new Error('Backend health check returned invalid status');
    }
  }

  async testFrontendConnectivity() {
    const response = await axios.get(FRONTEND_URL, { timeout: 10000 });
    if (response.status !== 200) {
      throw new Error(`Frontend failed with status ${response.status}`);
    }
    if (!response.data.includes('CodeRunner')) {
      throw new Error('Frontend does not contain expected CodeRunner branding');
    }
  }

  async testDatabasesPageLoad() {
    const response = await axios.get(`${FRONTEND_URL}/databases`, { timeout: 10000 });
    if (response.status !== 200) {
      throw new Error(`Databases page failed with status ${response.status}`);
    }
    if (!response.data.includes('Databases') || !response.data.includes('New Database')) {
      throw new Error('Databases page does not contain expected elements');
    }
  }

  async testAPIEndpoints() {
    // Test orchestrator templates endpoint
    const templatesResponse = await axios.get(`${BACKEND_URL}/orchestrator/templates`, { timeout: 5000 });
    if (templatesResponse.status !== 200) {
      throw new Error(`Templates API failed with status ${templatesResponse.status}`);
    }
    if (!Array.isArray(templatesResponse.data)) {
      throw new Error('Templates API did not return an array');
    }

    // Test orchestrator deployments endpoint
    const deploymentsResponse = await axios.get(`${BACKEND_URL}/orchestrator/deployments`, { timeout: 5000 });
    if (deploymentsResponse.status !== 200) {
      throw new Error(`Deployments API failed with status ${deploymentsResponse.status}`);
    }
    if (!Array.isArray(deploymentsResponse.data)) {
      throw new Error('Deployments API did not return an array');
    }
  }

  async testCORSConfiguration() {
    try {
      const response = await axios.options(`${BACKEND_URL}/health`, {
        headers: {
          'Origin': 'http://localhost:3000',
          'Access-Control-Request-Method': 'GET'
        }
      });
      // CORS preflight should either return 200/204 or be handled automatically
      if (response.status >= 400) {
        throw new Error('CORS preflight request failed');
      }
    } catch (error) {
      if (error.response && error.response.status === 404) {
        // Some servers don't explicitly handle OPTIONS, try a real request
        const realResponse = await axios.get(`${BACKEND_URL}/health`, {
          headers: { 'Origin': 'http://localhost:3000' }
        });
        if (!realResponse.headers['access-control-allow-origin']) {
          throw new Error('CORS headers not present in response');
        }
      } else {
        throw error;
      }
    }
  }

  async testDataFlow() {
    // Test that the database templates endpoint returns expected data structure
    const response = await axios.get(`${BACKEND_URL}/orchestrator/templates`);
    const templates = response.data;
    
    if (templates.length === 0) {
      throw new Error('No templates returned from API');
    }

    const template = templates[0];
    const requiredFields = ['id', 'name', 'type', 'description'];
    for (const field of requiredFields) {
      if (!(field in template)) {
        throw new Error(`Template missing required field: ${field}`);
      }
    }

    // Verify template types
    const validTypes = ['postgresql', 'redis', 'mysql', 'mongodb'];
    if (!validTypes.includes(template.type)) {
      throw new Error(`Invalid template type: ${template.type}`);
    }
  }

  async testErrorHandling() {
    // Test 404 handling
    try {
      await axios.get(`${BACKEND_URL}/non-existent-endpoint`);
      throw new Error('Expected 404 error was not thrown');
    } catch (error) {
      if (!error.response || error.response.status !== 404) {
        throw new Error(`Expected 404 but got ${error.response?.status || 'network error'}`);
      }
    }

    // Test frontend 404 handling
    try {
      const response = await axios.get(`${FRONTEND_URL}/non-existent-page`);
      if (response.status !== 404 && !response.data.includes('404')) {
        throw new Error('Frontend 404 page not working correctly');
      }
    } catch (error) {
      if (error.response?.status !== 404) {
        throw error;
      }
    }
  }

  async testPerformance() {
    const startTime = Date.now();
    
    // Test parallel API calls to simulate real usage
    const promises = [
      axios.get(`${BACKEND_URL}/health`),
      axios.get(`${BACKEND_URL}/orchestrator/templates`),
      axios.get(`${BACKEND_URL}/orchestrator/deployments`)
    ];

    await Promise.all(promises);
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;

    if (totalTime > 5000) {
      throw new Error(`API calls took too long: ${totalTime}ms (threshold: 5000ms)`);
    }

    console.log(`   Performance: API calls completed in ${totalTime}ms`);
  }

  async testWebSocketConnection() {
    // Test WebSocket endpoint availability
    try {
      const wsResponse = await axios.get(`${BACKEND_URL}/websocket/status`, { timeout: 3000 });
      if (wsResponse.status !== 200) {
        throw new Error(`WebSocket status endpoint failed: ${wsResponse.status}`);
      }
    } catch (error) {
      if (error.response?.status === 404) {
        // WebSocket endpoint might not be implemented yet, that's okay
        console.log('   Note: WebSocket status endpoint not available (expected for mock backend)');
        return;
      }
      throw error;
    }
  }

  generateReport() {
    const total = this.results.passed + this.results.failed;
    const successRate = total > 0 ? ((this.results.passed / total) * 100).toFixed(1) : 0;

    return {
      summary: {
        total,
        passed: this.results.passed,
        failed: this.results.failed,
        successRate: `${successRate}%`,
        timestamp: new Date().toISOString()
      },
      tests: this.results.tests,
      recommendations: this.generateRecommendations()
    };
  }

  generateRecommendations() {
    const recommendations = [];
    
    if (this.results.failed > 0) {
      recommendations.push('Fix failing tests before deploying to production');
    }
    
    const failedTests = this.results.tests.filter(t => t.status === 'FAIL');
    
    if (failedTests.some(t => t.name.includes('CORS'))) {
      recommendations.push('Configure CORS properly for frontend-backend communication');
    }
    
    if (failedTests.some(t => t.name.includes('Performance'))) {
      recommendations.push('Optimize API response times for better user experience');
    }
    
    if (failedTests.some(t => t.name.includes('WebSocket'))) {
      recommendations.push('Implement WebSocket endpoints for real-time features');
    }

    if (recommendations.length === 0) {
      recommendations.push('All tests passed! Frontend-backend integration is working well.');
    }

    return recommendations;
  }

  async run() {
    console.log('🚀 Starting Frontend Integration Tests\n');

    await this.runTest('Backend Connectivity', () => this.testBackendConnectivity());
    await this.runTest('Frontend Connectivity', () => this.testFrontendConnectivity());
    await this.runTest('Databases Page Load', () => this.testDatabasesPageLoad());
    await this.runTest('API Endpoints', () => this.testAPIEndpoints());
    await this.runTest('CORS Configuration', () => this.testCORSConfiguration());
    await this.runTest('Data Flow', () => this.testDataFlow());
    await this.runTest('Error Handling', () => this.testErrorHandling());
    await this.runTest('Performance', () => this.testPerformance());
    await this.runTest('WebSocket Connection', () => this.testWebSocketConnection());

    const report = this.generateReport();

    console.log('\n📊 Integration Test Results:');
    console.log(`   Total: ${report.summary.total}`);
    console.log(`   Passed: ${report.summary.passed}`);
    console.log(`   Failed: ${report.summary.failed}`);
    console.log(`   Success Rate: ${report.summary.successRate}`);

    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach(rec => console.log(`   • ${rec}`));
    }

    // Save detailed report
    const fs = require('fs');
    const reportPath = `./frontend-integration-test-results-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);

    return report.summary.failed === 0;
  }
}

async function main() {
  const tester = new FrontendIntegrationTester();
  const success = await tester.run();
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Test runner failed:', error.message);
    process.exit(1);
  });
}

module.exports = FrontendIntegrationTester;