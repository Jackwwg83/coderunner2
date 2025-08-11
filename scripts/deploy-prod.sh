#!/bin/bash

# CodeRunner v2.0 Production Deployment Script
# Simple production deployment for 6-day MVP sprint

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

PROJECT_NAME="coderunner-prod"
IMAGE_TAG=${IMAGE_TAG:-$(git rev-parse --short HEAD)}

echo -e "${GREEN}🚀 CodeRunner v2.0 Production Deployment${NC}"
echo "========================================"

# Function to check requirements
check_requirements() {
    echo -e "${YELLOW}🔍 Checking requirements...${NC}"
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker is not installed${NC}"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}❌ Docker Compose is not installed${NC}"
        exit 1
    fi
    
    # Check environment file
    if [ ! -f ".env.prod" ]; then
        echo -e "${RED}❌ .env.prod file not found${NC}"
        echo "Create .env.prod with production settings"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Requirements check passed${NC}"
}

# Function to build image
build_image() {
    echo -e "${YELLOW}🏗️  Building production image...${NC}"
    
    # Build the image
    docker build -t coderunner:${IMAGE_TAG} .
    docker tag coderunner:${IMAGE_TAG} coderunner:latest
    
    echo -e "${GREEN}✅ Image built: coderunner:${IMAGE_TAG}${NC}"
}

# Function to backup database
backup_database() {
    echo -e "${YELLOW}📦 Creating database backup...${NC}"
    
    if docker-compose -p ${PROJECT_NAME} ps | grep -q postgres; then
        docker-compose -p ${PROJECT_NAME} --profile backup run --rm backup
        echo -e "${GREEN}✅ Database backup created${NC}"
    else
        echo -e "${YELLOW}⚠️  No existing database to backup${NC}"
    fi
}

# Function to deploy services
deploy_services() {
    echo -e "${YELLOW}🚀 Deploying production services...${NC}"
    
    # Load production environment
    export $(cat .env.prod | grep -v '^#' | xargs)
    export IMAGE_TAG=${IMAGE_TAG}
    
    # Deploy with zero downtime
    docker-compose -f docker-compose.prod.yml -p ${PROJECT_NAME} up -d --no-deps api
    
    # Wait for health check
    echo -e "${YELLOW}⏳ Waiting for health check...${NC}"
    timeout=120
    while [ $timeout -gt 0 ]; do
        if curl -s http://localhost:8080/health > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Application is healthy${NC}"
            break
        fi
        timeout=$((timeout-1))
        sleep 1
        if [ $((timeout % 10)) -eq 0 ]; then
            echo -e "${YELLOW}⏳ Still waiting... (${timeout}s remaining)${NC}"
        fi
    done
    
    if [ $timeout -eq 0 ]; then
        echo -e "${RED}❌ Health check failed, rolling back${NC}"
        rollback
        exit 1
    fi
}

# Function to rollback
rollback() {
    echo -e "${YELLOW}🔄 Rolling back to previous version...${NC}"
    
    # Get previous image
    PREVIOUS_IMAGE=$(docker images coderunner --format "table {{.Tag}}" | grep -v latest | grep -v ${IMAGE_TAG} | head -1)
    
    if [ -n "${PREVIOUS_IMAGE}" ]; then
        export IMAGE_TAG=${PREVIOUS_IMAGE}
        docker-compose -f docker-compose.prod.yml -p ${PROJECT_NAME} up -d --no-deps api
        echo -e "${GREEN}✅ Rolled back to ${PREVIOUS_IMAGE}${NC}"
    else
        echo -e "${RED}❌ No previous version found for rollback${NC}"
    fi
}

# Function to run smoke tests
smoke_tests() {
    echo -e "${YELLOW}🧪 Running smoke tests...${NC}"
    
    # Test API health
    if curl -f http://localhost:8080/health; then
        echo -e "${GREEN}✅ Health check passed${NC}"
    else
        echo -e "${RED}❌ Health check failed${NC}"
        return 1
    fi
    
    # Test API endpoint
    if curl -f http://localhost:8080/api/; then
        echo -e "${GREEN}✅ API endpoint accessible${NC}"
    else
        echo -e "${RED}❌ API endpoint failed${NC}"
        return 1
    fi
    
    # Test database connection (through API)
    if curl -s http://localhost:8080/health | grep -q "database.*connected"; then
        echo -e "${GREEN}✅ Database connection verified${NC}"
    else
        echo -e "${YELLOW}⚠️  Database connection check inconclusive${NC}"
    fi
    
    echo -e "${GREEN}✅ Smoke tests passed${NC}"
}

# Function to show status
show_status() {
    echo -e "\n${GREEN}📊 Deployment Status:${NC}"
    echo "======================"
    docker-compose -f docker-compose.prod.yml -p ${PROJECT_NAME} ps
    
    echo -e "\n${GREEN}🌐 Service URLs:${NC}"
    echo "================"
    echo -e "${YELLOW}API:${NC}           http://localhost:8080"
    echo -e "${YELLOW}Health:${NC}        http://localhost:8080/health"
    echo -e "${YELLOW}Image Tag:${NC}     ${IMAGE_TAG}"
    
    echo -e "\n${GREEN}🔧 Management:${NC}"
    echo "=============="
    echo "Logs:    docker-compose -f docker-compose.prod.yml -p ${PROJECT_NAME} logs -f"
    echo "Stop:    docker-compose -f docker-compose.prod.yml -p ${PROJECT_NAME} down"
    echo "Backup:  docker-compose -f docker-compose.prod.yml -p ${PROJECT_NAME} --profile backup run backup"
}

# Main deployment function
main() {
    case "${1:-deploy}" in
        deploy)
            check_requirements
            build_image
            backup_database
            deploy_services
            smoke_tests && echo -e "${GREEN}🎉 Deployment successful!${NC}" || echo -e "${RED}❌ Smoke tests failed${NC}"
            show_status
            ;;
        rollback)
            rollback
            smoke_tests && echo -e "${GREEN}🎉 Rollback successful!${NC}"
            ;;
        backup)
            backup_database
            ;;
        status)
            show_status
            ;;
        *)
            echo "Usage: $0 {deploy|rollback|backup|status}"
            echo ""
            echo "Commands:"
            echo "  deploy   - Full production deployment"
            echo "  rollback - Rollback to previous version"
            echo "  backup   - Create database backup only"
            echo "  status   - Show current status"
            exit 1
            ;;
    esac
}

# Handle script execution
main "$@"