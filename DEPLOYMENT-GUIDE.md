# CodeRunner v2.0 - Production Deployment Guide

🚀 **Day 6 Final Deployment** - Complete production setup guide for CodeRunner v2.0

## 📋 Quick Start Checklist

```bash
# 1. Pre-flight check
./scripts/prod-preflight.sh

# 2. Setup SSL certificates
./scripts/ssl-setup.sh yourdomain.com --letsencrypt

# 3. Configure environment
cp .env.prod.example .env.production
# Edit .env.production with your values

# 4. Deploy
./scripts/deploy-prod.sh
```

---

## 🏗️ Architecture Overview

```
Internet → Nginx (443/80) → CodeRunner API (8080) → PostgreSQL (5432)
                                                 → Redis (6379)
```

### Services:
- **Nginx**: Reverse proxy, SSL termination, static files
- **CodeRunner API**: Node.js application
- **PostgreSQL**: Primary database
- **Redis**: Caching and session storage

---

## 🔧 Environment Setup

### 1. Server Requirements

**Minimum:**
- 2 CPU cores
- 4GB RAM  
- 50GB disk space
- Ubuntu 20.04+ or similar

**Recommended:**
- 4 CPU cores
- 8GB RAM
- 100GB SSD
- Load balancer ready

### 2. Prerequisites Installation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install SSL tools (for Let's Encrypt)
sudo apt install -y certbot python3-certbot-nginx openssl

# Verify installations
docker --version
docker-compose --version
certbot --version
```

---

## 🔒 SSL Certificate Setup

### Option A: Let's Encrypt (Production)

```bash
# For production domains
./scripts/ssl-setup.sh yourdomain.com --letsencrypt
```

### Option B: Self-Signed (Development/Testing)

```bash
# For localhost/development
./scripts/ssl-setup.sh localhost --self-signed
```

**Certificate files will be created:**
- `ssl/coderunner.crt` - Certificate
- `ssl/coderunner.key` - Private key

---

## ⚙️ Environment Configuration

### 1. Create Production Environment File

```bash
# Copy template
cp .env.prod.example .env.production

# Edit with your values
nano .env.production
```

### 2. Critical Settings to Change

```bash
# 🔒 Database Security
DB_PASSWORD=YourStrongPassword123!@#

# 🔒 JWT Security  
JWT_SECRET=YourSuperSecretJWTKey32CharsMinimum!@#$%^&*

# 🔒 Redis Security
REDIS_PASSWORD=YourRedisPassword123!@#

# 🌐 CORS Configuration
CORS_ORIGIN=https://yourdomain.com

# 📧 Backup Encryption
BACKUP_ENCRYPTION_KEY=YourBackupEncryptionKey!@#
```

### 3. Security Validation

```bash
# Check for weak passwords
grep -E "CHANGE_THIS|password.*123|secret.*123" .env.production
# Should return no results

# Verify minimum lengths
source .env.production
echo "JWT Secret length: ${#JWT_SECRET} (minimum: 32)"
echo "DB Password length: ${#DB_PASSWORD} (minimum: 20)"
```

---

## 🚀 Deployment Process

### 1. Pre-flight Check

```bash
# Comprehensive validation
./scripts/prod-preflight.sh

# Expected output:
# ✅ Node.js compatible
# ✅ Docker available  
# ✅ Environment configured
# ✅ SSL certificates valid
# ✅ Application builds
# 🎉 Ready for deployment!
```

### 2. Deploy Application

```bash
# Full production deployment
./scripts/deploy-prod.sh

# Custom image tag (optional)
IMAGE_TAG=v1.0.1 ./scripts/deploy-prod.sh
```

### 3. Verify Deployment

```bash
# Check service status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Health check
curl https://yourdomain.com/health

# API test
curl https://yourdomain.com/api/
```

---

## 📊 Monitoring Setup

### 1. Enable Monitoring Stack

```bash
# Start monitoring services
./scripts/start-monitoring.sh

# Access dashboards:
# Grafana: http://yourdomain.com:3000
# Prometheus: http://yourdomain.com:9090
```

### 2. Key Metrics to Monitor

- **Application Health**: `/health` endpoint
- **Response Time**: API latency < 200ms
- **Error Rate**: < 1% error responses
- **Database**: Connection pool, query time
- **Memory Usage**: < 80% utilization
- **Disk Space**: < 80% full

---

## 🔄 Maintenance Operations

### Daily Operations

```bash
# View application logs
docker-compose -f docker-compose.prod.yml logs -f api

# Check resource usage
docker stats

# Database backup
docker-compose -f docker-compose.prod.yml --profile backup run backup
```

### Updates & Rollbacks

```bash
# Update to new version
IMAGE_TAG=v1.0.2 ./scripts/deploy-prod.sh

# Rollback to previous version
./scripts/deploy-prod.sh rollback

# Check deployment status
./scripts/deploy-prod.sh status
```

### Database Management

```bash
# Run migrations
docker-compose -f docker-compose.prod.yml exec api npm run migrate

# Database health check
docker-compose -f docker-compose.prod.yml exec api npm run db:health

# Manual backup
docker-compose -f docker-compose.prod.yml --profile backup run backup
```

---

## 🚨 Troubleshooting

### Common Issues

**1. Port Already in Use**
```bash
# Find process using port
sudo netstat -tulpn | grep :8080

# Stop conflicting service
sudo systemctl stop apache2  # if Apache is running
```

**2. SSL Certificate Issues**
```bash
# Regenerate self-signed certificate
./scripts/ssl-setup.sh yourdomain.com --self-signed

# Check certificate validity
./scripts/ssl-setup.sh --validate
```

**3. Database Connection Failed**
```bash
# Check database status
docker-compose -f docker-compose.prod.yml logs postgres

# Reset database password
docker-compose -f docker-compose.prod.yml down
# Update .env.production with new password
docker-compose -f docker-compose.prod.yml up -d postgres
```

**4. Application Won't Start**
```bash
# Check application logs
docker-compose -f docker-compose.prod.yml logs api

# Restart services
docker-compose -f docker-compose.prod.yml restart

# Full rebuild
docker-compose -f docker-compose.prod.yml down
docker rmi coderunner:latest
./scripts/deploy-prod.sh
```

### Health Check Failures

```bash
# Test health endpoint directly
curl -v http://localhost:8080/health

# Check if application is listening
docker-compose -f docker-compose.prod.yml exec api netstat -tulpn | grep 8080

# View detailed logs
docker-compose -f docker-compose.prod.yml logs --tail=50 api
```

---

## 🔐 Security Hardening

### 1. Firewall Configuration

```bash
# Enable UFW firewall
sudo ufw enable

# Allow SSH (change 22 if using different port)
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Block direct database access
sudo ufw deny 5432/tcp
sudo ufw deny 6379/tcp

# Check status
sudo ufw status verbose
```

### 2. Regular Security Updates

```bash
# System updates
sudo apt update && sudo apt upgrade -y

# Docker security scan
docker scan coderunner:latest

# NPM security audit  
npm audit fix
```

### 3. Log Monitoring

```bash
# Monitor auth failures
sudo grep "Failed password" /var/log/auth.log

# Monitor application errors
docker-compose -f docker-compose.prod.yml logs api | grep ERROR

# Monitor nginx access
docker-compose -f docker-compose.prod.yml logs nginx | grep -E "4[0-9]{2}|5[0-9]{2}"
```

---

## 📈 Performance Optimization

### 1. Database Optimization

```bash
# Database performance tuning
docker-compose -f docker-compose.prod.yml exec postgres psql -U coderunner -d coderunner -c "
SELECT schemaname,tablename,attname,n_distinct,correlation FROM pg_stats 
WHERE tablename IN ('users','projects') ORDER BY n_distinct DESC;
"

# Index usage analysis
docker-compose -f docker-compose.prod.yml exec postgres psql -U coderunner -d coderunner -c "
SELECT indexrelname, idx_scan, idx_tup_read, idx_tup_fetch 
FROM pg_stat_user_indexes ORDER BY idx_scan DESC;
"
```

### 2. Application Performance

```bash
# Monitor response times
curl -w "@curl-format.txt" -o /dev/null -s https://yourdomain.com/api/

# Check memory usage
docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"

# Enable application profiling
NODE_ENV=production NODE_OPTIONS="--prof" ./scripts/deploy-prod.sh
```

---

## 📞 Support & Documentation

### Log Locations

- **Application**: `docker-compose -f docker-compose.prod.yml logs api`
- **Database**: `docker-compose -f docker-compose.prod.yml logs postgres`
- **Nginx**: `docker-compose -f docker-compose.prod.yml logs nginx`
- **System**: `/var/log/syslog`

### Useful Commands

```bash
# Quick status check
./scripts/deploy-prod.sh status

# Resource usage
docker system df
docker system prune -f  # Clean unused resources

# Full system health
./scripts/prod-preflight.sh
curl https://yourdomain.com/health | jq .
```

### Emergency Contacts

- **System Admin**: [Your contact info]
- **Database Admin**: [Your contact info] 
- **DevOps Team**: [Your contact info]

---

## 🎯 Success Criteria

After successful deployment, you should see:

✅ **Application Health**: `https://yourdomain.com/health` returns 200  
✅ **API Access**: `https://yourdomain.com/api/` accessible  
✅ **SSL Valid**: No browser warnings  
✅ **Database Connected**: Health check shows DB status  
✅ **Monitoring Active**: Grafana dashboard showing metrics  
✅ **Backups Working**: Daily backups in `./backups/`  
✅ **Logs Clean**: No ERROR level messages in application logs

**🎉 Congratulations! CodeRunner v2.0 is now live in production!**

---

## 📚 Additional Resources

- [Docker Production Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Node.js Production Checklist](https://nodejs.org/en/docs/guides/simple-profiling/)
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)

*Generated for CodeRunner v2.0 - Day 6 Production Deployment*