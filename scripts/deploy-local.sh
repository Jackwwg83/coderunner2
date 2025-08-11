#!/bin/bash

# CodeRunner v2.0 Local Deployment Script
# Simple deployment for 6-day MVP sprint

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

PROJECT_NAME="coderunner"

echo -e "${GREEN}🚀 CodeRunner v2.0 Local Deployment${NC}"
echo "=================================="

# Function to check Docker
check_docker() {
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker is not installed${NC}"
        exit 1
    fi
    
    if ! docker info > /dev/null 2>&1; then
        echo -e "${RED}❌ Docker is not running${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Docker is ready${NC}"
}

# Function to check Docker Compose
check_docker_compose() {
    if ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}❌ Docker Compose is not installed${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Docker Compose is ready${NC}"
}

# Function to setup environment
setup_environment() {
    echo -e "${YELLOW}⚙️  Setting up environment...${NC}"
    
    if [ ! -f ".env" ]; then
        cp .env.example .env
        echo -e "${GREEN}✅ Created .env from example${NC}"
    fi
    
    # Update database password in .env for Docker
    sed -i 's/DB_PASSWORD=your_password_here/DB_PASSWORD=coderunner123/' .env
    sed -i 's/DB_HOST=localhost/DB_HOST=postgres/' .env
    
    echo -e "${GREEN}✅ Environment configured${NC}"
}

# Function to build and start services
deploy_services() {
    echo -e "${YELLOW}🏗️  Building and starting services...${NC}"
    
    # Stop any existing containers
    docker-compose -p ${PROJECT_NAME} down -v 2>/dev/null || true
    
    # Build and start
    docker-compose -p ${PROJECT_NAME} up -d --build
    
    echo -e "${GREEN}✅ Services started${NC}"
}

# Function to wait for services
wait_for_services() {
    echo -e "${YELLOW}⏳ Waiting for services to be ready...${NC}"
    
    # Wait for PostgreSQL
    echo -e "${YELLOW}🗄️  Waiting for PostgreSQL...${NC}"
    timeout=60
    while [ $timeout -gt 0 ]; do
        if docker-compose -p ${PROJECT_NAME} exec postgres pg_isready -U coderunner -q; then
            echo -e "${GREEN}✅ PostgreSQL is ready${NC}"
            break
        fi
        timeout=$((timeout-1))
        sleep 1
    done
    
    if [ $timeout -eq 0 ]; then
        echo -e "${RED}❌ PostgreSQL failed to start${NC}"
        exit 1
    fi
    
    # Wait for API
    echo -e "${YELLOW}🔌 Waiting for API...${NC}"
    timeout=60
    while [ $timeout -gt 0 ]; do
        if curl -s http://localhost:8080/health > /dev/null; then
            echo -e "${GREEN}✅ API is ready${NC}"
            break
        fi
        timeout=$((timeout-1))
        sleep 1
    done
    
    if [ $timeout -eq 0 ]; then
        echo -e "${RED}❌ API failed to start${NC}"
        exit 1
    fi
    
    # Wait for Redis
    echo -e "${YELLOW}🔴 Waiting for Redis...${NC}"
    timeout=30
    while [ $timeout -gt 0 ]; do
        if docker-compose -p ${PROJECT_NAME} exec redis redis-cli ping 2>/dev/null | grep -q PONG; then
            echo -e "${GREEN}✅ Redis is ready${NC}"
            break
        fi
        timeout=$((timeout-1))
        sleep 1
    done
    
    echo -e "${GREEN}🎉 All services are ready!${NC}"
}

# Function to show service status
show_status() {
    echo -e "\n${GREEN}📊 Service Status:${NC}"
    echo "=================="
    docker-compose -p ${PROJECT_NAME} ps
    
    echo -e "\n${GREEN}🌐 Service URLs:${NC}"
    echo "================"
    echo -e "${YELLOW}API:${NC}           http://localhost:8080"
    echo -e "${YELLOW}Health Check:${NC}  http://localhost:8080/health"
    echo -e "${YELLOW}API Docs:${NC}      http://localhost:8080/api/"
    echo -e "${YELLOW}Database:${NC}      localhost:5432 (coderunner/coderunner123)"
    echo -e "${YELLOW}Redis:${NC}         localhost:6379 (password: redis123)"
    
    echo -e "\n${GREEN}🧪 Quick Tests:${NC}"
    echo "================"
    echo "curl http://localhost:8080/health"
    echo "curl http://localhost:8080/api/"
}

# Function to show logs
show_logs() {
    if [ "$1" = "--logs" ] || [ "$1" = "-l" ]; then
        echo -e "${YELLOW}📋 Following logs (Ctrl+C to stop)...${NC}"
        sleep 2
        docker-compose -p ${PROJECT_NAME} logs -f
    fi
}

# Main execution
main() {
    # Pre-flight checks
    check_docker
    check_docker_compose
    
    # Setup and deploy
    setup_environment
    deploy_services
    wait_for_services
    
    # Show results
    show_status
    
    echo -e "\n${GREEN}🎉 Deployment complete!${NC}"
    echo -e "${YELLOW}💡 Useful commands:${NC}"
    echo "  • Logs: docker-compose -p ${PROJECT_NAME} logs -f"
    echo "  • Stop: docker-compose -p ${PROJECT_NAME} down"
    echo "  • Restart: docker-compose -p ${PROJECT_NAME} restart"
    echo "  • Shell: docker-compose -p ${PROJECT_NAME} exec api sh"
    
    # Show logs if requested
    show_logs "$1"
}

# Handle arguments
case "${1:-}" in
    --help|-h)
        echo "CodeRunner v2.0 Local Deployment"
        echo ""
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show help"
        echo "  --logs, -l     Deploy and follow logs"
        echo "  --stop         Stop all services"
        echo "  --restart      Restart all services"
        echo "  --status       Show service status"
        exit 0
        ;;
    --stop)
        echo -e "${YELLOW}🛑 Stopping services...${NC}"
        docker-compose -p ${PROJECT_NAME} down
        echo -e "${GREEN}✅ Services stopped${NC}"
        exit 0
        ;;
    --restart)
        echo -e "${YELLOW}🔄 Restarting services...${NC}"
        docker-compose -p ${PROJECT_NAME} restart
        echo -e "${GREEN}✅ Services restarted${NC}"
        exit 0
        ;;
    --status)
        show_status
        exit 0
        ;;
esac

# Run main
main "$1"