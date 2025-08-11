# CodeRunner Monitoring & Metrics System

## Overview

The CodeRunner monitoring system provides comprehensive observability for deployments, system resources, and application performance. It implements a three-layer monitoring architecture with minimal performance impact through smart sampling strategies.

## Architecture

### Three-Layer Monitoring

1. **System Level**: CPU, memory, disk, network metrics
2. **Application Level**: API performance, deployments, WebSocket connections
3. **Business Level**: User activity, resource costs, feature usage

### Components

- **MetricsService**: Prometheus-compatible metrics collection
- **HealthCheckService**: Multi-component health monitoring with circuit breakers
- **Prometheus**: Metrics storage and alerting
- **Grafana**: Visualization and dashboards
- **AlertManager**: Alert routing and notifications

## Quick Start

### 1. Start Monitoring Stack

```bash
# Start all monitoring services
./scripts/start-monitoring.sh

# Start with logs
./scripts/start-monitoring.sh --logs
```

### 2. Access Services

- **Grafana**: http://localhost:3001 (admin/admin123)
- **Prometheus**: http://localhost:9090
- **AlertManager**: http://localhost:9093
- **API Health**: http://localhost:3000/health
- **API Metrics**: http://localhost:3000/api/metrics

### 3. Import Dashboard

1. Open Grafana at http://localhost:3001
2. Login with admin/admin123
3. Navigate to "+" > Import
4. Upload `monitoring/grafana-dashboard.json`

## Metrics Collection

### System Metrics

```typescript
// CPU usage by core
coderunner_system_cpu_usage_percent{core="0",type="usage"}

// Memory usage
coderunner_system_memory_usage_bytes{type="used"}
coderunner_system_memory_usage_bytes{type="total"}
coderunner_system_memory_usage_bytes{type="usage_percent"}

// Load average
coderunner_system_load_average{period="1m"}
```

### Application Metrics

```typescript
// API requests
coderunner_api_requests_total{method="GET",endpoint="/api/deploy",status="2xx"}

// Response times
coderunner_api_duration_seconds_bucket{method="POST",endpoint="/api/deploy",le="0.1"}

// Deployments
coderunner_deployments_total{status="RUNNING",type="nodejs"}

// WebSocket connections
coderunner_websocket_connections_total{status="authenticated"}
```

### Business Metrics

```typescript
// User activity
coderunner_user_activity_total{action="deploy",plan_type="premium"}

// Feature usage
coderunner_feature_usage_total{feature="websocket",user_type="authenticated"}

// Resource costs
coderunner_resource_costs_total{resource_type="compute",plan="team"}
```

## Health Checks

### Built-in Health Checks

- **Database**: Connection, latency, pool status
- **WebSocket**: Connection count, error rate
- **Metrics**: Collection status, performance impact
- **System**: CPU, memory, disk usage
- **Network**: Internet connectivity, DNS resolution
- **Dependencies**: External services (AgentSphere)

### Health Endpoints

```bash
# Basic health (for load balancers)
GET /health

# Detailed health information
GET /api/health

# Kubernetes readiness probe
GET /ready

# Kubernetes liveness probe
GET /live
```

### Circuit Breaker

Health checks implement circuit breaker pattern:
- **Closed**: Normal operation
- **Open**: After 3 consecutive failures (30s cooldown)
- **Half-Open**: Testing recovery

## Performance Optimization

### Smart Sampling

The system uses adaptive sampling based on system load:

- **System metrics**: 10-30s intervals (based on CPU load)
- **Application metrics**: 5s intervals
- **Business metrics**: 60s intervals

### Performance Impact

- **CPU overhead**: <2% under normal load
- **Memory overhead**: <50MB
- **Collection time**: <100ms per cycle

### Configuration

```bash
# Environment variables
METRICS_SYSTEM_INTERVAL=10000     # System metrics interval (ms)
METRICS_APP_INTERVAL=5000         # App metrics interval (ms)
METRICS_BUSINESS_INTERVAL=60000   # Business metrics interval (ms)
METRICS_BUFFER_SIZE=1000          # Metric buffer size

# Health check configuration
HEALTH_CHECK_INTERVAL=30000       # Health check interval (ms)
HEALTH_CHECK_TIMEOUT=5000         # Health check timeout (ms)
HEALTH_ENABLE_PROBES=true         # Enable Kubernetes probes
```

## Alerting

### Critical Alerts

- **High CPU Usage**: >80% for 5 minutes
- **Critical Memory**: >95% for 2 minutes
- **High Error Rate**: >5% for 5 minutes
- **Database Down**: Connection failure
- **Service Unhealthy**: Critical service failure

### Alert Channels

- **Slack**: #coderunner-alerts, #coderunner-critical
- **Email**: oncall@coderunner.com
- **PagerDuty**: Critical alerts only

### Alert Configuration

```yaml
# monitoring/alertmanager.yml
route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'default'
```

## Grafana Dashboards

### Default Dashboard

The included dashboard provides:

- **System Overview**: CPU, memory, load average
- **API Performance**: Request rates, response times, error rates
- **Deployment Metrics**: Success rate, duration, status distribution
- **WebSocket Activity**: Connection counts, subscription rates
- **Health Status**: Service health matrix
- **Resource Costs**: Cost tracking by resource type

### Custom Dashboards

1. Create new dashboard in Grafana
2. Use Prometheus as data source
3. Query metrics using PromQL:

```promql
# API request rate
sum(rate(coderunner_api_requests_total[5m])) by (endpoint)

# Memory usage percentage
coderunner_system_memory_usage_bytes{type="usage_percent"}

# Deployment success rate
sum(rate(coderunner_deployments_total{status="RUNNING"}[10m])) /
sum(rate(coderunner_deployments_total[10m]))
```

## API Integration

### Recording Metrics

```typescript
import { MetricsService } from './services/metrics';

const metrics = MetricsService.getInstance();

// Record API request
metrics.recordApiRequest('POST', '/api/deploy', 200, 1500);

// Record deployment
metrics.recordDeployment('nodejs', 'completed', 30000, 'user123');

// Record user activity
metrics.recordUserActivity('login', 'premium');

// Record feature usage
metrics.recordFeatureUsage('websocket', 'authenticated');

// Update WebSocket connections
metrics.updateWebSocketConnections(100, 85);
```

### Custom Health Checks

```typescript
import { HealthCheckService } from './services/healthCheck';

const health = HealthCheckService.getInstance();

// Register custom health check
health.registerHealthCheck('custom-service', async () => {
  try {
    await customService.ping();
    return {
      name: 'custom-service',
      status: 'healthy',
      responseTime: 10,
      timestamp: new Date()
    };
  } catch (error) {
    return {
      name: 'custom-service',
      status: 'unhealthy',
      responseTime: 0,
      timestamp: new Date(),
      error: error.message
    };
  }
});
```

## Docker Compose

### Services

- **prometheus**: Metrics collection and storage
- **grafana**: Visualization and dashboards
- **alertmanager**: Alert handling and routing
- **node-exporter**: System metrics collection
- **blackbox-exporter**: External endpoint monitoring
- **redis**: Caching and WebSocket scaling
- **postgres-exporter**: Database metrics
- **redis-exporter**: Redis metrics

### Volume Persistence

```yaml
volumes:
  prometheus-data: # Prometheus TSDB
  grafana-data:    # Grafana dashboards and settings
  alertmanager-data: # AlertManager configuration
  redis-data:      # Redis persistence
```

## Troubleshooting

### Common Issues

#### Metrics Not Appearing

1. Check if metrics service is running:
   ```bash
   curl http://localhost:3000/api/metrics/current
   ```

2. Verify Prometheus targets:
   - Visit http://localhost:9090/targets
   - Ensure CodeRunner API target is UP

3. Check metric names in Prometheus:
   ```bash
   curl http://localhost:9090/api/v1/label/__name__/values
   ```

#### High Resource Usage

1. Check sampling configuration:
   ```bash
   curl http://localhost:3000/api/metrics/current | jq .sampling
   ```

2. Reduce collection frequency:
   ```bash
   export METRICS_SYSTEM_INTERVAL=30000
   export METRICS_APP_INTERVAL=15000
   ```

3. Monitor performance impact:
   ```bash
   curl http://localhost:3000/api/metrics/current | jq .performance
   ```

#### Health Checks Failing

1. Check service status:
   ```bash
   curl http://localhost:3000/api/health
   ```

2. View detailed health information:
   ```bash
   curl http://localhost:3000/api/health | jq '.checks[] | select(.status != "healthy")'
   ```

3. Check circuit breaker status:
   - Look for "Circuit breaker is open" errors
   - Wait for cooldown period (30 seconds)

### Log Analysis

```bash
# View all monitoring logs
docker-compose -f docker-compose.monitoring.yml logs -f

# View specific service logs
docker-compose -f docker-compose.monitoring.yml logs prometheus
docker-compose -f docker-compose.monitoring.yml logs grafana
docker-compose -f docker-compose.monitoring.yml logs alertmanager
```

## Production Deployment

### Security Considerations

1. **Change default passwords**:
   ```yaml
   environment:
     - GF_SECURITY_ADMIN_PASSWORD=<strong-password>
   ```

2. **Enable HTTPS**:
   ```yaml
   environment:
     - GF_SERVER_PROTOCOL=https
     - GF_SERVER_CERT_FILE=/etc/ssl/certs/grafana.crt
     - GF_SERVER_CERT_KEY=/etc/ssl/private/grafana.key
   ```

3. **Restrict network access**:
   ```yaml
   networks:
     monitoring:
       driver: bridge
       internal: true
   ```

### Scaling Considerations

1. **Prometheus retention**:
   ```yaml
   command:
     - '--storage.tsdb.retention.time=30d'
     - '--storage.tsdb.retention.size=10GB'
   ```

2. **Grafana high availability**:
   - Use external database
   - Configure session storage
   - Load balance multiple instances

3. **AlertManager clustering**:
   ```yaml
   command:
     - '--cluster.peer=alertmanager-2:9093'
     - '--cluster.peer=alertmanager-3:9093'
   ```

## API Reference

### Metrics Endpoints

| Endpoint | Method | Description |
|----------|--------|--------------|
| `/api/metrics` | GET | Prometheus metrics (text/plain) |
| `/api/metrics/current` | GET | Current metrics (JSON) |
| `/health` | GET | Basic health check |
| `/api/health` | GET | Detailed health information |
| `/ready` | GET | Kubernetes readiness probe |
| `/live` | GET | Kubernetes liveness probe |

### Response Formats

```json
// GET /api/health
{
  "overall": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "version": "1.0.0",
  "checks": [
    {
      "name": "database",
      "status": "healthy",
      "responseTime": 15,
      "details": {
        "connection": true,
        "latency": 10,
        "poolSize": 10
      }
    }
  ],
  "summary": {
    "total": 6,
    "healthy": 5,
    "unhealthy": 0,
    "degraded": 1,
    "responseTime": 150
  }
}
```

## Contributing

When adding new metrics or health checks:

1. **Add metric definition** in `MetricsService`
2. **Update Prometheus config** if needed
3. **Add to Grafana dashboard**
4. **Configure alerts** in AlertManager
5. **Add tests** for new functionality
6. **Update documentation**

## License

MIT License - see LICENSE file for details.