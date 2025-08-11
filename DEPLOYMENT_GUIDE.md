# CodeRunner v2.0 Deployment Guide

**6-Day MVP Sprint Deployment Strategy**

## Quick Start (Day 1-2)

### 1. Database Setup (IMMEDIATE)
```bash
# Setup PostgreSQL database
./setup-database.sh

# Test connection
env PGPASSWORD=coderunner123 psql -h localhost -U coderunner -d coderunner -c "SELECT version();"
```

### 2. Local Development Deployment
```bash
# Deploy locally with Docker
./scripts/deploy-local.sh

# Or deploy with logs
./scripts/deploy-local.sh --logs
```

**URLs after local deployment:**
- API: http://localhost:8080
- Health: http://localhost:8080/health
- Database: localhost:5432 (coderunner/coderunner123)

## Full 6-Day Timeline

### **Day 1-2: Foundation** ✅
- [x] PostgreSQL database setup
- [x] Docker containerization
- [x] Local deployment scripts
- [x] Environment configuration
- [x] Health checks

**Commands:**
```bash
./setup-database.sh           # Setup database
./scripts/deploy-local.sh     # Local deployment
```

### **Day 3: API Deployment**
- [ ] Production Docker build
- [ ] Basic security hardening
- [ ] SSL/HTTPS configuration (optional)
- [ ] Environment secrets management

**Commands:**
```bash
# Create production environment
cp .env.prod.example .env.prod
# Edit .env.prod with production values

# Deploy to production
./scripts/deploy-prod.sh deploy
```

### **Day 4: Features & Integration**
- [ ] OAuth environment setup
- [ ] API documentation deployment
- [ ] Integration environment
- [ ] Frontend deployment (if separate)

### **Day 5: Staging Environment**
- [ ] Staging deployment validation
- [ ] End-to-end testing
- [ ] Performance baseline
- [ ] Backup strategy testing

### **Day 6: Production Launch**
- [ ] Production deployment
- [ ] Monitoring setup
- [ ] Final smoke tests
- [ ] Go-live checklist

## Deployment Options

### Option 1: Docker Compose (Recommended for MVP)
**Pros:** Simple, fast setup, all-in-one
**Cons:** Single server limitation

```bash
# Development
./scripts/deploy-local.sh

# Production
./scripts/deploy-prod.sh deploy
```

### Option 2: Cloud Provider
**Pros:** Scalable, managed services
**Cons:** More complex, higher cost

Choose based on requirements:
- **DigitalOcean App Platform**: Easiest
- **AWS ECS/Fargate**: Most features
- **Heroku**: Fastest deployment
- **Railway/Render**: Developer-friendly

### Option 3: Manual Server Setup
**Pros:** Full control
**Cons:** Most time-consuming

## Production Checklist

### Security ✅
- [x] Environment variables secured
- [x] Database credentials changed
- [x] JWT secret generated
- [ ] HTTPS/SSL configured
- [ ] Rate limiting enabled
- [ ] CORS properly configured

### Performance
- [ ] Database indexing
- [ ] Redis caching enabled
- [ ] Log rotation configured
- [ ] Resource limits set
- [ ] Health checks tuned

### Monitoring
- [ ] Application logs
- [ ] Error tracking
- [ ] Performance metrics
- [ ] Database monitoring
- [ ] Alerts configured

### Backup & Recovery
- [x] Automated backups
- [ ] Backup restoration tested
- [ ] Rollback procedure verified
- [ ] Data retention policy

## Commands Reference

### Local Development
```bash
# Start services
./scripts/deploy-local.sh

# View logs
docker-compose -p coderunner logs -f

# Stop services
./scripts/deploy-local.sh --stop

# Service status
./scripts/deploy-local.sh --status
```

### Production
```bash
# Deploy
./scripts/deploy-prod.sh deploy

# Rollback
./scripts/deploy-prod.sh rollback

# Backup
./scripts/deploy-prod.sh backup

# Status
./scripts/deploy-prod.sh status
```

### Database Management
```bash
# Create backup
docker-compose -p coderunner-prod --profile backup run backup

# Connect to database
env PGPASSWORD=coderunner123 psql -h localhost -U coderunner -d coderunner

# View logs
docker-compose -p coderunner-prod logs postgres
```

### Monitoring
```bash
# Start monitoring stack
./scripts/start-monitoring.sh

# Access services
# Prometheus: http://localhost:9090
# Grafana: http://localhost:3001 (admin/admin123)
# AlertManager: http://localhost:9093
```

## Troubleshooting

### Common Issues

#### Database Connection Failed
```bash
# Check database status
docker-compose -p coderunner ps postgres

# Check logs
docker-compose -p coderunner logs postgres

# Restart database
docker-compose -p coderunner restart postgres
```

#### Application Won't Start
```bash
# Check logs
docker-compose -p coderunner logs api

# Check environment
docker-compose -p coderunner exec api env | grep DB_

# Test database connection
docker-compose -p coderunner exec api npm run migrate
```

#### Port Conflicts
```bash
# Check port usage
lsof -i :8080
netstat -tulpn | grep 8080

# Kill conflicting process
sudo fuser -k 8080/tcp
```

### Emergency Procedures

#### Rollback Deployment
```bash
# Automatic rollback
./scripts/deploy-prod.sh rollback

# Manual rollback
docker-compose -f docker-compose.prod.yml -p coderunner-prod down
# Update IMAGE_TAG to previous version
docker-compose -f docker-compose.prod.yml -p coderunner-prod up -d
```

#### Database Recovery
```bash
# Restore from backup
# Find backup file
ls -la backups/

# Restore database
env PGPASSWORD=coderunner123 psql -h localhost -U coderunner -d coderunner < backups/coderunner_YYYYMMDD_HHMMSS.sql
```

## Performance Targets (MVP)

- **Response Time**: < 200ms for API calls
- **Uptime**: > 99% during business hours
- **Database**: < 100ms query response
- **Memory**: < 512MB per container
- **Startup**: < 30 seconds

## Next Steps After MVP

1. **CI/CD Pipeline**: GitHub Actions automation
2. **Monitoring**: Comprehensive observability
3. **Scaling**: Horizontal scaling strategies
4. **Security**: Security audits and hardening
5. **Performance**: Optimization and caching

## Support

For deployment issues:
1. Check logs: `docker-compose logs -f`
2. Verify environment: Check `.env` files
3. Test connectivity: Use health endpoints
4. Escalate: Contact development team

---

**Remember**: This is a 6-day MVP deployment. Focus on getting it working quickly, then iterate and improve.