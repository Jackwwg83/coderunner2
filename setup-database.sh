#!/bin/bash

# CodeRunner v2.0 Database Setup Script
# Quick PostgreSQL setup for 6-day MVP sprint

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

DB_NAME="coderunner"
DB_USER="coderunner"
DB_PASSWORD="coderunner123"

echo -e "${GREEN}🗄️  Setting up PostgreSQL for CodeRunner v2.0${NC}"

# Check if PostgreSQL is running
if ! pgrep -x postgres > /dev/null; then
    echo -e "${RED}❌ PostgreSQL is not running${NC}"
    sudo systemctl start postgresql
    sleep 2
fi

echo -e "${GREEN}✅ PostgreSQL is running${NC}"

# Create database and user
echo -e "${YELLOW}📊 Creating database and user...${NC}"

sudo -u postgres psql << EOF
-- Drop if exists (for fresh start)
DROP DATABASE IF EXISTS ${DB_NAME};
DROP USER IF EXISTS ${DB_USER};

-- Create user
CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';

-- Create database
CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
ALTER USER ${DB_USER} CREATEDB;

EOF

echo -e "${GREEN}✅ Database and user created${NC}"

# Test connection
echo -e "${YELLOW}🔌 Testing connection...${NC}"
if PGPASSWORD="${DB_PASSWORD}" psql -h localhost -U ${DB_USER} -d ${DB_NAME} -c "SELECT version();" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Database connection successful${NC}"
else
    echo -e "${RED}❌ Database connection failed${NC}"
    exit 1
fi

# Update .env file
echo -e "${YELLOW}⚙️  Updating .env file...${NC}"
cp .env .env.backup

# Update database configuration in .env
sed -i "s/DB_PASSWORD=.*/DB_PASSWORD=${DB_PASSWORD}/" .env
sed -i "s/DB_USER=.*/DB_USER=${DB_USER}/" .env
sed -i "s/DB_NAME=.*/DB_NAME=${DB_NAME}/" .env

echo -e "${GREEN}✅ Environment updated${NC}"

# Run migrations if they exist
echo -e "${YELLOW}🔧 Running database migrations...${NC}"
if [ -d "src/migrations" ]; then
    npm run migrate 2>/dev/null || echo "No migration script found - will create tables manually"
fi

echo -e "${GREEN}🎉 Database setup complete!${NC}"
echo ""
echo -e "${YELLOW}📋 Connection Details:${NC}"
echo "Host: localhost"
echo "Port: 5432"
echo "Database: ${DB_NAME}"
echo "User: ${DB_USER}"
echo "Password: ${DB_PASSWORD}"
echo ""
echo -e "${YELLOW}🧪 Test connection:${NC}"
echo "PGPASSWORD=${DB_PASSWORD} psql -h localhost -U ${DB_USER} -d ${DB_NAME}"