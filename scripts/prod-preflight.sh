#!/bin/bash

# CodeRunner v2.0 - Production Preflight Check Script
# Comprehensive validation before production deployment

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

echo -e "${GREEN}🚀 CodeRunner v2.0 - Production Preflight Check${NC}"
echo "================================================="
echo "Checking production readiness..."
echo ""

# Function to log error
log_error() {
    echo -e "${RED}❌ ERROR: $1${NC}"
    ERRORS=$((ERRORS + 1))
}

# Function to log warning
log_warning() {
    echo -e "${YELLOW}⚠️  WARNING: $1${NC}"
    WARNINGS=$((WARNINGS + 1))
}

# Function to log success
log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Function to log info
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

echo -e "${BLUE}📋 1. ENVIRONMENT VALIDATION${NC}"
echo "=============================="

# Check Node.js version
echo -n "Node.js version: "
NODE_VERSION=$(node --version)
# Extract major version number (remove 'v' and get first part before '.')
NODE_MAJOR=$(echo $NODE_VERSION | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -ge 18 ]; then
    log_success "Node.js $NODE_VERSION (compatible)"
else
    log_error "Node.js version $NODE_VERSION is not supported. Requires Node.js 18+"
fi

# Check npm version
echo -n "npm version: "
NPM_VERSION=$(npm --version)
log_info "npm $NPM_VERSION"

# Check if Docker is available
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    log_success "Docker available: $DOCKER_VERSION"
else
    log_error "Docker is not installed or not accessible"
fi

# Check if Docker Compose is available
if command -v docker-compose &> /dev/null; then
    COMPOSE_VERSION=$(docker-compose --version)
    log_success "Docker Compose available: $COMPOSE_VERSION"
else
    log_error "Docker Compose is not installed or not accessible"
fi

echo ""
echo -e "${BLUE}📋 2. ENVIRONMENT FILE VALIDATION${NC}"
echo "=================================="

# Check .env.production exists
if [ -f ".env.production" ]; then
    log_success ".env.production file exists"
    
    # Check critical environment variables
    source .env.production 2>/dev/null || log_error "Failed to load .env.production"
    
    # Database configuration
    if [ -z "$DB_PASSWORD" ] || [ "$DB_PASSWORD" = "CHANGE_THIS_STRONG_PASSWORD_123!@#" ]; then
        log_error "Database password not set or using default value"
    else
        log_success "Database password configured"
    fi
    
    # JWT Secret
    if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "CHANGE_THIS_SUPER_SECRET_JWT_KEY_min_32_chars!@#$%^&*()1234567890" ]; then
        log_error "JWT secret not set or using default value"
    elif [ ${#JWT_SECRET} -lt 32 ]; then
        log_error "JWT secret is too short (minimum 32 characters required)"
    else
        log_success "JWT secret configured (${#JWT_SECRET} characters)"
    fi
    
    # Redis password
    if [ -z "$REDIS_PASSWORD" ] || [ "$REDIS_PASSWORD" = "CHANGE_THIS_REDIS_PASSWORD_123!@#" ]; then
        log_error "Redis password not set or using default value"
    else
        log_success "Redis password configured"
    fi
    
    # CORS Origin
    if [ -z "$CORS_ORIGIN" ] || [ "$CORS_ORIGIN" = "https://yourdomain.com" ]; then
        log_warning "CORS origin not configured for production domain"
    else
        log_success "CORS origin configured: $CORS_ORIGIN"
    fi
    
    # Node environment
    if [ "$NODE_ENV" = "production" ]; then
        log_success "NODE_ENV set to production"
    else
        log_error "NODE_ENV is not set to 'production'"
    fi
    
else
    log_error ".env.production file not found. Copy from .env.prod.example and configure"
fi

echo ""
echo -e "${BLUE}📋 3. SSL CERTIFICATE VALIDATION${NC}"
echo "================================="

# Check SSL certificates
if [ -f "ssl/coderunner.crt" ] && [ -f "ssl/coderunner.key" ]; then
    log_success "SSL certificates found"
    
    # Validate certificate
    if openssl x509 -in ssl/coderunner.crt -text -noout > /dev/null 2>&1; then
        log_success "SSL certificate is valid"
        
        # Check expiration
        EXPIRE_DATE=$(openssl x509 -in ssl/coderunner.crt -noout -enddate | cut -d= -f2)
        EXPIRE_TIMESTAMP=$(date -d "$EXPIRE_DATE" +%s)
        CURRENT_TIMESTAMP=$(date +%s)
        DAYS_UNTIL_EXPIRE=$(( ($EXPIRE_TIMESTAMP - $CURRENT_TIMESTAMP) / 86400 ))
        
        if [ $DAYS_UNTIL_EXPIRE -gt 30 ]; then
            log_success "SSL certificate valid for $DAYS_UNTIL_EXPIRE days"
        elif [ $DAYS_UNTIL_EXPIRE -gt 0 ]; then
            log_warning "SSL certificate expires in $DAYS_UNTIL_EXPIRE days"
        else
            log_error "SSL certificate has expired"
        fi
    else
        log_error "SSL certificate is invalid"
    fi
    
    # Validate private key
    if openssl rsa -in ssl/coderunner.key -check > /dev/null 2>&1; then
        log_success "SSL private key is valid"
    else
        log_error "SSL private key is invalid"
    fi
else
    log_warning "SSL certificates not found. Run './scripts/ssl-setup.sh' to generate certificates"
fi

echo ""
echo -e "${BLUE}📋 4. APPLICATION BUILD VALIDATION${NC}"
echo "==================================="

# Check if application builds successfully
if [ -f "package.json" ]; then
    log_success "package.json found"
    
    # Check if dependencies are installed
    if [ -d "node_modules" ] && [ -f "package-lock.json" ]; then
        log_success "Dependencies are installed"
    else
        log_warning "Dependencies not installed. Run 'npm ci' to install"
    fi
    
    # Check TypeScript compilation
    if npm run build > /dev/null 2>&1; then
        log_success "Application builds successfully"
    else
        log_error "Application build failed. Run 'npm run build' to see errors"
    fi
    
    # Check if dist directory exists
    if [ -d "dist" ]; then
        log_success "Build output directory exists"
    else
        log_error "Build output directory not found"
    fi
else
    log_error "package.json not found"
fi

echo ""
echo -e "${BLUE}📋 5. DATABASE MIGRATION VALIDATION${NC}"
echo "===================================="

# Check migration files
if [ -d "src/migrations" ]; then
    MIGRATION_COUNT=$(find src/migrations -name "*.sql" | wc -l)
    if [ $MIGRATION_COUNT -gt 0 ]; then
        log_success "Found $MIGRATION_COUNT database migration files"
    else
        log_warning "No database migration files found"
    fi
else
    log_warning "Migration directory not found"
fi

echo ""
echo -e "${BLUE}📋 6. DOCKER CONFIGURATION VALIDATION${NC}"
echo "======================================"

# Check Dockerfile
if [ -f "Dockerfile" ]; then
    log_success "Dockerfile exists"
    
    # Check for multi-stage build
    if grep -q "FROM.*AS.*" Dockerfile; then
        log_success "Multi-stage Docker build configured"
    else
        log_warning "Single-stage Docker build (consider multi-stage for optimization)"
    fi
else
    log_error "Dockerfile not found"
fi

# Check docker-compose.prod.yml
if [ -f "docker-compose.prod.yml" ]; then
    log_success "Production Docker Compose file exists"
    
    # Check for health checks
    if grep -q "healthcheck:" docker-compose.prod.yml; then
        log_success "Health checks configured in Docker Compose"
    else
        log_warning "No health checks found in Docker Compose"
    fi
    
    # Check for resource limits
    if grep -q "deploy:" docker-compose.prod.yml && grep -q "resources:" docker-compose.prod.yml; then
        log_success "Resource limits configured"
    else
        log_warning "No resource limits configured"
    fi
else
    log_error "docker-compose.prod.yml not found"
fi

# Check .dockerignore
if [ -f ".dockerignore" ]; then
    log_success ".dockerignore file exists"
else
    log_warning ".dockerignore file not found (Docker builds may be slower)"
fi

echo ""
echo -e "${BLUE}📋 7. SECURITY CONFIGURATION VALIDATION${NC}"
echo "======================================="

# Check nginx configuration
if [ -f "nginx.conf" ]; then
    log_success "Nginx configuration exists"
    
    # Check for security headers
    if grep -q "X-Frame-Options\|X-Content-Type-Options\|X-XSS-Protection" nginx.conf; then
        log_success "Security headers configured in Nginx"
    else
        log_warning "Security headers not found in Nginx configuration"
    fi
    
    # Check for rate limiting
    if grep -q "limit_req" nginx.conf; then
        log_success "Rate limiting configured in Nginx"
    else
        log_warning "Rate limiting not configured in Nginx"
    fi
else
    log_warning "Nginx configuration not found"
fi

echo ""
echo -e "${BLUE}📋 8. MONITORING AND BACKUP VALIDATION${NC}"
echo "======================================"

# Check monitoring setup
if [ -d "monitoring" ]; then
    log_success "Monitoring configuration directory exists"
    
    if [ -f "monitoring/prometheus.yml" ]; then
        log_success "Prometheus configuration found"
    else
        log_warning "Prometheus configuration not found"
    fi
else
    log_warning "Monitoring configuration not found"
fi

# Check backup script
if [ -f "scripts/backup.sh" ]; then
    log_success "Database backup script exists"
    if [ -x "scripts/backup.sh" ]; then
        log_success "Backup script is executable"
    else
        log_warning "Backup script is not executable"
    fi
else
    log_warning "Database backup script not found"
fi

echo ""
echo -e "${BLUE}📋 9. DEPLOYMENT SCRIPT VALIDATION${NC}"
echo "=================================="

# Check deployment script
if [ -f "scripts/deploy-prod.sh" ]; then
    log_success "Production deployment script exists"
    if [ -x "scripts/deploy-prod.sh" ]; then
        log_success "Deployment script is executable"
    else
        log_error "Deployment script is not executable"
    fi
else
    log_error "Production deployment script not found"
fi

echo ""
echo -e "${BLUE}📋 10. NETWORK AND PORT VALIDATION${NC}"
echo "=================================="

# Check if required ports are available
check_port() {
    local port=$1
    local service=$2
    
    if netstat -tuln 2>/dev/null | grep -q ":$port "; then
        log_warning "Port $port ($service) is already in use"
    else
        log_success "Port $port ($service) is available"
    fi
}

check_port 80 "HTTP"
check_port 443 "HTTPS"
check_port 8080 "API"
check_port 5432 "PostgreSQL"
check_port 6379 "Redis"

echo ""
echo "================================================="
echo -e "${BLUE}📊 PREFLIGHT CHECK SUMMARY${NC}"
echo "================================================="

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}🎉 PERFECT! No issues found.${NC}"
    echo -e "${GREEN}✅ Ready for production deployment!${NC}"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "1. Run: ./scripts/deploy-prod.sh"
    echo "2. Monitor deployment logs"
    echo "3. Run smoke tests"
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  ${WARNINGS} warnings found, but no blocking errors.${NC}"
    echo -e "${GREEN}✅ You can proceed with deployment, but consider addressing warnings.${NC}"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "1. Address warnings (recommended)"
    echo "2. Run: ./scripts/deploy-prod.sh"
else
    echo -e "${RED}❌ ${ERRORS} errors found that must be fixed before deployment.${NC}"
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}⚠️  Also found ${WARNINGS} warnings.${NC}"
    fi
    echo -e "${RED}🚫 DO NOT deploy until all errors are resolved!${NC}"
    echo ""
    echo -e "${BLUE}Required actions:${NC}"
    echo "1. Fix all errors listed above"
    echo "2. Re-run this preflight check"
    echo "3. Deploy when all checks pass"
fi

echo ""
echo "For help with any issues, check the documentation or deployment guide."

# Exit with appropriate code
if [ $ERRORS -gt 0 ]; then
    exit 1
else
    exit 0
fi