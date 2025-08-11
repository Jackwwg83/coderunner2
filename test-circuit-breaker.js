#!/usr/bin/env node

/**
 * Test to demonstrate enhanced circuit breaker functionality
 */

class MockCircuitBreaker {
  constructor(config = {}) {
    this.config = {
      failureThreshold: config.failureThreshold || 3,
      cooldownPeriod: config.cooldownPeriod || 30000, // 30 seconds
      halfOpenRetries: config.halfOpenRetries || 3,
      ...config
    };
    
    this.breakers = new Map();
  }

  initBreaker(name) {
    this.breakers.set(name, {
      failures: 0,
      lastFailure: 0,
      state: 'closed',
      halfOpenAttempts: 0,
      stateTransitions: 0
    });
  }

  async executeCheck(name, checkFunc) {
    if (!this.breakers.has(name)) {
      this.initBreaker(name);
    }

    const breaker = this.breakers.get(name);
    const startTime = Date.now();

    // Enhanced circuit breaker state management
    if (breaker.state === 'open') {
      const timeSinceLastFailure = Date.now() - breaker.lastFailure;
      if (timeSinceLastFailure < this.config.cooldownPeriod) {
        return {
          name,
          status: 'unknown',
          responseTime: 0,
          timestamp: new Date(),
          message: `Circuit breaker is open (${Math.ceil((this.config.cooldownPeriod - timeSinceLastFailure) / 1000)}s remaining)`,
          error: 'Circuit breaker preventing calls due to repeated failures',
          details: {
            circuitBreakerState: 'open',
            failures: breaker.failures,
            cooldownRemaining: this.config.cooldownPeriod - timeSinceLastFailure,
            stateTransitions: breaker.stateTransitions
          }
        };
      } else {
        breaker.state = 'half-open';
        breaker.halfOpenAttempts = 0;
        breaker.stateTransitions++;
        console.log(`🔄 Circuit breaker for ${name} transitioning to half-open`);
      }
    }

    try {
      const result = await checkFunc();

      // Enhanced circuit breaker logic
      if (result.status === 'healthy' || result.status === 'mocked') {
        if (breaker.state === 'half-open') {
          breaker.halfOpenAttempts++;
          if (breaker.halfOpenAttempts >= this.config.halfOpenRetries) {
            breaker.state = 'closed';
            breaker.failures = 0;
            breaker.halfOpenAttempts = 0;
            breaker.stateTransitions++;
            console.log(`✅ Circuit breaker for ${name} closed after successful recovery`);
          }
        } else {
          breaker.failures = 0;
          breaker.state = 'closed';
        }
      } else if (result.status === 'unhealthy') {
        breaker.failures++;
        breaker.lastFailure = Date.now();
        
        if (breaker.state === 'half-open') {
          breaker.state = 'open';
          breaker.stateTransitions++;
          console.log(`🚨 Circuit breaker for ${name} re-opened due to failure in half-open state`);
        } else if (breaker.failures >= this.config.failureThreshold) {
          breaker.state = 'open';
          breaker.stateTransitions++;
          console.log(`🚨 Circuit breaker for ${name} opened due to ${breaker.failures} failures`);
        }
      }

      return {
        ...result,
        details: {
          ...result.details,
          circuitBreaker: {
            state: breaker.state,
            failures: breaker.failures,
            stateTransitions: breaker.stateTransitions
          }
        }
      };
    } catch (error) {
      // Enhanced error handling for circuit breaker
      breaker.failures++;
      breaker.lastFailure = Date.now();
      
      if (breaker.state === 'half-open') {
        breaker.state = 'open';
        breaker.stateTransitions++;
        console.log(`🚨 Circuit breaker for ${name} re-opened due to error in half-open state`);
      } else if (breaker.failures >= this.config.failureThreshold) {
        breaker.state = 'open';
        breaker.stateTransitions++;
        console.log(`🚨 Circuit breaker for ${name} opened due to ${breaker.failures} failures`);
      }

      return {
        name,
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
        message: 'Check failed with error',
        error: error.message,
        details: {
          circuitBreaker: {
            state: breaker.state,
            failures: breaker.failures,
            stateTransitions: breaker.stateTransitions
          }
        }
      };
    }
  }

  getState(name) {
    return this.breakers.get(name);
  }
}

async function testCircuitBreaker() {
  console.log('🔧 Testing Enhanced Circuit Breaker Logic...\n');
  
  const circuitBreaker = new MockCircuitBreaker({
    failureThreshold: 3,
    cooldownPeriod: 5000, // 5 seconds for testing
    halfOpenRetries: 2
  });

  // Mock service that fails then recovers
  let callCount = 0;
  const mockFailingService = async () => {
    callCount++;
    console.log(`📞 Service call #${callCount}`);
    
    if (callCount <= 3) {
      throw new Error('Service temporarily unavailable');
    } else if (callCount <= 5) {
      return {
        name: 'test-service',
        status: 'healthy',
        responseTime: 100,
        timestamp: new Date(),
        message: 'Service recovered'
      };
    } else {
      return {
        name: 'test-service',
        status: 'healthy',
        responseTime: 50,
        timestamp: new Date(),
        message: 'Service fully operational'
      };
    }
  };

  console.log('Phase 1: Normal operation until failure threshold');
  console.log('================================================');
  
  // Test normal failures leading to circuit breaker opening
  for (let i = 0; i < 4; i++) {
    const result = await circuitBreaker.executeCheck('test-service', mockFailingService);
    console.log(`Result: ${result.status} - ${result.message || result.error}`);
    
    const state = circuitBreaker.getState('test-service');
    console.log(`Circuit Breaker: ${state.state} (failures: ${state.failures})\n`);
  }

  console.log('Phase 2: Circuit breaker open - calls blocked');
  console.log('=============================================');
  
  // Test circuit breaker in open state
  for (let i = 0; i < 2; i++) {
    const result = await circuitBreaker.executeCheck('test-service', mockFailingService);
    console.log(`Result: ${result.status} - ${result.message}`);
    
    const state = circuitBreaker.getState('test-service');
    console.log(`Circuit Breaker: ${state.state}\n`);
  }

  console.log('Phase 3: Wait for cooldown and test half-open');
  console.log('==============================================');
  
  // Simulate cooldown period
  console.log('⏱️  Simulating 5-second cooldown...');
  await new Promise(resolve => setTimeout(resolve, 5100));

  // Test half-open state and recovery
  for (let i = 0; i < 4; i++) {
    const result = await circuitBreaker.executeCheck('test-service', mockFailingService);
    console.log(`Result: ${result.status} - ${result.message}`);
    
    const state = circuitBreaker.getState('test-service');
    console.log(`Circuit Breaker: ${state.state} (half-open attempts: ${state.halfOpenAttempts})\n`);
  }

  console.log('Phase 4: Normal operation after recovery');
  console.log('========================================');
  
  // Test normal operation after recovery
  for (let i = 0; i < 2; i++) {
    const result = await circuitBreaker.executeCheck('test-service', mockFailingService);
    console.log(`Result: ${result.status} - ${result.message}`);
    
    const state = circuitBreaker.getState('test-service');
    console.log(`Circuit Breaker: ${state.state}\n`);
  }

  const finalState = circuitBreaker.getState('test-service');
  console.log('🎯 Circuit Breaker Test Summary:');
  console.log('================================');
  console.log(`Final state: ${finalState.state}`);
  console.log(`Total failures: ${finalState.failures}`);
  console.log(`State transitions: ${finalState.stateTransitions}`);
  console.log(`Total service calls: ${callCount}`);
  console.log('');
  console.log('Key Features Demonstrated:');
  console.log('- ✅ Configurable failure threshold');
  console.log('- ✅ Cooldown period management');
  console.log('- ✅ Half-open state with retry logic');
  console.log('- ✅ State transition tracking');
  console.log('- ✅ Detailed error messaging');
  console.log('- ✅ Time-based recovery');
}

// Run the circuit breaker test
testCircuitBreaker().catch(error => {
  console.error('❌ Circuit breaker test failed:', error.message);
  process.exit(1);
});