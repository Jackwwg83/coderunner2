# Auto-scaling and Resource Optimization Guide

> **🎯 Auto-scaling System for CodeRunner v2.0**  
> Intelligent resource management with cost optimization and performance monitoring

## Overview

The auto-scaling system provides intelligent resource management for deployments with:

- **Multi-metric scaling decisions** based on CPU, memory, response time, error rate, and request rate
- **Cost tracking and optimization** with budget alerts and recommendations
- **Policy templates** for different workload types (web, API, batch, ML)
- **Real-time monitoring** with WebSocket updates
- **Manual scaling overrides** with cooldown management

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Auto-scaling  │    │   Resource      │    │   Scaling       │
│   Service       │◄──►│   Optimizer     │◄──►│   Policies      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Metrics       │    │   Cost          │    │   Policy        │
│   Collection    │    │   Analytics     │    │   Templates     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Quick Start

### 1. Create a Scaling Policy

```typescript
// Using a template (recommended)
const response = await fetch(`/api/deployments/${deploymentId}/scaling/policy`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    templateId: 'web-app-balanced',
    name: 'My Web App Scaling',
    minInstances: 2,
    maxInstances: 20
  })
});
```

### 2. Monitor Scaling Status

```typescript
const status = await fetch(`/api/deployments/${deploymentId}/scaling/status`, {
  headers: { 'Authorization': `Bearer ${token}` }
});

const data = await status.json();
console.log('Current instances:', data.currentInstances);
console.log('Auto-scaling enabled:', data.isAutoScalingEnabled);
```

### 3. Manual Scaling

```typescript
await fetch(`/api/deployments/${deploymentId}/scaling/manual`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    targetInstances: 5,
    reason: 'Expected traffic spike for product launch'
  })
});
```

## Policy Templates

### Available Templates

| Template | Use Case | Scale Up | Scale Down | Max Instances |
|----------|----------|----------|------------|---------------|
| `web-app-balanced` | General web applications | 70% | 30% | 10 |
| `web-app-aggressive` | High-traffic web apps | 60% | 40% | 50 |
| `api-performance` | Low-latency API services | 60% | 40% | 20 |
| `batch-cost-optimized` | Batch processing | 80% | 20% | 5 |
| `ml-gpu-optimized` | Machine learning workloads | 75% | 25% | 8 |
| `dev-minimal` | Development environments | 90% | 10% | 2 |

### Custom Policy Configuration

```typescript
const customPolicy = {
  name: 'Custom High-Performance API',
  metrics: [
    {
      metric: 'response_time',
      threshold: 0.3, // 30% of max acceptable (500ms -> 150ms trigger)
      comparison: 'gt',
      weight: 0.4
    },
    {
      metric: 'cpu',
      threshold: 0.7,
      comparison: 'gt',
      weight: 0.35
    },
    {
      metric: 'error_rate',
      threshold: 0.01, // 1% error rate
      comparison: 'gt',
      weight: 0.25
    }
  ],
  scaleUpThreshold: 0.65,
  scaleDownThreshold: 0.35,
  cooldownPeriod: 180, // 3 minutes
  minInstances: 3,
  maxInstances: 25,
  isEnabled: true
};
```

## Metric Types

### CPU Usage (`cpu`)
- **Range**: 0-100%
- **Threshold**: Percentage of CPU utilization
- **Best for**: Compute-intensive workloads
- **Recommended weight**: 0.3-0.5

### Memory Usage (`memory`)
- **Range**: 0-100%
- **Threshold**: Percentage of memory utilization
- **Best for**: Memory-intensive applications
- **Recommended weight**: 0.2-0.4

### Response Time (`response_time`)
- **Range**: 0-1 (normalized)
- **Threshold**: Based on 5-second maximum
- **Best for**: User-facing applications
- **Recommended weight**: 0.3-0.5

### Error Rate (`error_rate`)
- **Range**: 0-1 (normalized)
- **Threshold**: Based on 10% maximum
- **Best for**: Reliability-critical services
- **Recommended weight**: 0.1-0.3

### Request Rate (`requests`)
- **Range**: 0-1 (normalized)
- **Threshold**: Based on 1000 RPS maximum
- **Best for**: Traffic-based scaling
- **Recommended weight**: 0.2-0.4

## Cost Optimization

### Budget Configuration

```typescript
await fetch(`/api/deployments/${deploymentId}/resources/budget`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    monthlyLimit: 500, // $500/month
    warningThreshold: 75, // Alert at 75%
    criticalThreshold: 90, // Critical alert at 90%
    isEnabled: true
  })
});
```

### Cost Analytics

```typescript
const analytics = await fetch(`/api/deployments/${deploymentId}/resources/optimize`, {
  headers: { 'Authorization': `Bearer ${token}` }
});

const data = await analytics.json();
console.log('Cost analytics:', data.costAnalytics);
console.log('Recommendations:', data.recommendations);
```

### Optimization Recommendations

The system generates AI-powered recommendations:

- **Right-sizing**: Adjust CPU/memory allocation based on usage
- **Schedule optimization**: Scale down during low-traffic periods
- **Cost reduction**: Identify over-provisioned resources
- **Performance improvement**: Scale up for better user experience

## WebSocket Integration

### Real-time Updates

```javascript
import io from 'socket.io-client';

const socket = io('ws://localhost:3000', {
  auth: { token: JWT_TOKEN }
});

// Subscribe to scaling events
socket.emit('subscribe:deployment', { deploymentId });

// Listen for scaling events
socket.on('scaling:executed', (data) => {
  console.log(`Scaled from ${data.fromInstances} to ${data.toInstances}`);
  console.log(`Reason: ${data.reason}`);
});

socket.on('budget:alert', (data) => {
  console.log(`Budget alert: ${data.message}`);
});
```

## API Reference

### Scaling Status
```
GET /api/deployments/:id/scaling/status
```

**Response:**
```json
{
  "deploymentId": "dep_123",
  "currentInstances": 3,
  "targetInstances": 3,
  "policy": {
    "id": "policy_123",
    "name": "Web App Balanced",
    "isEnabled": true,
    "scaleUpThreshold": 0.7,
    "scaleDownThreshold": 0.3
  },
  "lastDecision": {
    "action": "no_change",
    "confidence": 0.85,
    "reason": "Metrics within thresholds"
  },
  "isAutoScalingEnabled": true
}
```

### Create/Update Policy
```
POST /api/deployments/:id/scaling/policy
```

**Request Body:**
```json
{
  "templateId": "web-app-balanced",
  "name": "My Custom Policy",
  "scaleUpThreshold": 0.7,
  "scaleDownThreshold": 0.3,
  "minInstances": 2,
  "maxInstances": 15,
  "isEnabled": true
}
```

### Manual Scaling
```
POST /api/deployments/:id/scaling/manual
```

**Request Body:**
```json
{
  "targetInstances": 5,
  "reason": "Traffic spike expected"
}
```

### Resource Usage
```
GET /api/deployments/:id/resources/usage?hours=24
```

### Optimization Recommendations
```
GET /api/deployments/:id/resources/optimize
```

### Policy Templates
```
GET /api/scaling/policy-templates?category=web&workloadType=api
```

### Budget Configuration
```
PUT /api/deployments/:id/resources/budget
```

## Best Practices

### 1. Policy Configuration

**Metric Selection:**
- Use 2-4 metrics for balanced decisions
- Weight primary bottleneck metrics higher
- Include error rate for reliability

**Thresholds:**
- Set scale-up threshold 10-20% below critical levels
- Maintain 20-40% gap between up/down thresholds
- Consider workload patterns and SLA requirements

**Instance Limits:**
- Set minimum ≥ 2 for high availability
- Set maximum based on budget and capacity
- Use gradual scaling (±1 instance) for stability

### 2. Cost Optimization

**Budget Management:**
- Set realistic monthly limits with 10-15% buffer
- Configure warning alerts at 75% usage
- Review recommendations monthly

**Resource Efficiency:**
- Target 70-80% average utilization
- Right-size based on 95th percentile usage
- Use scheduled scaling for predictable patterns

### 3. Monitoring

**Key Metrics:**
- Scaling frequency (< 10 events/day ideal)
- Resource utilization (70-80% target)
- Cost efficiency (> 60% utilization score)
- SLA compliance (response time, uptime)

**Alert Setup:**
- Budget warnings at 75% and 90%
- Performance alerts for SLA breaches
- Scaling oscillation detection

### 4. Troubleshooting

**Common Issues:**

| Issue | Cause | Solution |
|-------|-------|----------|
| Frequent scaling | Thresholds too close | Increase gap to 30%+ |
| Slow scaling | High cooldown | Reduce to 2-5 minutes |
| Over-scaling | Single metric bias | Add more metrics with weights |
| High costs | Poor efficiency | Enable recommendations, right-size |

## Pricing Model

**Resource Costs (Mock Rates):**
- CPU: $0.05/core/hour
- Memory: $0.01/GB/hour
- Storage: $0.001/GB/hour
- Network: $0.00001/MB transferred

**Example Monthly Costs:**

| Configuration | Avg Instances | CPU/Memory | Monthly Cost |
|---------------|---------------|-------------|--------------|
| Small (2 cores, 4GB) | 2 | 50% utilization | ~$72 |
| Medium (4 cores, 8GB) | 3 | 60% utilization | ~$259 |
| Large (8 cores, 16GB) | 5 | 70% utilization | ~$756 |

## Integration Examples

### React Dashboard Component

```typescript
import AutoScalingDashboard from '@/components/scaling/AutoScalingDashboard';

function DeploymentDetails({ deploymentId }: { deploymentId: string }) {
  return (
    <div className="space-y-6">
      <AutoScalingDashboard deploymentId={deploymentId} />
    </div>
  );
}
```

### Node.js Backend Integration

```typescript
import { AutoScalingService } from './services/autoScaling';
import { ResourceOptimizerService } from './services/resourceOptimizer';

const autoScaling = AutoScalingService.getInstance();
const optimizer = ResourceOptimizerService.getInstance();

// Start services
autoScaling.startEvaluation();
optimizer.startOptimization();

// Load existing policies
await autoScaling.loadActivePolicies();
```

## Support and Troubleshooting

### Logs and Debugging

**Service Logs:**
```bash
# View auto-scaling logs
grep "AutoScalingService" backend.log

# View resource optimization logs
grep "ResourceOptimizerService" backend.log

# View scaling events
grep "scaling:executed" backend.log
```

**Database Queries:**
```sql
-- Recent scaling events
SELECT * FROM scaling_events 
WHERE deployment_id = 'your-deployment-id' 
ORDER BY created_at DESC LIMIT 10;

-- Resource usage trends
SELECT DATE_TRUNC('hour', timestamp) as hour, 
       AVG(cpu_usage), AVG(memory_usage)
FROM resource_usage 
WHERE deployment_id = 'your-deployment-id'
  AND timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY hour ORDER BY hour;

-- Active policies
SELECT * FROM scaling_policies 
WHERE is_enabled = true;
```

### Health Checks

**Scaling Service Health:**
```
GET /api/deployments/:id/scaling/analytics
```

**System Health:**
```
GET /health
```

### Performance Tuning

**Evaluation Frequency:**
```typescript
// Adjust evaluation frequency (default: 30 seconds)
const autoScaling = AutoScalingService.getInstance();
(autoScaling as any).evaluationFrequency = 60000; // 60 seconds
```

**Resource Usage History:**
```typescript
// Adjust history retention (default: 288 entries = 24 hours)
const optimizer = ResourceOptimizerService.getInstance();
// History is automatically limited in trackResourceUsage()
```

---

**📊 System Metrics:**
- Evaluation frequency: 30 seconds
- History retention: 24 hours (288 data points)
- Cooldown periods: 2-15 minutes
- Cost calculation: Real-time with hourly aggregation

**🔗 Related Documentation:**
- [WebSocket Integration Guide](websocket-guide.md)
- [Metrics Collection Guide](metrics-guide.md)
- [Database Schema](../src/migrations/005-scaling-system.sql)