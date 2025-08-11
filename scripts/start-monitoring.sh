#!/bin/bash

# CodeRunner Monitoring Stack Startup Script
# Starts Prometheus, Grafana, AlertManager, and related services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.monitoring.yml"
PROJECT_NAME="coderunner-monitoring"
HEALTH_CHECK_TIMEOUT=60

echo -e "${GREEN}🚀 Starting CodeRunner Monitoring Stack${NC}"
echo "======================================"

# Function to check if docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Docker is running${NC}"
}

# Function to check if docker-compose file exists
check_compose_file() {
    if [ ! -f "$COMPOSE_FILE" ]; then
        echo -e "${RED}❌ Docker Compose file not found: $COMPOSE_FILE${NC}"
        echo "Please run this script from the project root directory."
        exit 1
    fi
    echo -e "${GREEN}✅ Docker Compose file found${NC}"
}

# Function to create necessary directories
setup_directories() {
    echo -e "${YELLOW}📁 Setting up directories...${NC}"
    
    # Create monitoring directories if they don't exist
    mkdir -p monitoring/grafana/provisioning/datasources
    mkdir -p monitoring/grafana/provisioning/dashboards
    mkdir -p monitoring/grafana/dashboards
    
    # Create Grafana provisioning files if they don't exist
    create_grafana_provisioning
    
    echo -e "${GREEN}✅ Directories created${NC}"
}

# Function to create Grafana provisioning configuration
create_grafana_provisioning() {
    # Datasource configuration
    cat > monitoring/grafana/provisioning/datasources/prometheus.yml << EOF
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
EOF

    # Dashboard configuration
    cat > monitoring/grafana/provisioning/dashboards/dashboards.yml << EOF
apiVersion: 1

providers:
  - name: 'default'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /etc/grafana/provisioning/dashboards
EOF

    # Copy dashboard JSON file
    if [ -f "monitoring/grafana-dashboard.json" ]; then
        cp monitoring/grafana-dashboard.json monitoring/grafana/dashboards/coderunner.json
    fi
}

# Function to check service health
check_service_health() {
    local service_name=$1
    local health_endpoint=$2
    local timeout=$3
    
    echo -e "${YELLOW}🏥 Checking $service_name health...${NC}"
    
    local count=0
    while [ $count -lt $timeout ]; do
        if curl -s "$health_endpoint" > /dev/null; then
            echo -e "${GREEN}✅ $service_name is healthy${NC}"
            return 0
        fi
        
        sleep 1
        count=$((count + 1))
        
        if [ $((count % 10)) -eq 0 ]; then
            echo -e "${YELLOW}⏳ Waiting for $service_name... ($count/${timeout}s)${NC}"
        fi
    done
    
    echo -e "${RED}❌ $service_name health check failed${NC}"
    return 1
}

# Function to display service URLs
show_service_urls() {
    echo -e "\n${GREEN}🌐 Service URLs:${NC}"
    echo "================="
    echo -e "${YELLOW}Prometheus:${NC}     http://localhost:9090"
    echo -e "${YELLOW}Grafana:${NC}        http://localhost:3001 (admin/admin123)"
    echo -e "${YELLOW}AlertManager:${NC}   http://localhost:9093"
    echo -e "${YELLOW}Node Exporter:${NC}  http://localhost:9100"
    echo -e "${YELLOW}CodeRunner API:${NC} http://localhost:3000"
    echo ""
    echo -e "${GREEN}📊 Health Endpoints:${NC}"
    echo "==================="
    echo -e "${YELLOW}API Health:${NC}     http://localhost:3000/health"
    echo -e "${YELLOW}API Metrics:${NC}    http://localhost:3000/api/metrics"
    echo -e "${YELLOW}Readiness:${NC}      http://localhost:3000/ready"
    echo -e "${YELLOW}Liveness:${NC}       http://localhost:3000/live"
}

# Function to setup environment variables
setup_environment() {
    echo -e "${YELLOW}🔧 Setting up environment variables...${NC}"
    
    # Create .env file if it doesn't exist
    if [ ! -f ".env" ]; then
        cat > .env << EOF
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=coderunner
DB_USER=coderunner
DB_PASSWORD=password

# Redis Configuration
REDIS_PASSWORD=redis123

# Monitoring Configuration
METRICS_SYSTEM_INTERVAL=10000
METRICS_APP_INTERVAL=5000
HEALTH_CHECK_INTERVAL=30000
HEALTH_ENABLE_PROBES=true

# Environment
NODE_ENV=development
EOF
        echo -e "${GREEN}✅ Created .env file with default configuration${NC}"
    else
        echo -e "${GREEN}✅ Using existing .env file${NC}"
    fi
}

# Function to start services
start_services() {
    echo -e "${YELLOW}🐳 Starting monitoring services...${NC}"
    
    # Pull latest images
    echo -e "${YELLOW}📥 Pulling Docker images...${NC}"
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" pull
    
    # Start services
    echo -e "${YELLOW}🚀 Starting containers...${NC}"
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" up -d
    
    echo -e "${GREEN}✅ Services started${NC}"
}

# Function to wait for services to be ready
wait_for_services() {
    echo -e "${YELLOW}⏳ Waiting for services to be ready...${NC}"
    
    # Wait for services to start
    sleep 5
    
    # Check service health
    check_service_health "Prometheus" "http://localhost:9090/-/healthy" 30 || true
    check_service_health "Grafana" "http://localhost:3001/api/health" 30 || true
    check_service_health "AlertManager" "http://localhost:9093/-/healthy" 30 || true
    check_service_health "Node Exporter" "http://localhost:9100/metrics" 20 || true
    
    echo -e "${GREEN}✅ Services are ready${NC}"
}

# Function to show logs
show_logs() {
    if [ "$1" = "--logs" ] || [ "$1" = "-l" ]; then
        echo -e "${YELLOW}📋 Showing service logs...${NC}"
        echo "Press Ctrl+C to stop following logs"
        sleep 2
        docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" logs -f
    fi
}

# Function to show status
show_status() {
    echo -e "\n${GREEN}📊 Service Status:${NC}"
    echo "================="
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" ps
}

# Main execution
main() {
    echo -e "${GREEN}Starting CodeRunner Monitoring Stack Setup...${NC}\n"
    
    # Pre-flight checks
    check_docker
    check_compose_file
    
    # Setup
    setup_environment
    setup_directories
    
    # Start services
    start_services
    wait_for_services
    
    # Show information
    show_status
    show_service_urls
    
    echo -e "\n${GREEN}🎉 Monitoring stack started successfully!${NC}"
    echo -e "${YELLOW}💡 Tips:${NC}"
    echo "  • Visit Grafana at http://localhost:3001 (admin/admin123)"
    echo "  • Import dashboard from monitoring/grafana-dashboard.json"
    echo "  • Check Prometheus targets at http://localhost:9090/targets"
    echo "  • View alerts at http://localhost:9093"
    echo ""
    echo -e "${YELLOW}🛠  Management commands:${NC}"
    echo "  • Stop: docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME down"
    echo "  • Logs: docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME logs -f"
    echo "  • Restart: docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME restart"
    
    # Show logs if requested
    show_logs "$1"
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "CodeRunner Monitoring Stack Startup Script"
        echo ""
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --logs, -l     Start services and follow logs"
        echo "  --stop         Stop all monitoring services"
        echo "  --restart      Restart all monitoring services"
        echo "  --status       Show service status"
        exit 0
        ;;
    --stop)
        echo -e "${YELLOW}🛑 Stopping monitoring services...${NC}"
        docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down
        echo -e "${GREEN}✅ Services stopped${NC}"
        exit 0
        ;;
    --restart)
        echo -e "${YELLOW}🔄 Restarting monitoring services...${NC}"
        docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" restart
        echo -e "${GREEN}✅ Services restarted${NC}"
        exit 0
        ;;
    --status)
        show_status
        exit 0
        ;;
esac

# Run main function
main "$1"