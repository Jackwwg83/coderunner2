# CodeRunner v2.0 Deployment Strategy

## Overview

This document outlines the comprehensive deployment strategy for CodeRunner v2.0's OrchestrationService, designed to manage sandbox lifecycle, handle errors, and ensure reliable deployments using the AgentSphere SDK.

## 1. Deployment Flow Diagram

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│   Request   │───▶│  Validation  │───▶│ Provision   │───▶│   Deploy     │
│   Received  │    │  & Limits    │    │  Sandbox    │    │ Application  │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────────┘
                           │                    │                 │
                           ▼                    ▼                 ▼
                    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
                    │   Reject     │    │   Create    │    │   Health     │
                    │   (Limits)   │    │  Database   │    │   Monitor    │
                    └──────────────┘    │   Record    │    │   & Serve    │
                                        └─────────────┘    └──────────────┘
                                                │                 │
                                                ▼                 ▼
                                        ┌─────────────┐    ┌──────────────┐
                                        │  Sandbox    │    │   Success    │
                                        │ Metadata    │    │   (Running)  │
                                        │  Tracking   │    └──────────────┘
                                        └─────────────┘           │
                                                                  ▼
Error Flow:                                                ┌──────────────┐
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    │   Cleanup    │
│    Error    │───▶│   Classify   │───▶│  Recovery   │    │  (Lifecycle  │
│  Detected   │    │    Error     │    │  Strategy   │    │   Events)    │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────────┘
       │                    │                 │
       ▼                    ▼                 ▼
┌─────────────┐      ┌──────────────┐  ┌─────────────┐
│   Update    │      │    Retry     │  │   Abort &   │
│   Status    │      │ (Backoff)    │  │   Cleanup   │
└─────────────┘      └──────────────┘  └─────────────┘
```

## 2. Timeout Strategy Matrix

### Project Type Classification

| Project Type | Files | Dependencies | Build Time | Timeout Strategy |
|--------------|--------|-------------|------------|------------------|
| **Simple**   | 1-20  | 0-5        | <2 min     | 5min initial, 3min ext, 15min max |
| **Complex**  | 21-50 | 6-15       | 2-8 min    | 10min initial, 5min ext, 30min max |
| **Enterprise** | 50+ | 15+        | 8+ min     | 15min initial, 10min ext, 60min max |

### Timeout Extension Triggers

```typescript
// Auto-extend timeout when:
- Current runtime > 80% of initial timeout
- Health check status === 'healthy' 
- Remaining time < extension period
- Not exceeded maximum timeout

// Kill conditions:
- Exceeded maximum timeout
- Health check failed 3+ times
- No activity for idle timeout period
- Resource usage exceeded limits
```

### Runtime-Specific Timeouts

| Runtime | Initial | Extension | Maximum | Health Check |
|---------|---------|-----------|---------|--------------|
| Node.js | 300s    | 180s     | 900s    | 30s         |
| Python  | 300s    | 180s     | 900s    | 30s         |
| Java    | 600s    | 300s     | 1800s   | 60s         |
| Docker  | 600s    | 300s     | 1800s   | 60s         |

## 3. Error Recovery Procedures

### Error Classification System

```typescript
interface ErrorClassification {
  type: 'timeout' | 'resource' | 'network' | 'sandbox' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable: boolean;
}

// Error Type Mapping:
TimeoutError        → { type: 'timeout', severity: 'medium', recoverable: true }
SandboxError        → { type: 'sandbox', severity: 'high', recoverable: false }
NotFoundError       → { type: 'resource', severity: 'high', recoverable: false }
NetworkError        → { type: 'network', severity: 'medium', recoverable: true }
OutOfMemoryError    → { type: 'resource', severity: 'high', recoverable: false }
```

### Recovery Strategy Matrix

| Error Type | Stage | Retry | Fallback | Action |
|------------|-------|--------|----------|--------|
| Timeout    | Any   | ✅ 3x  | ❌       | Exponential backoff |
| Network    | Any   | ✅ 3x  | ❌       | 2x backoff multiplier |
| Resource   | Provision | ❌  | ✅       | Try smaller instance |
| Resource   | Runtime   | ❌  | ❌       | Abort deployment |
| Sandbox    | Any   | ❌     | ❌       | Abort + cleanup |

### Backoff Algorithm

```typescript
const backoffTime = Math.min(
  1000 * Math.pow(2, retryCount),  // Exponential: 1s, 2s, 4s, 8s...
  30000                            // Maximum 30 seconds
);

// Network errors get 2x multiplier:
const networkBackoffTime = backoffTime * 2;
```

## 4. Cleanup Algorithm

### Automatic Cleanup Triggers

```typescript
// Cleanup Schedule: Every 5 minutes
setInterval(cleanupSandboxes, 5 * 60 * 1000);

// Cleanup Conditions:
1. Age > maxSandboxAge (default: 1 hour)
2. Idle > maxIdleTime (default: 30 minutes) 
3. Deployment status: FAILED | DESTROYED
4. Orphaned (no database record)
5. User exceeded limits (cleanup oldest)
6. Health check failed consistently
```

### Cleanup Priority Matrix

| Priority | Condition | Action | Grace Period |
|----------|-----------|--------|--------------|
| 1 (High) | Failed deployment | Immediate cleanup | None |
| 2 (High) | Orphaned sandbox | Cleanup after 10min | 10 minutes |
| 3 (Med)  | User limit exceeded | Cleanup oldest | None |
| 4 (Med)  | Exceeded max age | Scheduled cleanup | 5 minutes |
| 5 (Low)  | Idle timeout | Scheduled cleanup | Current timeout |

### Cleanup Process Flow

```
1. Scan Active Sandboxes
   ├── Check metadata exists
   ├── Calculate age and idle time
   ├── Check deployment status
   └── Apply cleanup rules

2. Batch Processing (max 10 per cycle)
   ├── Terminate sandbox gracefully
   ├── Update database records
   ├── Clear memory references
   └── Emit cleanup events

3. Error Handling
   ├── Log cleanup failures
   ├── Retry failed cleanups
   └── Alert on consistent failures
```

## 5. TypeScript Implementation

### Core OrchestrationService Methods

```typescript
// 1. Deploy Project
async deployProject(
  projectId: string,
  userId: string, 
  files: any[],
  options: DeploymentOptions
): Promise<{
  deploymentId: string;
  sandboxId: string;
  publicUrl?: string;
}>

// 2. Monitor Deployment  
async monitorDeployment(deploymentId: string): Promise<{
  status: DeploymentStatus;
  health: 'healthy' | 'unhealthy' | 'unknown';
  metrics: {
    uptime: number;
    memoryUsage: number; 
    cpuUsage: number;
    responseTime?: number;
  };
  logs: string[];
}>

// 3. Cleanup Sandboxes
async cleanupSandboxes(options: {
  force?: boolean;
  maxAge?: number;
  maxIdle?: number;
  userId?: string;
}): Promise<{
  cleaned: number;
  errors: string[];
  details: Array<{
    sandboxId: string;
    reason: string;
    success: boolean;
  }>;
}>

// 4. Handle Errors
async handleErrors(
  deploymentId: string,
  error: Error,
  context: {
    stage: 'provisioning' | 'building' | 'deploying' | 'running';
    retryCount?: number;
    maxRetries?: number;
  }
): Promise<{
  recovered: boolean;
  action: 'retry' | 'fallback' | 'abort';
  nextRetryIn?: number;
}>
```

## 6. Configuration Recommendations

### Environment Variables

```bash
# Resource Limits
MAX_SANDBOXES_PER_USER=3
MAX_SANDBOXES_GLOBAL=100
SANDBOX_MEMORY_LIMIT=512  # MB
SANDBOX_DISK_LIMIT=1024   # MB
SANDBOX_CPU_LIMIT=1.0     # Cores

# Timeouts (seconds)
SANDBOX_TIMEOUT_SIMPLE=300
SANDBOX_TIMEOUT_COMPLEX=600
SANDBOX_TIMEOUT_ENTERPRISE=900

# Health Monitoring  
HEALTH_CHECK_ENABLED=true
HEALTH_CHECK_INTERVAL=30000  # ms
HEALTH_CHECK_TIMEOUT=5000    # ms
HEALTH_CHECK_RETRIES=3

# Cleanup
CLEANUP_INTERVAL=300000      # 5 minutes
MAX_IDLE_TIME=1800000       # 30 minutes  
MAX_SANDBOX_AGE=3600000     # 1 hour
```

### Default Values & Tuning

```typescript
// Production Recommended Values:
const PRODUCTION_CONFIG = {
  limits: {
    maxConcurrentPerUser: 5,
    maxConcurrentGlobal: 200,
    memoryLimitMB: 1024,
    diskLimitMB: 2048,
    cpuLimit: 2.0
  },
  
  timeouts: {
    simple: { initial: 300, maximum: 900 },
    complex: { initial: 600, maximum: 1800 },  
    enterprise: { initial: 900, maximum: 3600 }
  },
  
  monitoring: {
    healthCheckInterval: 15000,  # More frequent for production
    cleanupInterval: 180000,     # Every 3 minutes
    maxIdleTime: 900000         # 15 minutes idle limit
  }
};

// Development Recommended Values:
const DEVELOPMENT_CONFIG = {
  limits: {
    maxConcurrentPerUser: 2,
    maxConcurrentGlobal: 50,
    memoryLimitMB: 512,
    diskLimitMB: 1024,
    cpuLimit: 1.0
  },
  
  timeouts: {
    simple: { initial: 180, maximum: 600 },    # Shorter for dev
    complex: { initial: 300, maximum: 900 },
    enterprise: { initial: 600, maximum: 1800 }
  }
};
```

## 7. Monitoring & Alerting

### Health Check Endpoints

```typescript
// Standard health check endpoints to test:
const HEALTH_ENDPOINTS = [
  '/health',           // Standard health endpoint
  '/api/health',       // API health endpoint  
  '/ping',            // Simple ping endpoint
  '/',                // Root endpoint (for static sites)
];

// Health check logic:
1. HTTP GET request to each endpoint
2. Timeout: 5 seconds per endpoint
3. Success criteria: HTTP 200-299 status
4. Retry failed endpoints up to 3 times
5. Mark unhealthy if all endpoints fail
```

### Metrics Collection

```typescript
interface DeploymentMetrics {
  // Performance Metrics
  responseTime: number;        // Average response time (ms)
  throughput: number;         // Requests per second
  errorRate: number;          // Error rate percentage
  
  // Resource Metrics  
  cpuUsage: number;           // CPU utilization (0-1)
  memoryUsage: number;        // Memory utilization (0-1)
  diskUsage: number;          // Disk utilization (0-1)
  networkIO: number;          // Network I/O (bytes/sec)
  
  // Business Metrics
  uptime: number;             // Uptime in milliseconds
  deploymentAge: number;      // Age since deployment
  lastActivity: Date;         // Last recorded activity
  healthStatus: string;       // Current health status
}
```

### Alert Thresholds

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| CPU Usage | >70% | >90% | Scale up / Alert admin |
| Memory Usage | >80% | >95% | Restart / Scale up |
| Disk Usage | >85% | >95% | Cleanup / Alert admin |  
| Response Time | >2s | >5s | Investigate performance |
| Error Rate | >5% | >15% | Check logs / Restart |
| Health Check Failures | 2 consecutive | 5 consecutive | Restart deployment |

## 8. Best Practices & Considerations

### Security
- Never log sensitive information (API keys, tokens)
- Implement sandbox isolation and resource limits
- Use secure communication channels for health checks
- Regular security audits of deployed applications

### Performance
- Implement connection pooling for database operations
- Use async/await for all I/O operations
- Cache frequently accessed data (deployment metadata)
- Batch cleanup operations to reduce database load

### Reliability  
- Implement circuit breaker pattern for external dependencies
- Use exponential backoff with jitter for retries
- Graceful degradation when resources are limited
- Comprehensive logging and error tracking

### Scalability
- Design for horizontal scaling of the orchestration service
- Use database transactions for critical operations
- Implement rate limiting to prevent resource exhaustion
- Monitor and auto-scale based on resource utilization

This deployment strategy provides a robust foundation for managing CodeRunner v2.0's sandbox lifecycle with proper error handling, resource management, and monitoring capabilities.