#!/bin/bash

# CodeRunner v2.0 - Production Health Monitor
# Continuous health monitoring with alerting

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
API_URL="${API_URL:-http://localhost:8080}"
CHECK_INTERVAL="${CHECK_INTERVAL:-30}"
LOG_FILE="${LOG_FILE:-./logs/health-monitor.log}"
ALERT_EMAIL="${ALERT_EMAIL:-admin@localhost}"
MAX_RESPONSE_TIME="${MAX_RESPONSE_TIME:-5000}"  # milliseconds
MAX_FAILURE_COUNT="${MAX_FAILURE_COUNT:-3}"

# Counters
FAILURE_COUNT=0
LAST_ALERT_TIME=0
ALERT_COOLDOWN=1800  # 30 minutes

# Create logs directory
mkdir -p "$(dirname "$LOG_FILE")"

# Logging function
log_message() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

# Send alert (placeholder - implement with your alerting system)
send_alert() {
    local severity=$1
    local message=$2
    local current_time=$(date +%s)
    
    # Implement cooldown to prevent spam
    if [ $((current_time - LAST_ALERT_TIME)) -lt $ALERT_COOLDOWN ]; then
        log_message "INFO" "Alert cooldown active, skipping alert"
        return 0
    fi
    
    log_message "ALERT" "[$severity] $message"
    
    # Email alert (requires mailutils)
    if command -v mail &> /dev/null; then
        echo "$message" | mail -s "CodeRunner Alert [$severity]" "$ALERT_EMAIL"
    fi
    
    # Slack webhook (if configured)
    if [ -n "$SLACK_WEBHOOK" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🚨 CodeRunner Alert [$severity]: $message\"}" \
            "$SLACK_WEBHOOK" || true
    fi
    
    # Discord webhook (if configured)
    if [ -n "$DISCORD_WEBHOOK" ]; then
        curl -H "Content-Type: application/json" \
            -d "{\"content\":\"🚨 CodeRunner Alert [$severity]: $message\"}" \
            "$DISCORD_WEBHOOK" || true
    fi
    
    LAST_ALERT_TIME=$current_time
}

# Health check function
check_health() {
    local start_time=$(date +%s%3N)
    local response_code
    local response_body
    local response_time
    local status="UNKNOWN"
    
    # Make request with timeout
    if response=$(curl -s -w "%{http_code}" --max-time 10 "$API_URL/health" 2>/dev/null); then
        response_code="${response: -3}"
        response_body="${response%???}"
        
        local end_time=$(date +%s%3N)
        response_time=$((end_time - start_time))
        
        # Check response code
        if [ "$response_code" = "200" ]; then
            # Parse JSON response for detailed status
            if command -v jq &> /dev/null; then
                status=$(echo "$response_body" | jq -r '.status' 2>/dev/null || echo "OK")
                
                # Check database status if available
                db_status=$(echo "$response_body" | jq -r '.database.status' 2>/dev/null || echo "unknown")
                if [ "$db_status" = "connected" ]; then
                    db_connected=true
                else
                    db_connected=false
                fi
                
                # Check Redis status if available
                redis_status=$(echo "$response_body" | jq -r '.redis.status' 2>/dev/null || echo "unknown")
                if [ "$redis_status" = "connected" ]; then
                    redis_connected=true
                else
                    redis_connected=false
                fi
            else
                status="OK"
                db_connected=true
                redis_connected=true
            fi
            
            # Check response time
            if [ "$response_time" -gt "$MAX_RESPONSE_TIME" ]; then
                log_message "WARN" "Slow response: ${response_time}ms (threshold: ${MAX_RESPONSE_TIME}ms)"
                send_alert "WARNING" "API responding slowly: ${response_time}ms"
            else
                log_message "INFO" "Health check OK: ${response_time}ms"
            fi
            
            # Reset failure counter on success
            FAILURE_COUNT=0
            return 0
            
        else
            log_message "ERROR" "HTTP $response_code: $response_body"
            return 1
        fi
    else
        log_message "ERROR" "Health check request failed (timeout or connection error)"
        return 1
    fi
}

# Check Docker services
check_docker_services() {
    local services_down=""
    
    # Check if Docker Compose services are running
    if ! docker-compose -f docker-compose.prod.yml ps --services --filter "status=running" | grep -q "api"; then
        services_down="$services_down api"
    fi
    
    if ! docker-compose -f docker-compose.prod.yml ps --services --filter "status=running" | grep -q "postgres"; then
        services_down="$services_down postgres"
    fi
    
    if ! docker-compose -f docker-compose.prod.yml ps --services --filter "status=running" | grep -q "redis"; then
        services_down="$services_down redis"
    fi
    
    if [ -n "$services_down" ]; then
        log_message "ERROR" "Docker services down:$services_down"
        send_alert "CRITICAL" "Docker services are down:$services_down"
        return 1
    fi
    
    return 0
}

# Check system resources
check_system_resources() {
    # Check disk space
    local disk_usage=$(df / | awk 'NR==2 {print int($5)}')
    if [ "$disk_usage" -gt 90 ]; then
        log_message "ERROR" "Disk usage critical: ${disk_usage}%"
        send_alert "CRITICAL" "Disk space critical: ${disk_usage}% used"
    elif [ "$disk_usage" -gt 80 ]; then
        log_message "WARN" "Disk usage high: ${disk_usage}%"
        send_alert "WARNING" "Disk space high: ${disk_usage}% used"
    fi
    
    # Check memory usage
    local mem_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    if [ "$mem_usage" -gt 90 ]; then
        log_message "ERROR" "Memory usage critical: ${mem_usage}%"
        send_alert "CRITICAL" "Memory usage critical: ${mem_usage}%"
    elif [ "$mem_usage" -gt 80 ]; then
        log_message "WARN" "Memory usage high: ${mem_usage}%"
    fi
    
    # Check load average
    local load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    local cpu_cores=$(nproc)
    local load_threshold=$(echo "$cpu_cores * 2" | bc)
    
    if [ "$(echo "$load_avg > $load_threshold" | bc)" -eq 1 ]; then
        log_message "WARN" "High load average: $load_avg (cores: $cpu_cores)"
        send_alert "WARNING" "High system load: $load_avg (threshold: $load_threshold)"
    fi
}

# Check SSL certificate expiration
check_ssl_expiry() {
    if [ -f "ssl/coderunner.crt" ]; then
        local expire_date=$(openssl x509 -in ssl/coderunner.crt -noout -enddate | cut -d= -f2)
        local expire_timestamp=$(date -d "$expire_date" +%s)
        local current_timestamp=$(date +%s)
        local days_until_expire=$(( ($expire_timestamp - $current_timestamp) / 86400 ))
        
        if [ $days_until_expire -le 7 ]; then
            log_message "ERROR" "SSL certificate expires in $days_until_expire days"
            send_alert "CRITICAL" "SSL certificate expires in $days_until_expire days"
        elif [ $days_until_expire -le 30 ]; then
            log_message "WARN" "SSL certificate expires in $days_until_expire days"
            send_alert "WARNING" "SSL certificate expires in $days_until_expire days"
        fi
    fi
}

# Show status
show_status() {
    echo -e "${BLUE}📊 CodeRunner Health Monitor Status${NC}"
    echo "=================================="
    echo "API URL: $API_URL"
    echo "Check Interval: ${CHECK_INTERVAL}s"
    echo "Max Response Time: ${MAX_RESPONSE_TIME}ms"
    echo "Failure Count: $FAILURE_COUNT/$MAX_FAILURE_COUNT"
    echo "Log File: $LOG_FILE"
    echo "Alert Email: $ALERT_EMAIL"
    echo ""
    
    # Recent log entries
    if [ -f "$LOG_FILE" ]; then
        echo -e "${BLUE}📝 Recent Log Entries (last 10):${NC}"
        tail -n 10 "$LOG_FILE"
    fi
    
    echo ""
    echo -e "${BLUE}🐳 Docker Services Status:${NC}"
    docker-compose -f docker-compose.prod.yml ps
    
    echo ""
    echo -e "${BLUE}💾 System Resources:${NC}"
    echo "Disk Usage: $(df / | awk 'NR==2 {print int($5)}')%"
    echo "Memory Usage: $(free | awk 'NR==2{printf "%.0f", $3*100/$2}')%"
    echo "Load Average: $(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')"
}

# Signal handlers
cleanup() {
    log_message "INFO" "Health monitor stopping..."
    exit 0
}

trap cleanup SIGINT SIGTERM

# Main monitoring loop
monitor() {
    log_message "INFO" "Starting health monitor (PID: $$)"
    log_message "INFO" "Monitoring $API_URL every ${CHECK_INTERVAL}s"
    
    while true; do
        # Primary health check
        if check_health; then
            # Additional checks on success
            check_docker_services
            check_system_resources
            check_ssl_expiry
        else
            # Handle failures
            FAILURE_COUNT=$((FAILURE_COUNT + 1))
            log_message "ERROR" "Health check failed ($FAILURE_COUNT/$MAX_FAILURE_COUNT)"
            
            if [ $FAILURE_COUNT -ge $MAX_FAILURE_COUNT ]; then
                send_alert "CRITICAL" "API health check failed $FAILURE_COUNT times consecutively"
                
                # Try to restart services
                log_message "INFO" "Attempting to restart services..."
                if docker-compose -f docker-compose.prod.yml restart api; then
                    log_message "INFO" "Services restarted successfully"
                    send_alert "INFO" "Services restarted automatically"
                    FAILURE_COUNT=0
                else
                    log_message "ERROR" "Failed to restart services"
                    send_alert "CRITICAL" "Failed to restart services automatically"
                fi
            fi
        fi
        
        sleep $CHECK_INTERVAL
    done
}

# Main script logic
case "${1:-monitor}" in
    monitor)
        monitor
        ;;
    status)
        show_status
        ;;
    check)
        check_health && echo "✅ Health check passed" || echo "❌ Health check failed"
        ;;
    test-alert)
        send_alert "TEST" "Test alert from health monitor"
        echo "Test alert sent"
        ;;
    --help|-h)
        echo "CodeRunner Health Monitor"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  monitor     Start continuous monitoring (default)"
        echo "  status      Show current status"
        echo "  check       Run single health check"
        echo "  test-alert  Send test alert"
        echo ""
        echo "Environment Variables:"
        echo "  API_URL                API endpoint (default: http://localhost:8080)"
        echo "  CHECK_INTERVAL         Check interval in seconds (default: 30)"
        echo "  MAX_RESPONSE_TIME      Max response time in ms (default: 5000)"
        echo "  MAX_FAILURE_COUNT      Max failures before alert (default: 3)"
        echo "  ALERT_EMAIL           Email for alerts (default: admin@localhost)"
        echo "  SLACK_WEBHOOK         Slack webhook URL for alerts"
        echo "  DISCORD_WEBHOOK       Discord webhook URL for alerts"
        exit 0
        ;;
    *)
        echo "Unknown command: $1"
        echo "Use '$0 --help' for usage information"
        exit 1
        ;;
esac