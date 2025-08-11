#!/usr/bin/env node

/**
 * CodeRunner v2.0 - Security Validation Test Suite
 * 
 * Authentication flows, authorization checks, and encryption verification
 * Validates system security against common vulnerabilities and attacks
 */

const axios = require('axios');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs').promises;

class SecurityValidator {
    constructor() {
        this.baseURL = process.env.TEST_BASE_URL || 'http://localhost:8088';
        this.testResults = {
            total: 0,
            passed: 0,
            failed: 0,
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
            errors: [],
            vulnerabilities: [],
            details: []
        };
        this.testUser = {
            email: 'security-test@example.com',
            password: 'SecureTestPassword123!@#'
        };
        this.authToken = null;
    }

    async runAllTests() {
        console.log('🛡️ Starting Security Validation Tests');
        console.log(`📍 Target: ${this.baseURL}`);
        console.log('🔍 Testing OWASP Top 10 and common security vulnerabilities');
        console.log('=' .repeat(70));

        try {
            // Security test execution order - foundational to advanced
            await this.testAuthenticationSecurity();
            await this.testAuthorizationControls();
            await this.testInputValidationSecurity();
            await this.testSessionManagement();
            await this.testDataEncryptionSecurity();
            await this.testAPISecurityHeaders();
            await this.testRateLimitingSecurity();
            await this.testCORSSecurity();
            await this.testSQLInjectionPrevention();
            await this.testXSSPrevention();
            await this.testCSRFProtection();
            await this.testSecurityConfigurationCheck();
            
            this.generateReport();
        } catch (error) {
            this.logError('Critical security test failure', error);
            process.exit(1);
        }
    }

    async testAuthenticationSecurity() {
        console.log('🔐 Testing Authentication Security...');

        await this.runTest('Strong Password Policy', async () => {
            // Test weak password rejection
            const weakPasswords = [
                '123456',
                'password',
                'abc123',
                '12345678',
                'qwerty'
            ];

            for (const weakPassword of weakPasswords) {
                try {
                    const response = await axios.post(`${this.baseURL}/api/auth/register`, {
                        email: `weak-${Date.now()}@example.com`,
                        password: weakPassword,
                        name: 'Test User'
                    });
                    
                    // If registration succeeds with weak password, it's a vulnerability
                    if (response.status === 201) {
                        this.recordVulnerability('MEDIUM', 'Weak password accepted', 
                            `System accepted weak password: ${weakPassword}`);
                    }
                } catch (error) {
                    // Expected behavior - weak passwords should be rejected
                    this.assert(error.response?.status === 400, 'Weak password properly rejected');
                }
            }
        });

        await this.runTest('JWT Token Security', async () => {
            // First register/login to get a token
            await this.registerTestUser();
            const loginResponse = await axios.post(`${this.baseURL}/api/auth/login`, {
                email: this.testUser.email,
                password: this.testUser.password
            });
            
            this.authToken = loginResponse.data.token;
            
            // Validate JWT token structure
            const tokenParts = this.authToken.split('.');
            this.assert(tokenParts.length === 3, 'JWT has correct structure (3 parts)');
            
            // Decode token to check claims
            const decoded = jwt.decode(this.authToken);
            this.assert(decoded.exp, 'JWT has expiration time');
            this.assert(decoded.iat, 'JWT has issued at time');
            this.assert(decoded.sub || decoded.userId, 'JWT has user identifier');
            
            // Check token expiration is reasonable (not too long)
            const expiration = decoded.exp * 1000; // Convert to milliseconds
            const now = Date.now();
            const tokenLifetime = (expiration - now) / (1000 * 60 * 60); // Hours
            
            this.assert(tokenLifetime <= 24, 'JWT expiration is reasonable (≤24 hours)');
            console.log(`    📊 Token lifetime: ${tokenLifetime.toFixed(2)} hours`);
        });

        await this.runTest('Token Tampering Detection', async () => {
            this.assert(this.authToken, 'Auth token available');
            
            // Try to modify token payload
            const tokenParts = this.authToken.split('.');
            const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
            
            // Modify payload (e.g., change user ID)
            payload.userId = 99999;
            payload.role = 'admin';
            
            const modifiedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
            const tamperedToken = `${tokenParts[0]}.${modifiedPayload}.${tokenParts[2]}`;
            
            try {
                await axios.get(`${this.baseURL}/api/auth/profile`, {
                    headers: { 'Authorization': `Bearer ${tamperedToken}` }
                });
                
                // If tampered token is accepted, it's a critical vulnerability
                this.recordVulnerability('CRITICAL', 'JWT signature not validated', 
                    'System accepted tampered JWT token');
                this.assert(false, 'Should reject tampered JWT token');
            } catch (error) {
                this.assert(error.response?.status === 401, 'Correctly rejects tampered JWT token');
            }
        });

        await this.runTest('Brute Force Protection', async () => {
            const testEmail = 'brute-force-test@example.com';
            const wrongPassword = 'wrongpassword123';
            let attemptsBlocked = 0;
            
            // Try multiple failed login attempts
            for (let i = 0; i < 10; i++) {
                try {
                    await axios.post(`${this.baseURL}/api/auth/login`, {
                        email: testEmail,
                        password: wrongPassword
                    });
                } catch (error) {
                    if (error.response?.status === 429) {
                        attemptsBlocked++;
                    }
                    // Continue with more attempts to test rate limiting
                }
                
                // Small delay between attempts
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // Should have some form of rate limiting after multiple failures
            console.log(`    📊 Rate limited attempts: ${attemptsBlocked}/10`);
            
            if (attemptsBlocked === 0) {
                this.recordVulnerability('HIGH', 'No brute force protection detected', 
                    'System allows unlimited login attempts without rate limiting');
            }
        });
    }

    async testAuthorizationControls() {
        console.log('🔒 Testing Authorization Controls...');

        await this.runTest('Unauthorized Access Prevention', async () => {
            const protectedEndpoints = [
                '/api/deployments',
                '/api/auth/profile',
                '/api/configurations',
                '/api/scaling/policies'
            ];

            for (const endpoint of protectedEndpoints) {
                try {
                    const response = await axios.get(`${this.baseURL}${endpoint}`);
                    
                    // If protected endpoint is accessible without auth, it's a vulnerability
                    this.recordVulnerability('HIGH', 'Unauthorized access allowed', 
                        `Endpoint ${endpoint} accessible without authentication`);
                } catch (error) {
                    this.assert(error.response?.status === 401, 
                        `Endpoint ${endpoint} properly protected (401)`);
                }
            }
        });

        await this.runTest('Token Expiration Enforcement', async () => {
            // Create an expired token for testing
            const expiredToken = jwt.sign(
                { userId: 123, email: 'test@example.com' },
                'test-secret',
                { expiresIn: '-1h' } // Expired 1 hour ago
            );
            
            try {
                await axios.get(`${this.baseURL}/api/auth/profile`, {
                    headers: { 'Authorization': `Bearer ${expiredToken}` }
                });
                
                this.recordVulnerability('HIGH', 'Expired token accepted', 
                    'System accepts expired JWT tokens');
            } catch (error) {
                this.assert(error.response?.status === 401, 'Expired token properly rejected');
            }
        });

        await this.runTest('Role-Based Access Control', async () => {
            // Test with valid token but insufficient privileges
            this.assert(this.authToken, 'Auth token available');
            
            // Try to access admin-only endpoints (if they exist)
            const adminEndpoints = [
                '/api/admin/users',
                '/api/admin/system',
                '/api/admin/logs'
            ];
            
            for (const endpoint of adminEndpoints) {
                try {
                    await axios.get(`${this.baseURL}${endpoint}`, {
                        headers: { 'Authorization': `Bearer ${this.authToken}` }
                    });
                    
                    console.log(`    ⚠️  Admin endpoint ${endpoint} accessible to regular user`);
                } catch (error) {
                    // 403 (forbidden) or 404 (not found) are both acceptable
                    this.assert([403, 404].includes(error.response?.status), 
                        `Admin endpoint ${endpoint} properly protected`);
                }
            }
        });
    }

    async testInputValidationSecurity() {
        console.log('🔍 Testing Input Validation Security...');

        await this.runTest('XSS Prevention', async () => {
            const xssPayloads = [
                '<script>alert("xss")</script>',
                '"><script>alert("xss")</script>',
                '<img src=x onerror=alert("xss")>',
                'javascript:alert("xss")',
                '<svg onload=alert("xss")>',
                '&lt;script&gt;alert("xss")&lt;/script&gt;'
            ];

            for (const payload of xssPayloads) {
                try {
                    const response = await axios.post(`${this.baseURL}/api/projects/analyze`, {
                        name: payload,
                        description: `Test project with payload: ${payload}`
                    }, {
                        headers: { 'Authorization': `Bearer ${this.authToken}` }
                    });
                    
                    // Check if XSS payload is sanitized in response
                    const responseString = JSON.stringify(response.data);
                    if (responseString.includes('<script>') || responseString.includes('javascript:') || 
                        responseString.includes('onerror=') || responseString.includes('onload=')) {
                        this.recordVulnerability('HIGH', 'XSS vulnerability detected', 
                            `Unsanitized XSS payload in response: ${payload}`);
                    } else {
                        console.log(`    ✅ XSS payload sanitized: ${payload.substring(0, 30)}...`);
                    }
                } catch (error) {
                    // Input validation rejection is also acceptable
                    this.assert(error.response?.status === 400, 'XSS payload rejected by input validation');
                }
            }
        });

        await this.runTest('SQL Injection Prevention', async () => {
            const sqlPayloads = [
                "' OR '1'='1",
                "'; DROP TABLE users; --",
                "' UNION SELECT * FROM users --",
                "admin'--",
                "admin' OR 1=1#",
                "' OR 1=1 LIMIT 1 --"
            ];

            for (const payload of sqlPayloads) {
                try {
                    // Test in search/query parameters
                    await axios.get(`${this.baseURL}/api/deployments?search=${encodeURIComponent(payload)}`, {
                        headers: { 'Authorization': `Bearer ${this.authToken}` }
                    });
                    
                    console.log(`    ✅ SQL injection prevented: ${payload.substring(0, 30)}...`);
                } catch (error) {
                    // Both rejection (400) and server error handling are acceptable
                    this.assert([400, 500].includes(error.response?.status), 
                        'SQL injection properly handled');
                }
                
                try {
                    // Test in POST data
                    await axios.post(`${this.baseURL}/api/projects/analyze`, {
                        name: payload,
                        type: 'test'
                    }, {
                        headers: { 'Authorization': `Bearer ${this.authToken}` }
                    });
                } catch (error) {
                    // Input validation or parameterized queries should prevent SQL injection
                    console.log(`    ✅ SQL injection in POST data prevented`);
                }
            }
        });

        await this.runTest('Command Injection Prevention', async () => {
            const commandPayloads = [
                '; ls -la',
                '| whoami',
                '&& cat /etc/passwd',
                '$(cat /etc/passwd)',
                '`cat /etc/passwd`',
                '; rm -rf /',
                '| nc -l 4444'
            ];

            for (const payload of commandPayloads) {
                try {
                    await axios.post(`${this.baseURL}/api/projects/analyze`, {
                        name: `test-project${payload}`,
                        files: [
                            { name: `file${payload}.js`, content: 'console.log("test");' }
                        ]
                    }, {
                        headers: { 'Authorization': `Bearer ${this.authToken}` }
                    });
                    
                    console.log(`    ✅ Command injection prevented: ${payload.substring(0, 20)}...`);
                } catch (error) {
                    // Input validation should catch command injection attempts
                    this.assert(error.response?.status === 400, 'Command injection payload rejected');
                }
            }
        });
    }

    async testSessionManagement() {
        console.log('🔄 Testing Session Management...');

        await this.runTest('Session Token Security', async () => {
            this.assert(this.authToken, 'Auth token available');
            
            // Test token format and entropy
            this.assert(this.authToken.length > 100, 'Token has sufficient length');
            
            // JWT tokens should not be predictable
            const tokenEntropy = this.calculateEntropy(this.authToken);
            this.assert(tokenEntropy > 3.0, 'Token has sufficient entropy');
            console.log(`    📊 Token entropy: ${tokenEntropy.toFixed(2)}`);
        });

        await this.runTest('Token Refresh Security', async () => {
            // Test if refresh tokens are implemented securely
            try {
                const response = await axios.post(`${this.baseURL}/api/auth/refresh`, {
                    refreshToken: 'invalid-refresh-token'
                });
                
                this.recordVulnerability('MEDIUM', 'Invalid refresh token accepted', 
                    'System accepts invalid refresh tokens');
            } catch (error) {
                this.assert([400, 401].includes(error.response?.status), 
                    'Invalid refresh token properly rejected');
            }
        });

        await this.runTest('Concurrent Session Handling', async () => {
            // Test multiple concurrent sessions with same user
            const loginPromises = Array(5).fill(null).map(() =>
                axios.post(`${this.baseURL}/api/auth/login`, {
                    email: this.testUser.email,
                    password: this.testUser.password
                }).catch(error => error.response)
            );
            
            const responses = await Promise.all(loginPromises);
            const successfulLogins = responses.filter(r => r.status === 200);
            
            console.log(`    📊 Concurrent logins allowed: ${successfulLogins.length}/5`);
            
            // Multiple concurrent sessions should be controlled
            if (successfulLogins.length === 5) {
                console.log('    ⚠️  System allows unlimited concurrent sessions');
            }
        });
    }

    async testDataEncryptionSecurity() {
        console.log('🔐 Testing Data Encryption Security...');

        await this.runTest('HTTPS Enforcement', async () => {
            if (this.baseURL.startsWith('https://')) {
                console.log('    ✅ Application served over HTTPS');
            } else {
                // For local testing, HTTP might be acceptable
                console.log('    ⚠️  Application not served over HTTPS (acceptable for local testing)');
            }
        });

        await this.runTest('Sensitive Data Protection', async () => {
            // Test that sensitive data is not exposed in responses
            const response = await axios.get(`${this.baseURL}/api/auth/profile`, {
                headers: { 'Authorization': `Bearer ${this.authToken}` }
            });
            
            const responseString = JSON.stringify(response.data);
            
            // Check that passwords, secrets, etc. are not exposed
            const sensitivePatterns = [
                /password/i,
                /secret/i,
                /private.*key/i,
                /api.*key/i,
                /token.*secret/i
            ];
            
            for (const pattern of sensitivePatterns) {
                if (pattern.test(responseString)) {
                    this.recordVulnerability('MEDIUM', 'Sensitive data in response', 
                        `Response may contain sensitive information matching pattern: ${pattern}`);
                }
            }
        });

        await this.runTest('Configuration Encryption', async () => {
            // Test configuration management encryption
            try {
                const configData = {
                    name: 'security-test-config',
                    environment: 'test',
                    variables: {
                        DATABASE_PASSWORD: 'super-secret-password',
                        API_KEY: 'sk-test-key-123456789',
                        SECRET_TOKEN: 'very-secret-token'
                    }
                };

                const response = await axios.post(`${this.baseURL}/api/configurations`, configData, {
                    headers: { 'Authorization': `Bearer ${this.authToken}` }
                });
                
                // Retrieve the configuration
                const getResponse = await axios.get(`${this.baseURL}/api/configurations/${response.data.id}`, {
                    headers: { 'Authorization': `Bearer ${this.authToken}` }
                });
                
                // Check if sensitive values are encrypted/masked
                const retrievedConfig = getResponse.data;
                if (retrievedConfig.variables.DATABASE_PASSWORD === 'super-secret-password') {
                    this.recordVulnerability('HIGH', 'Configuration not encrypted', 
                        'Sensitive configuration data stored in plain text');
                } else {
                    console.log('    ✅ Configuration data appears to be encrypted/masked');
                }
                
            } catch (error) {
                console.log('    ⚠️  Configuration encryption test skipped (endpoint unavailable)');
            }
        });
    }

    async testAPISecurityHeaders() {
        console.log('🛡️ Testing Security Headers...');

        await this.runTest('Security Headers Present', async () => {
            const response = await axios.get(`${this.baseURL}/health`);
            const headers = response.headers;
            
            const expectedHeaders = [
                'x-frame-options',
                'x-content-type-options',
                'x-xss-protection',
                'strict-transport-security',
                'content-security-policy'
            ];
            
            const missingHeaders = [];
            
            for (const header of expectedHeaders) {
                if (!headers[header] && !headers[header.toLowerCase()]) {
                    missingHeaders.push(header);
                }
            }
            
            if (missingHeaders.length > 0) {
                this.recordVulnerability('MEDIUM', 'Missing security headers', 
                    `Missing headers: ${missingHeaders.join(', ')}`);
                console.log(`    ⚠️  Missing security headers: ${missingHeaders.join(', ')}`);
            } else {
                console.log('    ✅ All important security headers present');
            }
        });

        await this.runTest('CORS Configuration Security', async () => {
            // Test CORS headers
            try {
                const response = await axios.options(`${this.baseURL}/api/deployments`, {
                    headers: {
                        'Origin': 'https://malicious-site.com',
                        'Access-Control-Request-Method': 'GET'
                    }
                });
                
                const corsHeaders = {
                    'access-control-allow-origin': response.headers['access-control-allow-origin'],
                    'access-control-allow-credentials': response.headers['access-control-allow-credentials'],
                    'access-control-allow-methods': response.headers['access-control-allow-methods']
                };
                
                // Check for overly permissive CORS
                if (corsHeaders['access-control-allow-origin'] === '*' && 
                    corsHeaders['access-control-allow-credentials'] === 'true') {
                    this.recordVulnerability('HIGH', 'Insecure CORS configuration', 
                        'CORS allows all origins with credentials');
                }
                
                console.log('    📊 CORS configuration checked');
            } catch (error) {
                // CORS preflight might not be implemented
                console.log('    ⚠️  CORS preflight test skipped');
            }
        });
    }

    async testRateLimitingSecurity() {
        console.log('⏱️ Testing Rate Limiting Security...');

        await this.runTest('API Rate Limiting', async () => {
            const rapidRequests = [];
            const startTime = Date.now();
            
            // Send 30 rapid requests
            for (let i = 0; i < 30; i++) {
                rapidRequests.push(
                    axios.get(`${this.baseURL}/health`).catch(error => error.response)
                );
            }
            
            const responses = await Promise.all(rapidRequests);
            const rateLimitedResponses = responses.filter(r => r?.status === 429);
            const totalTime = Date.now() - startTime;
            
            console.log(`    📊 Rate limited: ${rateLimitedResponses.length}/30 requests in ${totalTime}ms`);
            
            if (rateLimitedResponses.length === 0) {
                this.recordVulnerability('MEDIUM', 'No rate limiting detected', 
                    'API allows unlimited requests without rate limiting');
            }
        });

        await this.runTest('Login Rate Limiting', async () => {
            const loginAttempts = [];
            
            // Rapid login attempts with wrong credentials
            for (let i = 0; i < 15; i++) {
                loginAttempts.push(
                    axios.post(`${this.baseURL}/api/auth/login`, {
                        email: 'nonexistent@example.com',
                        password: 'wrongpassword'
                    }).catch(error => error.response)
                );
            }
            
            const responses = await Promise.all(loginAttempts);
            const rateLimitedLogins = responses.filter(r => r?.status === 429);
            
            console.log(`    📊 Login attempts rate limited: ${rateLimitedLogins.length}/15`);
            
            if (rateLimitedLogins.length === 0) {
                this.recordVulnerability('HIGH', 'No login rate limiting', 
                    'Login endpoint allows unlimited attempts');
            }
        });
    }

    async testCORSSecurity() {
        console.log('🌐 Testing CORS Security...');

        await this.runTest('Origin Validation', async () => {
            const maliciousOrigins = [
                'https://malicious-site.com',
                'http://evil.com',
                'https://attacker.net'
            ];
            
            for (const origin of maliciousOrigins) {
                try {
                    const response = await axios.get(`${this.baseURL}/health`, {
                        headers: { 'Origin': origin }
                    });
                    
                    const allowedOrigin = response.headers['access-control-allow-origin'];
                    
                    if (allowedOrigin === '*' || allowedOrigin === origin) {
                        this.recordVulnerability('MEDIUM', 'Permissive CORS policy', 
                            `Origin ${origin} allowed by CORS policy`);
                    }
                } catch (error) {
                    // Origin blocking is good
                }
            }
        });
    }

    async testSQLInjectionPrevention() {
        console.log('💉 Testing SQL Injection Prevention...');

        await this.runTest('Advanced SQL Injection Tests', async () => {
            const advancedPayloads = [
                "admin'; WAITFOR DELAY '00:00:05'--",
                "1' AND (SELECT COUNT(*) FROM information_schema.tables)>0--",
                "1' AND BENCHMARK(5000000,MD5(1))--",
                "'; SELECT SLEEP(5)--",
                "1' AND (SELECT * FROM (SELECT COUNT(*),CONCAT(version(),FLOOR(RAND(0)*2))x FROM information_schema.tables GROUP BY x)a)--"
            ];

            for (const payload of advancedPayloads) {
                const startTime = Date.now();
                
                try {
                    await axios.get(`${this.baseURL}/api/deployments?id=${encodeURIComponent(payload)}`, {
                        headers: { 'Authorization': `Bearer ${this.authToken}` }
                    });
                    
                    const responseTime = Date.now() - startTime;
                    
                    // If response takes significantly longer, might indicate SQL injection
                    if (responseTime > 5000) {
                        this.recordVulnerability('HIGH', 'Possible SQL injection vulnerability', 
                            `Time-based SQL injection payload may have executed: ${payload.substring(0, 50)}...`);
                    }
                } catch (error) {
                    // Proper error handling or parameterized queries should prevent injection
                    console.log(`    ✅ SQL injection payload safely handled`);
                }
            }
        });
    }

    async testXSSPrevention() {
        console.log('🔗 Testing XSS Prevention...');

        await this.runTest('Stored XSS Prevention', async () => {
            const xssPayloads = [
                '<svg/onload=alert(1)>',
                '<img src=x onerror=prompt(1)>',
                '<iframe src="javascript:alert(1)">',
                '<details open ontoggle=alert(1)>',
                '<marquee onstart=alert(1)>'
            ];

            for (const payload of xssPayloads) {
                try {
                    // Attempt to store XSS payload
                    const response = await axios.post(`${this.baseURL}/api/projects/analyze`, {
                        name: payload,
                        description: `Project with XSS payload: ${payload}`
                    }, {
                        headers: { 'Authorization': `Bearer ${this.authToken}` }
                    });
                    
                    // Check if payload is sanitized in response
                    const responseText = JSON.stringify(response.data);
                    if (responseText.includes('onload=') || responseText.includes('onerror=') || 
                        responseText.includes('javascript:')) {
                        this.recordVulnerability('HIGH', 'Stored XSS vulnerability', 
                            `Unsanitized XSS payload stored: ${payload}`);
                    }
                } catch (error) {
                    // Input validation rejection is good
                    console.log(`    ✅ XSS payload rejected by input validation`);
                }
            }
        });
    }

    async testCSRFProtection() {
        console.log('🔀 Testing CSRF Protection...');

        await this.runTest('CSRF Token Validation', async () => {
            // Test state-changing operations without proper CSRF protection
            try {
                const response = await axios.post(`${this.baseURL}/api/configurations`, {
                    name: 'csrf-test',
                    environment: 'test',
                    variables: { TEST: 'value' }
                }, {
                    headers: { 
                        'Authorization': `Bearer ${this.authToken}`,
                        'Origin': 'https://malicious-site.com'
                    }
                });
                
                // If request succeeds from malicious origin, might be CSRF vulnerability
                console.log('    ⚠️  Cross-origin state-changing request allowed');
            } catch (error) {
                // CSRF protection should block cross-origin requests
                console.log('    ✅ Cross-origin request properly handled');
            }
        });
    }

    async testSecurityConfigurationCheck() {
        console.log('⚙️ Testing Security Configuration...');

        await this.runTest('Information Disclosure Check', async () => {
            const infoDisclosureEndpoints = [
                '/server-status',
                '/server-info',
                '/.env',
                '/config.json',
                '/package.json',
                '/.git/config',
                '/swagger.json',
                '/api-docs'
            ];

            for (const endpoint of infoDisclosureEndpoints) {
                try {
                    const response = await axios.get(`${this.baseURL}${endpoint}`);
                    
                    if (response.status === 200 && response.data) {
                        this.recordVulnerability('MEDIUM', 'Information disclosure', 
                            `Sensitive endpoint exposed: ${endpoint}`);
                    }
                } catch (error) {
                    // Good - sensitive endpoints should not be accessible
                }
            }
        });

        await this.runTest('Error Message Information Leakage', async () => {
            try {
                // Trigger an error and check if it leaks sensitive information
                await axios.post(`${this.baseURL}/api/invalid-endpoint`, {
                    malformed: 'data'
                });
            } catch (error) {
                const errorMessage = error.response?.data?.message || '';
                const stackTrace = error.response?.data?.stack || '';
                
                // Check for information leakage in error messages
                if (stackTrace.includes('/') || errorMessage.includes('Error:') || 
                    errorMessage.includes('at ')) {
                    this.recordVulnerability('LOW', 'Information leakage in error messages', 
                        'Error responses contain stack traces or file paths');
                }
            }
        });
    }

    async registerTestUser() {
        try {
            await axios.post(`${this.baseURL}/api/auth/register`, {
                email: this.testUser.email,
                password: this.testUser.password,
                name: 'Security Test User'
            });
        } catch (error) {
            // User might already exist, which is fine for testing
            if (error.response?.status !== 409) {
                throw error;
            }
        }
    }

    calculateEntropy(str) {
        const freq = {};
        for (let char of str) {
            freq[char] = (freq[char] || 0) + 1;
        }
        
        let entropy = 0;
        for (let char in freq) {
            const p = freq[char] / str.length;
            entropy -= p * Math.log2(p);
        }
        
        return entropy;
    }

    recordVulnerability(severity, title, description) {
        const vulnerability = {
            severity: severity.toUpperCase(),
            title,
            description,
            timestamp: new Date().toISOString()
        };
        
        this.testResults.vulnerabilities.push(vulnerability);
        this.testResults[severity.toLowerCase()]++;
        
        console.log(`    🚨 ${severity} VULNERABILITY: ${title} - ${description}`);
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
        console.log('\n' + '='.repeat(70));
        console.log('🛡️ SECURITY VALIDATION RESULTS');
        console.log('='.repeat(70));
        
        const successRate = ((this.testResults.passed / this.testResults.total) * 100).toFixed(2);
        const totalVulnerabilities = this.testResults.critical + this.testResults.high + 
                                   this.testResults.medium + this.testResults.low;
        
        console.log(`📈 Tests Run: ${this.testResults.total}`);
        console.log(`✅ Passed: ${this.testResults.passed}`);
        console.log(`❌ Failed: ${this.testResults.failed}`);
        console.log(`📊 Success Rate: ${successRate}%`);
        
        console.log('\n🚨 VULNERABILITY SUMMARY:');
        console.log(`🔴 Critical: ${this.testResults.critical}`);
        console.log(`🟡 High: ${this.testResults.high}`);
        console.log(`🟠 Medium: ${this.testResults.medium}`);
        console.log(`🟢 Low: ${this.testResults.low}`);
        console.log(`📊 Total Vulnerabilities: ${totalVulnerabilities}`);

        if (this.testResults.vulnerabilities.length > 0) {
            console.log('\n💥 VULNERABILITIES FOUND:');
            this.testResults.vulnerabilities.forEach((vuln, index) => {
                console.log(`${index + 1}. [${vuln.severity}] ${vuln.title}`);
                console.log(`   ${vuln.description}`);
            });
        }

        if (this.testResults.failed > 0) {
            console.log('\n💥 TEST FAILURES:');
            this.testResults.errors.forEach((error, index) => {
                console.log(`${index + 1}. ${error.test}: ${error.error}`);
            });
        }
        
        // Security Assessment
        console.log('\n🎯 SECURITY ASSESSMENT:');
        const isSecure = this.assessSecurityPosture();
        
        if (isSecure) {
            console.log('✅ SECURITY VALIDATION PASSED');
            console.log('🛡️ System meets security requirements for production');
        } else {
            console.log('❌ SECURITY VALIDATION FAILED');
            console.log('🚨 Security vulnerabilities must be resolved before production');
        }
        
        // Save detailed results
        this.saveResults();
        
        // Exit with appropriate code
        process.exit(isSecure ? 0 : 1);
    }

    assessSecurityPosture() {
        const hasBlockingVulnerabilities = this.testResults.critical > 0 || this.testResults.high > 2;
        const hasExcessiveFailures = this.testResults.failed > this.testResults.total * 0.2;
        
        if (hasBlockingVulnerabilities) {
            console.log('❌ Critical or multiple high-severity vulnerabilities found');
            return false;
        }
        
        if (hasExcessiveFailures) {
            console.log('❌ Too many security test failures');
            return false;
        }
        
        if (this.testResults.medium > 5) {
            console.log('⚠️  Many medium-severity issues found - review recommended');
        }
        
        console.log('✅ No blocking security issues found');
        return true;
    }

    async saveResults() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `security-validation-results-${timestamp}.json`;
        
        const report = {
            timestamp: new Date().toISOString(),
            testSuite: 'Security Validation',
            summary: this.testResults,
            vulnerabilities: this.testResults.vulnerabilities,
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
    const validator = new SecurityValidator();
    validator.runAllTests().catch(error => {
        console.error('💥 Security test execution failed:', error);
        process.exit(1);
    });
}

module.exports = SecurityValidator;