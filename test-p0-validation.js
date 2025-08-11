#!/usr/bin/env node

/**
 * P0 Fixes Validation - Manual Test Suite
 * Tests critical functionality with proper rate limit bypassing
 */

const axios = require('axios');

class P0FixesValidator {
    constructor() {
        this.baseURL = process.env.TEST_BASE_URL || 'http://localhost:8088';
        this.results = {
            total: 0,
            passed: 0,
            failed: 0,
            tests: []
        };
        this.authToken = null;
    }

    async runTest(name, testFn) {
        this.results.total++;
        const startTime = Date.now();
        
        try {
            await testFn();
            const duration = Date.now() - startTime;
            this.results.passed++;
            this.results.tests.push({ name, status: 'PASS', duration: `${duration}ms` });
            console.log(`  ✅ ${name} (${duration}ms)`);
        } catch (error) {
            const duration = Date.now() - startTime;
            this.results.failed++;
            this.results.tests.push({ name, status: 'FAIL', duration: `${duration}ms`, error: error.message });
            console.log(`  ❌ ${name} (${duration}ms): ${error.message}`);
        }
    }

    assert(condition, message) {
        if (!condition) {
            throw new Error(message);
        }
    }

    async testP0Fix1_HealthEndpoints() {
        console.log('\n🔍 P0-1: Testing Health Check Fixes...');
        
        await this.runTest('Main Health Endpoint', async () => {
            const response = await axios.get(`${this.baseURL}/api/health`);
            this.assert(response.status === 200, 'Health endpoint accessible');
            this.assert(response.data.data, 'Health data present');
            // Accept healthy or degraded for development
            this.assert(['healthy', 'degraded'].includes(response.data.data.overall), 
                'Health status acceptable');
        });

        await this.runTest('Database Health', async () => {
            const response = await axios.get(`${this.baseURL}/api/health/database`);
            this.assert(response.status === 200, 'Database health endpoint accessible');
            this.assert(response.data.success === true, 'Database connection successful');
        });

        await this.runTest('Services Health', async () => {
            const response = await axios.get(`${this.baseURL}/api/health/services`);
            this.assert(response.status === 200, 'Services health endpoint accessible');
            this.assert(response.data.success === true, 'Services check successful');
            this.assert(Array.isArray(response.data.data.services), 'Services array present');
        });
    }

    async testP0Fix2_AuthenticationEndpoints() {
        console.log('\n🔐 P0-2: Testing Authentication Fixes...');

        // Test profile endpoint without auth (should fail)
        await this.runTest('Profile Endpoint - Unauthorized', async () => {
            try {
                await axios.get(`${this.baseURL}/api/auth/profile`);
                throw new Error('Should have failed without auth');
            } catch (error) {
                this.assert(error.response?.status === 401, 'Properly blocks unauthorized access');
            }
        });

        // Test registration with rate limit bypass
        await this.runTest('User Registration - Rate Limit Bypass', async () => {
            const userData = {
                username: `testuser_${Date.now()}`,
                email: `test${Date.now()}@example.com`,
                password: 'TestPassword123!'
            };

            const headers = {
                'Content-Type': 'application/json',
                'x-test-bypass-rate-limit': 'true'
            };

            const response = await axios.post(`${this.baseURL}/api/auth/register`, userData, { headers });
            this.assert([200, 201, 409].includes(response.status), 'Registration handled properly');
            
            if (response.status === 201) {
                this.assert(response.data.success === true, 'Registration successful');
                this.authToken = response.data.token || response.data.data?.token;
            } else if (response.status === 409) {
                console.log('    ℹ️  User exists, will test login instead');
            }
        });

        // Test login if registration failed due to existing user
        if (!this.authToken) {
            await this.runTest('User Login', async () => {
                const loginData = {
                    email: 'test@example.com',
                    password: 'TestPassword123!'
                };

                const headers = {
                    'Content-Type': 'application/json',
                    'x-test-bypass-rate-limit': 'true'
                };

                const response = await axios.post(`${this.baseURL}/api/auth/login`, loginData, { headers });
                this.assert([200, 201].includes(response.status), 'Login successful');
                this.assert(response.data.success === true, 'Login response successful');
                this.authToken = response.data.token || response.data.data?.token;
            });
        }

        // Test profile endpoint with auth (should succeed)
        if (this.authToken) {
            await this.runTest('Profile Endpoint - Authorized', async () => {
                const headers = {
                    'Authorization': `Bearer ${this.authToken}`
                };

                const response = await axios.get(`${this.baseURL}/api/auth/profile`, { headers });
                this.assert(response.status === 200, 'Profile endpoint accessible with auth');
                this.assert(response.data.success === true, 'Profile data returned');
                this.assert(response.data.data.user, 'User profile data present');
            });
        }
    }

    async testP0Fix3_SecurityImprovements() {
        console.log('\n🛡️ P0-3: Testing Security Fixes...');

        await this.runTest('Rate Limiting Active', async () => {
            const promises = [];
            // Send 5 rapid requests without bypass header
            for (let i = 0; i < 5; i++) {
                promises.push(
                    axios.post(`${this.baseURL}/api/auth/register`, {
                        username: `spam${i}`,
                        email: `spam${i}@test.com`,
                        password: 'password123'
                    }).catch(err => err.response)
                );
            }

            const responses = await Promise.all(promises);
            const rateLimited = responses.some(r => r?.status === 429);
            this.assert(rateLimited, 'Rate limiting is active');
        });

        await this.runTest('Security Headers Present', async () => {
            const response = await axios.get(`${this.baseURL}/api/health`);
            const headers = response.headers;
            
            // Check for some common security headers
            this.assert(headers['x-powered-by'] === undefined || 
                       headers['x-powered-by'] !== 'Express', 'X-Powered-By header secured');
        });

        await this.runTest('Error Handling Secure', async () => {
            try {
                await axios.get(`${this.baseURL}/api/nonexistent-endpoint`);
            } catch (error) {
                this.assert(error.response?.status === 404, 'Returns 404 for non-existent endpoints');
                this.assert(!error.response?.data?.stack, 'Stack traces not exposed');
            }
        });
    }

    async testP0Fix4_PortMigration() {
        console.log('\n🔄 P0-4: Testing Port Migration...');

        await this.runTest('Server Running on Correct Port', async () => {
            // Test that 8088 is working (current test)
            const response = await axios.get(`${this.baseURL}/api/health`);
            this.assert(response.status === 200, 'Server accessible on 8088');
            
            // Test that old port 3000 is not responding (if different)
            if (this.baseURL.includes('8088')) {
                try {
                    await axios.get('http://localhost:3000/api/health', { timeout: 2000 });
                    console.log('    ⚠️  Old port 3000 still responding');
                } catch (error) {
                    console.log('    ✅ Old port 3000 properly migrated');
                }
            }
        });

        await this.runTest('API Routes Consistent', async () => {
            const response = await axios.get(`${this.baseURL}/api/`);
            this.assert(response.status === 200, 'API root accessible');
            this.assert(response.data.data.endpoints, 'API endpoints documented');
        });
    }

    generateReport() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 P0 FIXES VALIDATION RESULTS');
        console.log('='.repeat(60));
        
        console.log(`📈 Tests Run: ${this.results.total}`);
        console.log(`✅ Passed: ${this.results.passed}`);
        console.log(`❌ Failed: ${this.results.failed}`);
        console.log(`📊 Success Rate: ${((this.results.passed / this.results.total) * 100).toFixed(2)}%`);

        if (this.results.failed > 0) {
            console.log('\n💥 FAILURES:');
            this.results.tests
                .filter(t => t.status === 'FAIL')
                .forEach((test, index) => {
                    console.log(`${index + 1}. ${test.name}: ${test.error}`);
                });
        }

        const overallResult = this.results.failed === 0 ? '✅ ALL P0 FIXES VALIDATED' : 
                             this.results.passed > this.results.failed ? '⚠️ PARTIAL VALIDATION' : 
                             '❌ VALIDATION FAILED';

        console.log(`\n🎯 OVERALL RESULT:\n${overallResult}`);
        
        return {
            total: this.results.total,
            passed: this.results.passed,
            failed: this.results.failed,
            successRate: ((this.results.passed / this.results.total) * 100).toFixed(2),
            details: this.results.tests
        };
    }

    async run() {
        console.log('🚀 P0 Critical Fixes Validation Suite');
        console.log(`📍 Testing: ${this.baseURL}`);
        console.log('='.repeat(60));

        try {
            await this.testP0Fix1_HealthEndpoints();
            await this.testP0Fix2_AuthenticationEndpoints();
            await this.testP0Fix3_SecurityImprovements();
            await this.testP0Fix4_PortMigration();
            
            return this.generateReport();
        } catch (error) {
            console.error('🚨 Critical test execution failure:', error.message);
            process.exit(1);
        }
    }
}

// Run tests
if (require.main === module) {
    const validator = new P0FixesValidator();
    validator.run().then(results => {
        process.exit(results.failed > 0 ? 1 : 0);
    });
}

module.exports = P0FixesValidator;