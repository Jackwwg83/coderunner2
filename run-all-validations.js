#!/usr/bin/env node

/**
 * CodeRunner v2.0 - Master Test Runner
 * 
 * Orchestrates all test suites, aggregates results, and generates summary report
 * Provides comprehensive validation for production readiness
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class MasterTestRunner {
    constructor() {
        this.baseURL = process.env.TEST_BASE_URL || 'http://localhost:8088';
        this.testSuites = [
            {
                name: 'Functional Validation',
                script: './test-functional-validation.js',
                description: 'API endpoints, CRUD operations, and business logic',
                priority: 1,
                timeout: 300000, // 5 minutes
                required: true
            },
            {
                name: 'Integration Validation',
                script: './test-integration-validation.js',
                description: 'Service interactions and component integration',
                priority: 2,
                timeout: 600000, // 10 minutes
                required: true
            },
            {
                name: 'Security Validation',
                script: './test-security-validation.js',
                description: 'Authentication, authorization, and vulnerability tests',
                priority: 3,
                timeout: 300000, // 5 minutes
                required: true
            },
            {
                name: 'Performance Validation',
                script: './test-performance-validation.js',
                description: 'Load testing, WebSocket stress, and resource monitoring',
                priority: 4,
                timeout: 900000, // 15 minutes
                required: false // Performance tests are optional but recommended
            },
            {
                name: 'End-to-End Validation',
                script: './test-e2e-validation.js',
                description: 'Complete user journeys and real-world scenarios',
                priority: 5,
                timeout: 900000, // 15 minutes
                required: true
            }
        ];
        
        this.results = {
            startTime: Date.now(),
            endTime: null,
            totalDuration: 0,
            totalTests: 0,
            totalPassed: 0,
            totalFailed: 0,
            suiteResults: [],
            overallSuccess: false,
            productionReady: false
        };
        
        this.config = {
            parallel: process.env.PARALLEL_TESTS === 'true',
            maxParallel: 2, // Limit parallel execution to avoid resource conflicts
            continueOnFailure: process.env.CONTINUE_ON_FAILURE === 'true',
            generateReport: true,
            saveIndividualResults: true
        };
    }

    async runAllTests() {
        console.log('🚀 Starting CodeRunner v2.0 Master Test Validation');
        console.log(`📍 Target: ${this.baseURL}`);
        console.log(`⚙️  Configuration: ${this.config.parallel ? 'Parallel' : 'Sequential'} execution`);
        console.log('=' .repeat(80));
        
        try {
            // Pre-flight checks
            await this.performPreflightChecks();
            
            // Run test suites
            if (this.config.parallel) {
                await this.runTestsInParallel();
            } else {
                await this.runTestsSequentially();
            }
            
            // Generate comprehensive report
            await this.generateMasterReport();
            
        } catch (error) {
            console.error('💥 Master test execution failed:', error.message);
            this.results.criticalError = error.message;
            process.exit(1);
        }
    }

    async performPreflightChecks() {
        console.log('🔍 Performing pre-flight checks...');
        
        try {
            // Check if server is running
            const response = await this.makeRequest('GET', '/health');
            if (response.status !== 200) {
                throw new Error(`Server not responding correctly: ${response.status}`);
            }
            console.log('  ✅ Server is running and accessible');
            
            // Check test script files exist
            for (const suite of this.testSuites) {
                const scriptPath = path.resolve(suite.script);
                try {
                    await fs.access(scriptPath);
                    console.log(`  ✅ Test script found: ${suite.name}`);
                } catch (error) {
                    throw new Error(`Test script not found: ${suite.script}`);
                }
            }
            
            // Check Node.js dependencies
            const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
            const requiredDeps = ['axios', 'ws', 'jest'];
            const missingDeps = requiredDeps.filter(dep => 
                !packageJson.dependencies[dep] && !packageJson.devDependencies[dep]
            );
            
            if (missingDeps.length > 0) {
                console.log(`  ⚠️  Missing dependencies: ${missingDeps.join(', ')}`);
                console.log('     Tests may still run if dependencies are globally installed');
            } else {
                console.log('  ✅ Required dependencies available');
            }
            
        } catch (error) {
            throw new Error(`Pre-flight check failed: ${error.message}`);
        }
        
        console.log('✅ Pre-flight checks completed successfully\n');
    }

    async runTestsSequentially() {
        console.log('📋 Running tests sequentially...\n');
        
        const sortedSuites = this.testSuites.sort((a, b) => a.priority - b.priority);
        
        for (const suite of sortedSuites) {
            const result = await this.runTestSuite(suite);
            this.results.suiteResults.push(result);
            
            // Check if we should continue after failure
            if (!result.success && suite.required && !this.config.continueOnFailure) {
                console.log(`💥 Required test suite failed: ${suite.name}`);
                console.log('🛑 Stopping execution due to critical failure\n');
                break;
            }
        }
    }

    async runTestsInParallel() {
        console.log(`📋 Running tests in parallel (max ${this.config.maxParallel} concurrent)...\n`);
        
        const sortedSuites = this.testSuites.sort((a, b) => a.priority - b.priority);
        const batches = this.chunkArray(sortedSuites, this.config.maxParallel);
        
        for (const batch of batches) {
            const batchPromises = batch.map(suite => this.runTestSuite(suite));
            const batchResults = await Promise.all(batchPromises);
            
            this.results.suiteResults.push(...batchResults);
            
            // Check for critical failures in required test suites
            const criticalFailures = batchResults.filter(r => !r.success && r.suite.required);
            if (criticalFailures.length > 0 && !this.config.continueOnFailure) {
                console.log(`💥 Critical test suite failures detected`);
                console.log('🛑 Stopping execution due to critical failures\n');
                break;
            }
        }
    }

    async runTestSuite(suite) {
        console.log(`🧪 Running ${suite.name}...`);
        console.log(`📝 ${suite.description}`);
        
        const result = {
            suite,
            startTime: Date.now(),
            endTime: null,
            duration: 0,
            success: false,
            exitCode: null,
            stdout: '',
            stderr: '',
            tests: 0,
            passed: 0,
            failed: 0,
            error: null
        };
        
        try {
            const childProcess = spawn('node', [suite.script], {
                env: { ...process.env, TEST_BASE_URL: this.baseURL },
                stdio: ['pipe', 'pipe', 'pipe']
            });
            
            let stdout = '';
            let stderr = '';
            
            childProcess.stdout.on('data', (data) => {
                const chunk = data.toString();
                stdout += chunk;
                
                // Parse test progress in real-time
                this.parseTestProgress(chunk, result);
                
                // Show real-time output for better user experience
                process.stdout.write(chunk);
            });
            
            childProcess.stderr.on('data', (data) => {
                const chunk = data.toString();
                stderr += chunk;
                process.stderr.write(chunk);
            });
            
            const exitCode = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    childProcess.kill('SIGKILL');
                    reject(new Error(`Test suite timed out after ${suite.timeout}ms`));
                }, suite.timeout);
                
                childProcess.on('close', (code) => {
                    clearTimeout(timeout);
                    resolve(code);
                });
                
                childProcess.on('error', (error) => {
                    clearTimeout(timeout);
                    reject(error);
                });
            });
            
            result.exitCode = exitCode;
            result.stdout = stdout;
            result.stderr = stderr;
            result.success = exitCode === 0;
            
            if (result.success) {
                console.log(`✅ ${suite.name} completed successfully`);
            } else {
                console.log(`❌ ${suite.name} failed with exit code ${exitCode}`);
            }
            
        } catch (error) {
            result.error = error.message;
            result.success = false;
            console.log(`💥 ${suite.name} encountered error: ${error.message}`);
        }
        
        result.endTime = Date.now();
        result.duration = result.endTime - result.startTime;
        
        console.log(`⏱️  Duration: ${(result.duration / 1000).toFixed(2)}s`);
        console.log(`📊 Results: ${result.passed} passed, ${result.failed} failed\n`);
        
        return result;
    }

    parseTestProgress(output, result) {
        // Parse test results from output
        const testRunPattern = /Tests Run: (\d+)/;
        const passedPattern = /Passed: (\d+)/;
        const failedPattern = /Failed: (\d+)/;
        
        const testRunMatch = output.match(testRunPattern);
        if (testRunMatch) {
            result.tests = parseInt(testRunMatch[1]);
        }
        
        const passedMatch = output.match(passedPattern);
        if (passedMatch) {
            result.passed = parseInt(passedMatch[1]);
        }
        
        const failedMatch = output.match(failedPattern);
        if (failedMatch) {
            result.failed = parseInt(failedMatch[1]);
        }
    }

    async generateMasterReport() {
        this.results.endTime = Date.now();
        this.results.totalDuration = this.results.endTime - this.results.startTime;
        
        // Calculate totals
        for (const result of this.results.suiteResults) {
            this.results.totalTests += result.tests || 0;
            this.results.totalPassed += result.passed || 0;
            this.results.totalFailed += result.failed || 0;
        }
        
        // Determine overall success
        const requiredSuites = this.results.suiteResults.filter(r => r.suite.required);
        const requiredSuitesSuccess = requiredSuites.every(r => r.success);
        const optionalSuites = this.results.suiteResults.filter(r => !r.suite.required);
        const optionalSuitesSuccess = optionalSuites.length === 0 || optionalSuites.some(r => r.success);
        
        this.results.overallSuccess = requiredSuitesSuccess;
        this.results.productionReady = requiredSuitesSuccess && 
            (this.results.totalFailed === 0 || this.results.totalFailed < this.results.totalTests * 0.05);
        
        // Display master report
        this.displayMasterReport();
        
        // Save detailed report
        if (this.config.generateReport) {
            await this.saveMasterReport();
        }
        
        // Exit with appropriate code
        process.exit(this.results.overallSuccess ? 0 : 1);
    }

    displayMasterReport() {
        console.log('=' .repeat(80));
        console.log('🏆 CODERUNNER V2.0 MASTER TEST VALIDATION REPORT');
        console.log('=' .repeat(80));
        
        const duration = (this.results.totalDuration / 1000).toFixed(2);
        const successRate = this.results.totalTests > 0 ? 
            ((this.results.totalPassed / this.results.totalTests) * 100).toFixed(2) : '0.00';
        
        console.log(`📊 EXECUTION SUMMARY:`);
        console.log(`   ⏱️  Total Duration: ${duration} seconds`);
        console.log(`   🧪 Total Tests: ${this.results.totalTests}`);
        console.log(`   ✅ Passed: ${this.results.totalPassed}`);
        console.log(`   ❌ Failed: ${this.results.totalFailed}`);
        console.log(`   📈 Success Rate: ${successRate}%`);
        
        console.log(`\n📋 TEST SUITE RESULTS:`);
        for (const result of this.results.suiteResults) {
            const status = result.success ? '✅' : '❌';
            const duration = (result.duration / 1000).toFixed(2);
            const required = result.suite.required ? '[REQUIRED]' : '[OPTIONAL]';
            const testInfo = result.tests > 0 ? ` (${result.passed}/${result.tests})` : '';
            
            console.log(`   ${status} ${result.suite.name} ${required} - ${duration}s${testInfo}`);
            
            if (!result.success) {
                if (result.error) {
                    console.log(`      Error: ${result.error}`);
                } else if (result.exitCode !== 0) {
                    console.log(`      Exit code: ${result.exitCode}`);
                }
            }
        }
        
        console.log(`\n🎯 OVERALL ASSESSMENT:`);
        
        if (this.results.overallSuccess) {
            console.log(`✅ VALIDATION PASSED - All required test suites successful`);
            
            if (this.results.productionReady) {
                console.log(`🚀 PRODUCTION READY - System meets all quality standards`);
                console.log(`🌟 CodeRunner v2.0 is ready for production deployment!`);
            } else {
                console.log(`⚠️  PRODUCTION REVIEW NEEDED - Some issues detected`);
                console.log(`📝 Review failed tests before production deployment`);
            }
        } else {
            console.log(`❌ VALIDATION FAILED - Required test suites have failures`);
            console.log(`🛑 NOT READY FOR PRODUCTION - Critical issues must be resolved`);
            
            const failedRequired = this.results.suiteResults.filter(r => !r.success && r.suite.required);
            console.log(`\n💥 CRITICAL FAILURES:`);
            for (const failure of failedRequired) {
                console.log(`   • ${failure.suite.name}: ${failure.error || 'Test failures detected'}`);
            }
        }
        
        console.log(`\n📊 QUALITY METRICS:`);
        console.log(`   🔒 Security: ${this.getQualityStatus('Security Validation')}`);
        console.log(`   ⚡ Performance: ${this.getQualityStatus('Performance Validation')}`);
        console.log(`   🔗 Integration: ${this.getQualityStatus('Integration Validation')}`);
        console.log(`   🎭 User Experience: ${this.getQualityStatus('End-to-End Validation')}`);
        console.log(`   🛠️  Functionality: ${this.getQualityStatus('Functional Validation')}`);
        
        console.log(`\n📈 RECOMMENDATIONS:`);
        this.generateRecommendations();
        
        console.log('\n' + '=' .repeat(80));
        console.log(`Report generated: ${new Date().toISOString()}`);
        console.log('=' .repeat(80));
    }

    getQualityStatus(suiteName) {
        const result = this.results.suiteResults.find(r => r.suite.name === suiteName);
        if (!result) return 'NOT TESTED';
        return result.success ? 'PASS' : 'FAIL';
    }

    generateRecommendations() {
        const recommendations = [];
        
        // Check each test suite for specific recommendations
        for (const result of this.results.suiteResults) {
            if (!result.success) {
                switch (result.suite.name) {
                    case 'Security Validation':
                        recommendations.push('🔒 Review and fix security vulnerabilities before production');
                        break;
                    case 'Performance Validation':
                        recommendations.push('⚡ Optimize performance bottlenecks to meet production targets');
                        break;
                    case 'Integration Validation':
                        recommendations.push('🔗 Fix service integration issues to ensure system reliability');
                        break;
                    case 'End-to-End Validation':
                        recommendations.push('🎭 Resolve user journey issues to ensure good user experience');
                        break;
                    case 'Functional Validation':
                        recommendations.push('🛠️  Fix API and functionality issues for core features');
                        break;
                }
            }
        }
        
        // General recommendations based on overall results
        if (this.results.totalFailed > 0) {
            const failureRate = (this.results.totalFailed / this.results.totalTests) * 100;
            if (failureRate > 10) {
                recommendations.push('📊 High failure rate detected - comprehensive review recommended');
            } else if (failureRate > 5) {
                recommendations.push('📊 Moderate failure rate - targeted fixes needed');
            }
        }
        
        if (this.results.overallSuccess && this.results.productionReady) {
            recommendations.push('🌟 System passed all validations - proceed with production deployment');
            recommendations.push('📊 Consider setting up continuous monitoring post-deployment');
        }
        
        if (recommendations.length === 0) {
            recommendations.push('✨ No critical issues detected - system quality is excellent');
        }
        
        recommendations.forEach((rec, index) => {
            console.log(`   ${index + 1}. ${rec}`);
        });
    }

    async saveMasterReport() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `master-validation-report-${timestamp}.json`;
            
            const report = {
                timestamp: new Date().toISOString(),
                testRunner: 'CodeRunner v2.0 Master Test Runner',
                summary: this.results,
                environment: {
                    baseURL: this.baseURL,
                    nodeVersion: process.version,
                    platform: process.platform,
                    config: this.config
                },
                testSuites: this.testSuites,
                detailedResults: this.results.suiteResults
            };
            
            await fs.writeFile(filename, JSON.stringify(report, null, 2));
            console.log(`💾 Master report saved to: ${filename}`);
            
            // Also save a human-readable summary
            const summaryFilename = `validation-summary-${timestamp}.txt`;
            const summary = this.generateTextSummary();
            await fs.writeFile(summaryFilename, summary);
            console.log(`📄 Summary report saved to: ${summaryFilename}`);
            
        } catch (error) {
            console.error('❌ Failed to save master report:', error.message);
        }
    }

    generateTextSummary() {
        const duration = (this.results.totalDuration / 1000).toFixed(2);
        const successRate = this.results.totalTests > 0 ? 
            ((this.results.totalPassed / this.results.totalTests) * 100).toFixed(2) : '0.00';
        
        return `
CODERUNNER V2.0 MASTER TEST VALIDATION SUMMARY
==============================================

Execution Date: ${new Date().toISOString()}
Target System: ${this.baseURL}
Total Duration: ${duration} seconds

OVERALL RESULTS:
- Total Tests: ${this.results.totalTests}
- Passed: ${this.results.totalPassed}
- Failed: ${this.results.totalFailed}
- Success Rate: ${successRate}%

VALIDATION STATUS:
${this.results.overallSuccess ? '✅ VALIDATION PASSED' : '❌ VALIDATION FAILED'}
${this.results.productionReady ? '🚀 PRODUCTION READY' : '🛑 NOT READY FOR PRODUCTION'}

TEST SUITE BREAKDOWN:
${this.results.suiteResults.map(r => {
    const status = r.success ? '✅' : '❌';
    const duration = (r.duration / 1000).toFixed(2);
    const required = r.suite.required ? '[REQUIRED]' : '[OPTIONAL]';
    return `${status} ${r.suite.name} ${required} - ${duration}s`;
}).join('\n')}

QUALITY ASSESSMENT:
- Security: ${this.getQualityStatus('Security Validation')}
- Performance: ${this.getQualityStatus('Performance Validation')}  
- Integration: ${this.getQualityStatus('Integration Validation')}
- User Experience: ${this.getQualityStatus('End-to-End Validation')}
- Functionality: ${this.getQualityStatus('Functional Validation')}

${this.results.productionReady ? 
  'RECOMMENDATION: System is ready for production deployment!' :
  'RECOMMENDATION: Resolve critical issues before production deployment.'
}
        `.trim();
    }

    async makeRequest(method, endpoint) {
        const axios = require('axios');
        try {
            return await axios({
                method,
                url: `${this.baseURL}${endpoint}`,
                timeout: 5000
            });
        } catch (error) {
            return error.response || { status: 500, data: null };
        }
    }

    chunkArray(array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }
}

// Run master test runner if called directly
if (require.main === module) {
    const runner = new MasterTestRunner();
    runner.runAllTests().catch(error => {
        console.error('💥 Master test runner failed:', error);
        process.exit(1);
    });
}

module.exports = MasterTestRunner;