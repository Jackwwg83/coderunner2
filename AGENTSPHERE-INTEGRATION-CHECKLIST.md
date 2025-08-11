# AgentSphere Integration Validation Checklist

## Overview

This checklist provides comprehensive validation steps for AgentSphere SDK integration in the CodeRunner2 platform. It covers automated testing, manual verification, and production readiness checks.

## Test Environment Setup

### Prerequisites

- [ ] **API Key Configuration**
  - [ ] Set `AGENTSPHERE_API_KEY` environment variable for live testing
  - [ ] Verify API key has necessary permissions for sandbox management
  - [ ] Test fallback to mock implementation when API key is missing

- [ ] **Database Configuration**
  - [ ] Verify database connection for deployment tracking
  - [ ] Ensure deployment and configuration tables exist
  - [ ] Test database rollback capabilities

- [ ] **Build Environment**
  - [ ] Compile TypeScript code: `npm run build`
  - [ ] Verify all dependencies are installed: `npm install`
  - [ ] Check for TypeScript compilation errors

### Configuration Validation

- [ ] **Environment Variables**
  ```bash
  # Required for live testing
  export AGENTSPHERE_API_KEY=your-api-key-here
  
  # Optional configurations
  export NODE_ENV=development
  export DATABASE_URL=postgresql://...
  ```

- [ ] **Configuration Files**
  - [ ] Verify `.env.example` contains AgentSphere configurations
  - [ ] Check orchestration configuration in `src/config/orchestration.ts`
  - [ ] Validate timeout and limit configurations

## Automated Testing

### Unit Tests

Run the comprehensive integration test suite:

```bash
# Run integration tests
npm test -- tests/integration/agentsphere-integration.test.ts

# Run with coverage
npm test -- --coverage tests/integration/agentsphere-integration.test.ts
```

**Expected Results:**
- [ ] ✅ All sandbox lifecycle tests pass
- [ ] ✅ Project deployment tests pass (Node.js and Manifest)
- [ ] ✅ Monitoring and health check tests pass
- [ ] ✅ Cleanup and resource management tests pass
- [ ] ✅ Error handling tests pass
- [ ] ✅ Test coverage ≥80% for new AgentSphere methods

### End-to-End Testing

Run the comprehensive E2E test script:

```bash
# Run E2E tests
node test-agentsphere-integration.js
```

**Expected Results:**
- [ ] ✅ OrchestrationService initialization (singleton pattern)
- [ ] ✅ Sandbox listing functionality
- [ ] ✅ User sandbox lookup (with/without project filter)
- [ ] ✅ Node.js project deployment and startup
- [ ] ✅ Manifest project deployment and generation
- [ ] ✅ Deployment monitoring and health checks
- [ ] ✅ Sandbox cleanup and resource management
- [ ] ✅ Execution statistics collection
- [ ] ✅ Error handling and recovery
- [ ] ✅ Test report generation and persistence

## Manual Testing

### 1. Service Initialization Testing

**Test Steps:**
1. Start the application: `npm start`
2. Verify OrchestrationService logs show AgentSphere SDK integration
3. Check for any initialization errors in logs

**Expected Behavior:**
- [ ] Service starts without errors
- [ ] AgentSphere SDK loads correctly (or falls back to mock)
- [ ] Singleton pattern maintained across requests

**Validation Commands:**
```bash
# Check service startup logs
tail -f logs/application.log | grep -i agentsphere

# Test service endpoint
curl http://localhost:3000/api/health
```

### 2. Sandbox Management Testing

**Test Steps:**
1. Call `listActiveSandboxes()` method
2. Create a test deployment
3. Verify sandbox appears in active list
4. Test `findUserSandbox()` with various filters

**Expected Behavior:**
- [ ] Returns empty array when no sandboxes exist
- [ ] Returns correct sandbox info structure
- [ ] Handles API failures gracefully
- [ ] User filtering works correctly

**Validation Commands:**
```bash
# Test sandbox listing via API
curl -X GET http://localhost:3000/api/deployments/sandboxes \
  -H "Authorization: Bearer test-token"

# Test user sandbox lookup
curl -X GET "http://localhost:3000/api/deployments/user-sandboxes?userId=test-user" \
  -H "Authorization: Bearer test-token"
```

### 3. Project Deployment Testing

#### Node.js Project Deployment

**Test Data:**
```json
{
  "files": [
    {
      "path": "package.json",
      "content": "{\"name\":\"test-app\",\"main\":\"server.js\",\"scripts\":{\"start\":\"node server.js\"},\"dependencies\":{\"express\":\"^4.18.0\"}}"
    },
    {
      "path": "server.js",
      "content": "const express = require('express'); const app = express(); app.get('/', (req, res) => res.send('Hello World!')); app.get('/health', (req, res) => res.json({status: 'ok'})); app.listen(3000);"
    }
  ]
}
```

**Test Steps:**
1. Deploy Node.js project via API
2. Monitor deployment status
3. Verify application accessibility
4. Check logs and health status

**Expected Behavior:**
- [ ] Deployment creates sandbox successfully
- [ ] Files upload without errors
- [ ] Dependencies install correctly (`npm install`)
- [ ] Application starts and responds to requests
- [ ] Health check endpoint returns 200
- [ ] Deployment status updates correctly

**Validation Commands:**
```bash
# Deploy project
curl -X POST http://localhost:3000/api/deploy \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -d @test-nodejs-project.json

# Check deployment status
curl -X GET http://localhost:3000/api/deployments/{deployment-id}/status \
  -H "Authorization: Bearer test-token"

# Test deployed application
curl https://{sandbox-url}/
curl https://{sandbox-url}/health
```

#### Manifest Project Deployment

**Test Data:**
```json
{
  "files": [
    {
      "path": "manifest.yaml",
      "content": "name: test-manifest-app\ndescription: Test manifest application\nroutes:\n  - path: /\n    method: GET\n    response:\n      message: Hello from Manifest\n  - path: /health\n    method: GET\n    response:\n      status: healthy"
    }
  ]
}
```

**Test Steps:**
1. Deploy Manifest project via API
2. Verify Express project generation
3. Test generated endpoints
4. Validate response structure

**Expected Behavior:**
- [ ] Manifest parsing succeeds
- [ ] Express project generated correctly
- [ ] All routes respond as defined
- [ ] Generated code follows best practices

### 4. Monitoring and Health Check Testing

**Test Steps:**
1. Deploy a test application
2. Monitor deployment health over time
3. Test health check resilience
4. Verify log collection

**Expected Behavior:**
- [ ] Health checks return accurate status
- [ ] Metrics collection works (uptime, memory, CPU)
- [ ] Log aggregation functions correctly
- [ ] Health status updates in real-time

**Validation Commands:**
```bash
# Monitor deployment health
curl -X GET http://localhost:3000/api/deployments/{deployment-id}/monitor \
  -H "Authorization: Bearer test-token"

# Get deployment logs
curl -X GET http://localhost:3000/api/deployments/{deployment-id}/logs \
  -H "Authorization: Bearer test-token"
```

### 5. Resource Management and Cleanup Testing

**Test Steps:**
1. Create multiple test deployments
2. Let some deployments idle
3. Trigger cleanup process
4. Verify resource deallocation

**Expected Behavior:**
- [ ] Idle sandboxes cleaned up automatically
- [ ] Old deployments marked as destroyed
- [ ] Database records updated correctly
- [ ] No memory leaks in tracking data structures

**Validation Commands:**
```bash
# Trigger manual cleanup
curl -X POST http://localhost:3000/api/deployments/cleanup \
  -H "Authorization: Bearer test-token" \
  -d '{"force": true}'

# Check cleanup statistics
curl -X GET http://localhost:3000/api/deployments/stats \
  -H "Authorization: Bearer test-token"
```

### 6. Error Handling and Recovery Testing

**Test Steps:**
1. Test deployment with invalid files
2. Simulate network timeouts
3. Test sandbox connection failures
4. Verify recovery mechanisms

**Expected Behavior:**
- [ ] Invalid deployments fail gracefully
- [ ] Timeout errors trigger retry logic
- [ ] Failed sandboxes are cleaned up
- [ ] Error messages are informative

**Test Cases:**
- [ ] Deploy with empty files array
- [ ] Deploy with malformed package.json
- [ ] Deploy with missing start script
- [ ] Simulate AgentSphere API timeout
- [ ] Test sandbox kill failure scenarios

## Performance Testing

### Load Testing

**Test Configuration:**
- Concurrent deployments: 10
- Test duration: 5 minutes
- Success rate threshold: >95%

**Test Steps:**
1. Run load test script
2. Monitor resource usage
3. Verify deployment success rate
4. Check cleanup efficiency

**Expected Results:**
- [ ] Handle 10 concurrent deployments
- [ ] Memory usage remains stable
- [ ] Cleanup processes don't block deployments
- [ ] No resource leaks detected

### Stress Testing

**Test Configuration:**
- Peak load: 50 concurrent requests
- Memory limit: 1GB
- Timeout threshold: 30 seconds

**Expected Results:**
- [ ] Graceful degradation under load
- [ ] Circuit breaker activates when necessary
- [ ] Recovery time <2 minutes after load reduction

## Security Testing

### Authentication and Authorization

**Test Steps:**
1. Test API endpoints without authentication
2. Test with invalid tokens
3. Test user isolation (sandbox access)
4. Verify environment variable security

**Expected Behavior:**
- [ ] Unauthenticated requests rejected
- [ ] Invalid tokens rejected appropriately
- [ ] Users can only access their own sandboxes
- [ ] Sensitive data not logged or exposed

### Sandbox Isolation

**Test Steps:**
1. Deploy multiple applications for different users
2. Attempt cross-user access
3. Verify network isolation
4. Test file system restrictions

**Expected Behavior:**
- [ ] Users cannot access other users' sandboxes
- [ ] Network traffic properly isolated
- [ ] File system access restricted appropriately
- [ ] Environment variables scoped correctly

## Production Readiness

### Configuration Management

- [ ] **Environment Configuration**
  - [ ] Production environment variables configured
  - [ ] Database connection pooling enabled
  - [ ] Logging levels appropriate for production
  - [ ] Error reporting configured

- [ ] **Resource Limits**
  - [ ] User sandbox limits configured
  - [ ] Cleanup intervals optimized
  - [ ] Memory limits enforced
  - [ ] Timeout configurations appropriate

### Monitoring and Alerting

- [ ] **Health Monitoring**
  - [ ] Application health checks configured
  - [ ] Sandbox health monitoring active
  - [ ] Database connection monitoring
  - [ ] API endpoint monitoring

- [ ] **Alerting Rules**
  - [ ] High error rate alerts
  - [ ] Resource exhaustion alerts
  - [ ] Sandbox cleanup failure alerts
  - [ ] Performance degradation alerts

### Backup and Recovery

- [ ] **Data Backup**
  - [ ] Deployment records backed up
  - [ ] Configuration data backed up
  - [ ] User sandbox metadata preserved
  - [ ] Recovery procedures tested

- [ ] **Disaster Recovery**
  - [ ] AgentSphere API failover tested
  - [ ] Database failover procedures
  - [ ] Service restart procedures
  - [ ] Data consistency verification

## Documentation and Maintenance

### Code Documentation

- [ ] **API Documentation**
  - [ ] All new methods documented
  - [ ] Parameter types and return values specified
  - [ ] Error conditions documented
  - [ ] Usage examples provided

- [ ] **Integration Guide**
  - [ ] Setup instructions complete
  - [ ] Configuration options documented
  - [ ] Troubleshooting guide available
  - [ ] Migration path from previous versions

### Operational Procedures

- [ ] **Deployment Procedures**
  - [ ] Production deployment checklist
  - [ ] Rollback procedures documented
  - [ ] Database migration procedures
  - [ ] Configuration update procedures

- [ ] **Monitoring Procedures**
  - [ ] Performance baseline established
  - [ ] Alert response procedures
  - [ ] Capacity planning guidelines
  - [ ] Incident response procedures

## Sign-off Checklist

### Development Team

- [ ] **Code Review Completed**
  - [ ] All code changes reviewed by senior developer
  - [ ] Security review completed
  - [ ] Performance impact assessed
  - [ ] Documentation updated

- [ ] **Testing Completed**
  - [ ] Unit tests pass with >80% coverage
  - [ ] Integration tests pass completely
  - [ ] E2E tests pass without errors
  - [ ] Performance tests meet requirements

### Operations Team

- [ ] **Infrastructure Ready**
  - [ ] Production environment provisioned
  - [ ] Monitoring systems configured
  - [ ] Alerting rules activated
  - [ ] Backup systems operational

- [ ] **Procedures Validated**
  - [ ] Deployment procedures tested
  - [ ] Rollback procedures verified
  - [ ] Incident response procedures ready
  - [ ] Documentation accessible

### Final Approval

- [ ] **Development Lead Sign-off**
  - Name: ________________
  - Date: ________________
  - Signature: ________________

- [ ] **Operations Lead Sign-off**
  - Name: ________________
  - Date: ________________
  - Signature: ________________

- [ ] **Product Owner Sign-off**
  - Name: ________________
  - Date: ________________
  - Signature: ________________

## Post-Deployment Verification

### Week 1 - Immediate Monitoring

- [ ] **Daily Checks**
  - [ ] Error rates within acceptable limits
  - [ ] Response times meeting SLA
  - [ ] Cleanup processes running correctly
  - [ ] User complaints/feedback review

### Week 2-4 - Stability Assessment

- [ ] **Weekly Reviews**
  - [ ] Performance trend analysis
  - [ ] Resource utilization review
  - [ ] Error pattern analysis
  - [ ] Capacity planning updates

### Month 1+ - Long-term Optimization

- [ ] **Monthly Reviews**
  - [ ] Feature usage analytics
  - [ ] Cost optimization opportunities
  - [ ] Performance optimization needs
  - [ ] Scalability assessment

---

**Document Version:** 1.0  
**Last Updated:** $(date)  
**Next Review Date:** $(date -d '+3 months')

## Troubleshooting Guide

### Common Issues

1. **AgentSphere SDK Connection Failures**
   - Check API key validity
   - Verify network connectivity
   - Review firewall configurations
   - Check SDK version compatibility

2. **Deployment Timeouts**
   - Increase timeout configuration
   - Check sandbox resource limits
   - Verify npm registry accessibility
   - Review dependency complexity

3. **Health Check Failures**
   - Verify application start command
   - Check port configuration
   - Review application logs
   - Test sandbox network connectivity

4. **Cleanup Process Issues**
   - Check database connection
   - Verify sandbox access permissions
   - Review cleanup criteria
   - Monitor resource constraints

### Support Contacts

- **Development Team:** dev-team@company.com
- **Operations Team:** ops-team@company.com
- **AgentSphere Support:** support@agentsphere.com
- **Emergency Contact:** on-call@company.com