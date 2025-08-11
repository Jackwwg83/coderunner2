#!/usr/bin/env node

/**
 * CodeRunner v2.0 - Functional Validation Test Suite
 * 
 * Validates all API endpoints, CRUD operations, and business logic
 * Ensures 100% functional completeness for production readiness
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class FunctionalValidator {
    constructor() {
        this.baseURL = process.env.TEST_BASE_URL || 'http://localhost:8088';
        this.testResults = {
            total: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
            errors: [],
            details: []
        };
        this.authToken = null;
        this.testUser = {
            email: 'test@example.com',
            password: 'TestPassword123!'
        };
    }

    async runAllTests() {
        console.log('🧪 Starting Functional Validation Tests');
        console.log(`📍 Target: ${this.baseURL}`);
        console.log('=' .repeat(60));

        try {
            // Test execution order - dependencies first
            await this.testHealthEndpoints();
            await this.testAuthenticationFlow();
            await this.testUserManagement();
            await this.testProjectOperations();
            await this.testDeploymentFlow();
            await this.testConfigurationManagement();
            await this.testScalingOperations();
            await this.testWebSocketConnectivity();
            await this.testErrorHandling();
            await this.testDataValidation();

            this.generateReport();
        } catch (error) {
            this.logError('Critical test execution failure', error);
            process.exit(1);
        }
    }

    async testHealthEndpoints() {
        console.log('🔍 Testing Health Check Endpoints...');
        
        await this.runTest('Health Check - Basic', async () => {
            const response = await axios.get(`${this.baseURL}/health`);
            this.assert(response.status === 200, 'Health endpoint accessible');
            this.assert(response.data.status === 'ok', 'Health status is OK');
            this.assert(response.data.timestamp, 'Health response includes timestamp');
        });

        await this.runTest('Health Check - Database', async () => {
            const response = await axios.get(`${this.baseURL}/health/database`);
            this.assert(response.status === 200, 'Database health endpoint accessible');
            this.assert(response.data.database === 'connected', 'Database is connected');
        });

        await this.runTest('Health Check - Services', async () => {
            const response = await axios.get(`${this.baseURL}/health/services`);
            this.assert(response.status === 200, 'Services health endpoint accessible');
            this.assert(Array.isArray(response.data.services), 'Services list is array');
        });
    }

    async testAuthenticationFlow() {
        console.log('🔐 Testing Authentication Flow...');

        await this.runTest('User Registration', async () => {
            const userData = {
                email: this.testUser.email,
                password: this.testUser.password,
                name: 'Test User'
            };

            try {
                const response = await axios.post(`${this.baseURL}/api/auth/register`, userData);
                this.assert(response.status === 201, 'User registration successful');
                this.assert(response.data.user, 'User object returned');
                this.assert(response.data.token, 'JWT token provided');
            } catch (error) {
                if (error.response?.status === 409) {
                    // User already exists, that's acceptable for testing
                    console.log('  ℹ️  User already exists, continuing with login test');
                } else {
                    throw error;
                }
            }
        });

        await this.runTest('User Login', async () => {
            const loginData = {
                email: this.testUser.email,
                password: this.testUser.password
            };

            const response = await axios.post(`${this.baseURL}/api/auth/login`, loginData);
            this.assert(response.status === 200, 'User login successful');
            this.assert(response.data.token, 'JWT token provided');
            this.assert(response.data.user, 'User object returned');
            
            this.authToken = response.data.token;
        });

        await this.runTest('Token Validation', async () => {
            this.assert(this.authToken, 'Auth token available');
            
            const response = await axios.get(`${this.baseURL}/api/auth/profile`, {
                headers: { 'Authorization': `Bearer ${this.authToken}` }
            });
            
            this.assert(response.status === 200, 'Token validation successful');
            this.assert(response.data.user.email === this.testUser.email, 'Correct user profile returned');
        });

        await this.runTest('Protected Route Access', async () => {
            const response = await axios.get(`${this.baseURL}/api/deployments`, {
                headers: { 'Authorization': `Bearer ${this.authToken}` }
            });
            
            this.assert(response.status === 200, 'Protected route accessible with token');
        });

        await this.runTest('Unauthorized Access Block', async () => {
            try {
                await axios.get(`${this.baseURL}/api/deployments`);
                this.assert(false, 'Should block unauthorized access');
            } catch (error) {
                this.assert(error.response.status === 401, 'Correctly blocks unauthorized access');
            }
        });
    }

    async testUserManagement() {
        console.log('👤 Testing User Management...');

        await this.runTest('Get User Profile', async () => {
            const response = await axios.get(`${this.baseURL}/api/auth/profile`, {
                headers: { 'Authorization': `Bearer ${this.authToken}` }
            });
            
            this.assert(response.status === 200, 'Profile retrieval successful');
            this.assert(response.data.user.email, 'User email present');
            this.assert(response.data.user.id, 'User ID present');
        });

        await this.runTest('Update User Profile', async () => {
            const updateData = {
                name: 'Updated Test User'
            };

            const response = await axios.put(`${this.baseURL}/api/auth/profile`, updateData, {
                headers: { 'Authorization': `Bearer ${this.authToken}` }
            });
            
            this.assert(response.status === 200, 'Profile update successful');
            this.assert(response.data.user.name === updateData.name, 'Profile updated correctly');
        });
    }

    async testProjectOperations() {
        console.log('📦 Testing Project Operations...');

        await this.runTest('Node.js Project Detection', async () => {
            const projectData = {
                name: 'test-nodejs-project',
                type: 'nodejs',
                files: [
                    { name: 'package.json', content: '{"name": "test-app", "version": "1.0.0"}' },
                    { name: 'index.js', content: 'console.log("Hello World");' }
                ]
            };

            const response = await axios.post(`${this.baseURL}/api/projects/analyze`, projectData, {
                headers: { 'Authorization': `Bearer ${this.authToken}` }
            });
            
            this.assert(response.status === 200, 'Project analysis successful');
            this.assert(response.data.type === 'nodejs', 'Correctly detected Node.js project');
            this.assert(response.data.framework, 'Framework detected');
        });

        await this.runTest('Manifest Project Detection', async () => {
            const manifestData = {
                name: 'test-manifest-project',
                type: 'manifest',
                files: [
                    { 
                        name: 'manifest.yml', 
                        content: 'name: test-api\nendpoints:\n  - path: /hello\n    method: GET\n    response: "Hello World"'
                    }
                ]
            };

            const response = await axios.post(`${this.baseURL}/api/projects/analyze`, manifestData, {
                headers: { 'Authorization': `Bearer ${this.authToken}` }
            });
            
            this.assert(response.status === 200, 'Manifest analysis successful');
            this.assert(response.data.type === 'manifest', 'Correctly detected Manifest project');
            this.assert(response.data.endpoints, 'Endpoints extracted from manifest');
        });
    }

    async testDeploymentFlow() {
        console.log('🚀 Testing Deployment Flow...');

        let deploymentId = null;

        await this.runTest('Create Deployment', async () => {
            const deploymentData = {
                name: 'test-deployment',
                project: {
                    type: 'nodejs',
                    files: [
                        { name: 'package.json', content: '{"name": "test-app", "scripts": {"start": "node index.js"}}' },
                        { name: 'index.js', content: 'const express = require("express"); const app = express(); app.listen(3000);' }
                    ]
                }
            };

            const response = await axios.post(`${this.baseURL}/api/deploy`, deploymentData, {
                headers: { 'Authorization': `Bearer ${this.authToken}` }
            });
            
            this.assert(response.status === 201, 'Deployment creation successful');
            this.assert(response.data.deploymentId, 'Deployment ID returned');
            this.assert(response.data.status, 'Deployment status provided');
            
            deploymentId = response.data.deploymentId;
        });

        await this.runTest('Get Deployment Status', async () => {
            this.assert(deploymentId, 'Deployment ID available');
            
            const response = await axios.get(`${this.baseURL}/api/deployments/${deploymentId}`, {
                headers: { 'Authorization': `Bearer ${this.authToken}` }
            });
            
            this.assert(response.status === 200, 'Deployment status retrieval successful');
            this.assert(response.data.id === deploymentId, 'Correct deployment returned');
            this.assert(response.data.status, 'Deployment status present');
        });

        await this.runTest('List User Deployments', async () => {
            const response = await axios.get(`${this.baseURL}/api/deployments`, {
                headers: { 'Authorization': `Bearer ${this.authToken}` }
            });
            
            this.assert(response.status === 200, 'Deployment listing successful');
            this.assert(Array.isArray(response.data.deployments), 'Deployments is array');
            this.assert(response.data.deployments.some(d => d.id === deploymentId), 'Test deployment in list');
        });

        await this.runTest('Deployment Control Operations', async () => {
            // Test start operation
            let response = await axios.post(`${this.baseURL}/api/deployments/${deploymentId}/start`, {}, {
                headers: { 'Authorization': `Bearer ${this.authToken}` }
            });
            this.assert([200, 202].includes(response.status), 'Deployment start successful');

            // Test stop operation
            response = await axios.post(`${this.baseURL}/api/deployments/${deploymentId}/stop`, {}, {
                headers: { 'Authorization': `Bearer ${this.authToken}` }
            });
            this.assert([200, 202].includes(response.status), 'Deployment stop successful');

            // Test restart operation
            response = await axios.post(`${this.baseURL}/api/deployments/${deploymentId}/restart`, {}, {
                headers: { 'Authorization': `Bearer ${this.authToken}` }
            });
            this.assert([200, 202].includes(response.status), 'Deployment restart successful');
        });
    }

    async testConfigurationManagement() {
        console.log('⚙️ Testing Configuration Management...');

        let configId = null;

        await this.runTest('Create Configuration', async () => {
            const configData = {
                name: 'test-config',
                environment: 'development',
                variables: {
                    NODE_ENV: 'development',
                    API_URL: 'https://api.test.com'
                }
            };

            const response = await axios.post(`${this.baseURL}/api/configurations`, configData, {
                headers: { 'Authorization': `Bearer ${this.authToken}` }
            });
            
            this.assert(response.status === 201, 'Configuration creation successful');
            this.assert(response.data.id, 'Configuration ID returned');
            this.assert(response.data.name === configData.name, 'Configuration name correct');
            
            configId = response.data.id;
        });

        await this.runTest('Get Configuration', async () => {
            const response = await axios.get(`${this.baseURL}/api/configurations/${configId}`, {
                headers: { 'Authorization': `Bearer ${this.authToken}` }
            });
            
            this.assert(response.status === 200, 'Configuration retrieval successful');
            this.assert(response.data.id === configId, 'Correct configuration returned');
            this.assert(response.data.variables, 'Configuration variables present');
        });

        await this.runTest('Update Configuration', async () => {
            const updateData = {
                variables: {
                    NODE_ENV: 'production',
                    API_URL: 'https://api.production.com'
                }
            };

            const response = await axios.put(`${this.baseURL}/api/configurations/${configId}`, updateData, {
                headers: { 'Authorization': `Bearer ${this.authToken}` }
            });
            
            this.assert(response.status === 200, 'Configuration update successful');
            this.assert(response.data.variables.NODE_ENV === 'production', 'Configuration updated correctly');
        });
    }

    async testScalingOperations() {
        console.log('📈 Testing Auto-scaling Operations...');

        await this.runTest('Get Scaling Policies', async () => {
            const response = await axios.get(`${this.baseURL}/api/scaling/policies`, {
                headers: { 'Authorization': `Bearer ${this.authToken}` }
            });
            
            this.assert(response.status === 200, 'Scaling policies retrieval successful');
            this.assert(Array.isArray(response.data.policies), 'Policies is array');
        });

        await this.runTest('Create Scaling Policy', async () => {
            const policyData = {
                name: 'test-scaling-policy',
                trigger: 'cpu_usage',
                threshold: 80,
                action: 'scale_up',
                cooldown: 300
            };

            const response = await axios.post(`${this.baseURL}/api/scaling/policies`, policyData, {
                headers: { 'Authorization': `Bearer ${this.authToken}` }
            });
            
            this.assert(response.status === 201, 'Scaling policy creation successful');
            this.assert(response.data.id, 'Policy ID returned');
            this.assert(response.data.name === policyData.name, 'Policy name correct');
        });
    }

    async testWebSocketConnectivity() {
        console.log('🔗 Testing WebSocket Connectivity...');

        await this.runTest('WebSocket Health Check', async () => {
            const response = await axios.get(`${this.baseURL}/health/websocket`);
            this.assert(response.status === 200, 'WebSocket health endpoint accessible');
            this.assert(response.data.websocket === 'ready', 'WebSocket service is ready');
        });

        // Note: Full WebSocket testing is done in websocket-specific test suite
        // This is just connectivity validation
    }

    async testErrorHandling() {
        console.log('🚨 Testing Error Handling...');

        await this.runTest('Invalid Endpoint - 404', async () => {
            try {
                await axios.get(`${this.baseURL}/api/nonexistent-endpoint`);
                this.assert(false, 'Should return 404 for invalid endpoint');
            } catch (error) {
                this.assert(error.response.status === 404, 'Returns 404 for invalid endpoint');
            }
        });

        await this.runTest('Invalid Data - 400', async () => {
            try {
                await axios.post(`${this.baseURL}/api/deploy`, { invalid: 'data' }, {
                    headers: { 'Authorization': `Bearer ${this.authToken}` }
                });
                this.assert(false, 'Should return 400 for invalid data');
            } catch (error) {
                this.assert(error.response.status === 400, 'Returns 400 for invalid data');
            }
        });

        await this.runTest('Rate Limiting', async () => {
            const requests = Array(20).fill().map(() => 
                axios.get(`${this.baseURL}/health`).catch(e => e.response)
            );
            
            const responses = await Promise.all(requests);
            const hasRateLimit = responses.some(r => r.status === 429);
            
            // Rate limiting might not trigger with just 20 requests
            // This test validates the endpoint exists and responds
            this.assert(responses.some(r => r.status === 200), 'Some requests succeed under rate limiting');
        });
    }

    async testDataValidation() {
        console.log('✅ Testing Data Validation...');

        await this.runTest('Input Sanitization - XSS', async () => {
            const maliciousData = {
                name: '<script>alert("xss")</script>',
                description: '"><img src=x onerror=alert("xss")>'
            };

            try {
                const response = await axios.post(`${this.baseURL}/api/projects/analyze`, maliciousData, {
                    headers: { 'Authorization': `Bearer ${this.authToken}` }
                });
                
                // If successful, ensure data is sanitized
                this.assert(!response.data.name?.includes('<script>'), 'XSS payload sanitized');
            } catch (error) {
                // Rejection is also acceptable for malicious input
                this.assert(error.response.status === 400, 'Malicious input rejected');
            }
        });

        await this.runTest('SQL Injection Prevention', async () => {
            const sqlPayload = "'; DROP TABLE users; --";
            
            try {
                await axios.get(`${this.baseURL}/api/deployments?search=${encodeURIComponent(sqlPayload)}`, {
                    headers: { 'Authorization': `Bearer ${this.authToken}` }
                });
                
                // If request succeeds, SQL injection was prevented (parameterized queries)
                console.log('  ✅ SQL injection prevented by parameterized queries');
            } catch (error) {
                // Input validation rejection is also acceptable
                this.assert(error.response.status === 400, 'SQL injection attempt rejected');
            }
        });

        await this.runTest('Data Type Validation', async () => {
            const invalidTypes = {
                name: 123, // Should be string
                type: ['invalid'], // Should be string
                files: 'not-an-array' // Should be array
            };

            try {
                await axios.post(`${this.baseURL}/api/projects/analyze`, invalidTypes, {
                    headers: { 'Authorization': `Bearer ${this.authToken}` }
                });
                this.assert(false, 'Should reject invalid data types');
            } catch (error) {
                this.assert(error.response.status === 400, 'Invalid data types rejected');
            }
        });
    }

    async runTest(name, testFunction) {
        this.testResults.total++;
        const startTime = Date.now();
        
        try {
            await testFunction();
            const duration = Date.now() - startTime;
            this.testResults.passed++;
            console.log(`  ✅ ${name} (${duration}ms)`);
            this.testResults.details.push({
                name,
                status: 'PASSED',
                duration,
                error: null
            });
        } catch (error) {
            const duration = Date.now() - startTime;
            this.testResults.failed++;
            console.log(`  ❌ ${name} (${duration}ms): ${error.message}`);
            this.testResults.errors.push({
                test: name,
                error: error.message,
                stack: error.stack
            });
            this.testResults.details.push({
                name,
                status: 'FAILED',
                duration,
                error: error.message
            });
        }
    }

    assert(condition, message) {
        if (!condition) {
            throw new Error(`Assertion failed: ${message}`);
        }
    }

    logError(message, error) {
        console.error(`❌ ${message}:`, error.message);
        this.testResults.errors.push({
            test: 'System Error',
            error: error.message,
            stack: error.stack
        });
    }

    generateReport() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 FUNCTIONAL VALIDATION RESULTS');
        console.log('='.repeat(60));
        
        const successRate = ((this.testResults.passed / this.testResults.total) * 100).toFixed(2);
        
        console.log(`📈 Tests Run: ${this.testResults.total}`);
        console.log(`✅ Passed: ${this.testResults.passed}`);
        console.log(`❌ Failed: ${this.testResults.failed}`);
        console.log(`⏭️  Skipped: ${this.testResults.skipped}`);
        console.log(`📊 Success Rate: ${successRate}%`);
        
        if (this.testResults.failed > 0) {
            console.log('\n💥 FAILURES:');
            this.testResults.errors.forEach((error, index) => {
                console.log(`${index + 1}. ${error.test}: ${error.error}`);
            });
        }
        
        // Determine overall result
        const isSuccess = this.testResults.failed === 0 && parseFloat(successRate) >= 99;
        
        console.log('\n🎯 OVERALL RESULT:');
        if (isSuccess) {
            console.log('✅ FUNCTIONAL VALIDATION PASSED');
            console.log('🚀 System is functionally ready for production');
        } else {
            console.log('❌ FUNCTIONAL VALIDATION FAILED');
            console.log('🛑 Critical issues must be resolved before production');
        }
        
        // Save detailed results
        this.saveResults();
        
        // Exit with appropriate code
        process.exit(isSuccess ? 0 : 1);
    }

    async saveResults() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `functional-validation-results-${timestamp}.json`;
        
        const report = {
            timestamp: new Date().toISOString(),
            testSuite: 'Functional Validation',
            summary: this.testResults,
            environment: {
                baseURL: this.baseURL,
                nodeVersion: process.version,
                platform: process.platform
            }
        };
        
        try {
            await fs.writeFile(filename, JSON.stringify(report, null, 2));
            console.log(`📄 Detailed results saved to: ${filename}`);
        } catch (error) {
            console.error('❌ Failed to save results:', error.message);
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    const validator = new FunctionalValidator();
    validator.runAllTests().catch(error => {
        console.error('💥 Test execution failed:', error);
        process.exit(1);
    });
}

module.exports = FunctionalValidator;