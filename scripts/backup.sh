#!/bin/bash

# CodeRunner v2.0 Database Backup Script
# Simple backup for 6-day MVP sprint

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

BACKUP_DIR="/backups"
DB_HOST=${DB_HOST:-postgres}
DB_NAME=${DB_NAME:-coderunner}
DB_USER=${DB_USER:-coderunner}
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

mkdir -p ${BACKUP_DIR}

echo -e "${GREEN}📦 Creating database backup${NC}"

# Create SQL dump
pg_dump -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} \
  --no-password --verbose --clean --no-owner --no-privileges \
  > ${BACKUP_DIR}/coderunner_${TIMESTAMP}.sql

# Compress backup
gzip ${BACKUP_DIR}/coderunner_${TIMESTAMP}.sql

echo -e "${GREEN}✅ Backup created: coderunner_${TIMESTAMP}.sql.gz${NC}"

# Clean old backups (keep last 7 days)
find ${BACKUP_DIR} -name "coderunner_*.sql.gz" -mtime +7 -delete

echo -e "${YELLOW}📋 Available backups:${NC}"
ls -lh ${BACKUP_DIR}/coderunner_*.sql.gz 2>/dev/null || echo "No backups found"