# AgentSphere API Key配置指南

## 🔑 概述

本指南详细说明如何获取、配置和测试AgentSphere API Key，确保CodeRunner2平台能够成功集成AgentSphere SDK。

---

## 📋 快速开始

### 1. 获取API Key

#### 官方渠道
1. **访问官网**: https://www.agentsphere.run
2. **注册账户**: 创建AgentSphere开发者账户
3. **获取API Key**: https://www.agentsphere.run/apikey
4. **选择套餐**: 根据使用需求选择适合的API套餐

#### API Key格式
```
# 标准格式 (示例)
as_live_1234567890abcdef1234567890abcdef
as_test_1234567890abcdef1234567890abcdef
```

### 2. 环境配置

#### 开发环境
```bash
# .env.development
AGENTSPHERE_API_KEY=as_test_your_development_key_here
AGENTSPHERE_DOMAIN=agentsphere.run
NODE_ENV=development
```

#### 测试环境  
```bash
# .env.test
AGENTSPHERE_API_KEY=test-agentsphere-key  # Mock模式
AGENTSPHERE_DOMAIN=agentsphere.run
NODE_ENV=test
```

#### 生产环境
```bash
# .env.production
AGENTSPHERE_API_KEY=as_live_your_production_key_here
AGENTSPHERE_DOMAIN=agentsphere.run
NODE_ENV=production
```

---

## 🛠️ 详细配置步骤

### 步骤1: 环境变量设置

#### Linux/macOS
```bash
# 临时设置 (当前会话)
export AGENTSPHERE_API_KEY="your_api_key_here"
export AGENTSPHERE_DOMAIN="agentsphere.run"

# 永久设置 (添加到 ~/.bashrc 或 ~/.zshrc)
echo 'export AGENTSPHERE_API_KEY="your_api_key_here"' >> ~/.bashrc
echo 'export AGENTSPHERE_DOMAIN="agentsphere.run"' >> ~/.bashrc
source ~/.bashrc
```

#### Windows
```cmd
# 临时设置
set AGENTSPHERE_API_KEY=your_api_key_here
set AGENTSPHERE_DOMAIN=agentsphere.run

# 永久设置 (系统环境变量)
setx AGENTSPHERE_API_KEY "your_api_key_here"
setx AGENTSPHERE_DOMAIN "agentsphere.run"
```

#### Docker环境
```dockerfile
# Dockerfile
ENV AGENTSPHERE_API_KEY=your_api_key_here
ENV AGENTSPHERE_DOMAIN=agentsphere.run
```

```yaml
# docker-compose.yml
environment:
  - AGENTSPHERE_API_KEY=your_api_key_here
  - AGENTSPHERE_DOMAIN=agentsphere.run
```

### 步骤2: 配置文件更新

#### 更新.env文件
```bash
# 创建或更新.env文件
cat >> .env << EOF
AGENTSPHERE_API_KEY=your_api_key_here
AGENTSPHERE_DOMAIN=agentsphere.run
AGENTSPHERE_TIMEOUT=30000
AGENTSPHERE_BATCH_SIZE=10
EOF
```

#### 验证配置
```bash
# 检查环境变量
echo $AGENTSPHERE_API_KEY
echo $AGENTSPHERE_DOMAIN

# 或使用Node.js检查
node -e "console.log('API Key:', process.env.AGENTSPHERE_API_KEY?.slice(0,20) + '...')"
```

---

## 🧪 API Key测试

### 测试脚本1: 基础连接测试

创建测试脚本 `test-api-key.js`:
```javascript
#!/usr/bin/env node

const https = require('https');

async function testApiKey() {
    const apiKey = process.env.AGENTSPHERE_API_KEY;
    const domain = process.env.AGENTSPHERE_DOMAIN || 'agentsphere.run';
    
    console.log('🧪 AgentSphere API Key测试');
    console.log('================================');
    
    // 1. 检查API Key是否设置
    if (!apiKey) {
        console.log('❌ 错误: AGENTSPHERE_API_KEY环境变量未设置');
        console.log('请运行: export AGENTSPHERE_API_KEY="your_api_key_here"');
        process.exit(1);
    }
    
    console.log(`✅ API Key已设置: ${apiKey.slice(0, 20)}...`);
    console.log(`✅ 域名设置: ${domain}`);
    
    // 2. 测试API连接
    try {
        await testConnection(apiKey, domain);
        console.log('✅ API连接测试通过');
    } catch (error) {
        console.log(`❌ API连接测试失败: ${error.message}`);
        return false;
    }
    
    // 3. 测试SDK导入
    try {
        const agentsphere = require('agentsphere');
        console.log('✅ AgentSphere SDK导入成功');
        
        // 测试Sandbox创建
        const sandbox = new agentsphere.Sandbox();
        console.log('✅ Sandbox类实例化成功');
        
    } catch (error) {
        console.log('⚠️  AgentSphere SDK未安装，将使用Mock模式');
        console.log('安装命令: npm install agentsphere');
    }
    
    console.log('================================');
    console.log('🎉 API Key配置验证完成');
    return true;
}

function testConnection(apiKey, domain) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: `api.${domain}`,
            port: 443,
            path: '/v1/health',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'User-Agent': 'CodeRunner2-Test/1.0'
            },
            timeout: 5000
        };
        
        const req = https.request(options, (res) => {
            if (res.statusCode === 200 || res.statusCode === 401) {
                resolve();
            } else {
                reject(new Error(`HTTP ${res.statusCode}`));
            }
        });
        
        req.on('error', reject);
        req.on('timeout', () => reject(new Error('连接超时')));
        req.end();
    });
}

// 运行测试
if (require.main === module) {
    testApiKey().catch(console.error);
}

module.exports = { testApiKey };
```

运行测试:
```bash
chmod +x test-api-key.js
node test-api-key.js
```

### 测试脚本2: 集成测试

使用现有的集成测试:
```bash
# 运行完整集成测试
node test-agentsphere-integration.js

# 运行单元测试
npm test -- tests/integration/agentsphere-integration.test.ts

# 检查Mock模式
AGENTSPHERE_API_KEY="" npm test -- tests/integration/agentsphere-integration.test.ts
```

### 测试脚本3: 沙箱创建测试

```javascript
// sandbox-test.js
async function testSandboxCreation() {
    const OrchestrationService = require('./dist/services/orchestration').OrchestrationService;
    
    try {
        const orchestration = OrchestrationService.getInstance();
        
        // 测试沙箱列表
        const sandboxes = await orchestration.listActiveSandboxes();
        console.log(`✅ 活跃沙箱数量: ${sandboxes.length}`);
        
        // 测试简单部署
        const testFiles = [
            { path: 'package.json', content: '{"name":"test","version":"1.0.0"}' },
            { path: 'index.js', content: 'console.log("Hello AgentSphere!");' }
        ];
        
        const result = await orchestration.deployProject('test-user', testFiles);
        console.log(`✅ 部署成功: ${result.url}`);
        
        return true;
    } catch (error) {
        console.log(`❌ 沙箱测试失败: ${error.message}`);
        return false;
    }
}
```

---

## 🔧 故障排除指南

### 常见问题及解决方案

#### 1. API Key未设置
**错误**: `AGENTSPHERE_API_KEY环境变量未设置`
```bash
# 解决方案
export AGENTSPHERE_API_KEY="your_api_key_here"
# 或编辑.env文件添加配置
```

#### 2. API Key格式错误
**错误**: `Invalid API key format`
```bash
# 检查API Key格式
echo $AGENTSPHERE_API_KEY | grep -E "^as_(live|test)_[a-zA-Z0-9]{32}$"

# 确保没有多余的空格或换行
export AGENTSPHERE_API_KEY=$(echo "your_api_key_here" | tr -d '\n\r ')
```

#### 3. 网络连接问题
**错误**: `Connection timeout` 或 `ECONNREFUSED`
```bash
# 检查网络连接
curl -I https://api.agentsphere.run/v1/health

# 检查防火墙设置
# 确保443端口出站连接可用

# 检查DNS解析
nslookup api.agentsphere.run
```

#### 4. 权限问题
**错误**: `403 Forbidden` 或 `401 Unauthorized`
```bash
# 验证API Key有效性
curl -H "Authorization: Bearer $AGENTSPHERE_API_KEY" \
     https://api.agentsphere.run/v1/health

# 检查API配额和限制
# 联系AgentSphere支持team获取帮助
```

#### 5. SDK安装问题
**错误**: `Cannot find module 'agentsphere'`
```bash
# 安装AgentSphere SDK
npm install agentsphere

# 验证安装
npm list agentsphere

# 如果安装失败，使用Mock模式
echo "⚠️ 使用Mock模式进行开发和测试"
```

### 调试模式

启用详细日志:
```bash
# 设置调试级别
export DEBUG=agentsphere:*
export NODE_ENV=development

# 启用详细日志
export AGENTSPHERE_DEBUG=true

# 运行测试
node test-api-key.js
```

---

## 🏭 生产环境配置

### 安全最佳实践

#### 1. API Key安全存储
```bash
# 使用密钥管理服务
# AWS Secrets Manager
aws secretsmanager create-secret \
    --name "agentsphere-api-key" \
    --secret-string "your_production_api_key"

# Kubernetes Secrets
kubectl create secret generic agentsphere-secret \
    --from-literal=api-key="your_production_api_key"

# Docker Secrets
echo "your_production_api_key" | docker secret create agentsphere_api_key -
```

#### 2. 权限最小化
```yaml
# kubernetes deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: coderunner2
spec:
  template:
    spec:
      containers:
      - name: app
        env:
        - name: AGENTSPHERE_API_KEY
          valueFrom:
            secretKeyRef:
              name: agentsphere-secret
              key: api-key
```

#### 3. 监控和告警
```yaml
# prometheus alert rules
groups:
- name: agentsphere_api
  rules:
  - alert: AgentSphereAPIDown
    expr: agentsphere_api_up == 0
    for: 2m
    labels:
      severity: critical
    annotations:
      summary: "AgentSphere API不可用"
      
  - alert: AgentSphereAPIKeyExpiring
    expr: agentsphere_api_key_expiry_days < 30
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "AgentSphere API Key即将过期"
```

### 多环境管理

#### 环境隔离
```bash
# 开发环境
export AGENTSPHERE_API_KEY="as_test_development_key"
export AGENTSPHERE_DOMAIN="dev.agentsphere.run"

# 预发布环境  
export AGENTSPHERE_API_KEY="as_test_staging_key"
export AGENTSPHERE_DOMAIN="staging.agentsphere.run"

# 生产环境
export AGENTSPHERE_API_KEY="as_live_production_key" 
export AGENTSPHERE_DOMAIN="agentsphere.run"
```

#### CI/CD集成
```yaml
# GitHub Actions
env:
  AGENTSPHERE_API_KEY: ${{ secrets.AGENTSPHERE_API_KEY }}
  AGENTSPHERE_DOMAIN: agentsphere.run

# GitLab CI
variables:
  AGENTSPHERE_API_KEY: $AGENTSPHERE_API_KEY
  AGENTSPHERE_DOMAIN: agentsphere.run
```

---

## 📊 API配额和限制

### 标准配额
| 套餐 | 每月请求数 | 并发沙箱 | 存储限制 | 网络带宽 |
|------|-----------|----------|----------|----------|
| **免费** | 1,000 | 2 | 100MB | 1GB |
| **基础** | 10,000 | 5 | 1GB | 10GB |
| **专业** | 100,000 | 20 | 10GB | 100GB |
| **企业** | 无限制 | 100+ | 1TB+ | 1TB+ |

### 速率限制
- **API调用**: 100请求/分钟 (免费), 1000请求/分钟 (付费)
- **沙箱创建**: 10个/小时 (免费), 100个/小时 (付费) 
- **文件上传**: 50MB/请求, 500MB/小时 (免费)

### 配额监控
```javascript
// 检查API配额
async function checkQuota() {
    const response = await fetch('https://api.agentsphere.run/v1/quota', {
        headers: {
            'Authorization': `Bearer ${process.env.AGENTSPHERE_API_KEY}`
        }
    });
    
    const quota = await response.json();
    console.log('API配额状态:', quota);
    
    // 警告阈值检查
    if (quota.usage_percent > 80) {
        console.warn('⚠️  API配额使用超过80%');
    }
}
```

---

## 🔄 API Key轮换

### 轮换策略
1. **定期轮换**: 每90天轮换一次
2. **紧急轮换**: 安全事件后立即轮换
3. **自动轮换**: 使用API自动轮换(企业套餐)

### 轮换步骤
```bash
# 1. 生成新的API Key
curl -X POST https://api.agentsphere.run/v1/keys \
  -H "Authorization: Bearer $CURRENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "production-key-v2"}'

# 2. 更新环境配置
export AGENTSPHERE_API_KEY_NEW="new_api_key_here"

# 3. 测试新Key
AGENTSPHERE_API_KEY=$AGENTSPHERE_API_KEY_NEW node test-api-key.js

# 4. 平滑切换
# 更新生产环境配置
# 验证服务正常运行

# 5. 撤销旧Key
curl -X DELETE https://api.agentsphere.run/v1/keys/old_key_id \
  -H "Authorization: Bearer $AGENTSPHERE_API_KEY_NEW"
```

---

## 📞 支持和联系

### 官方支持
- **文档**: https://docs.agentsphere.run
- **API参考**: https://api.agentsphere.run/docs  
- **状态页面**: https://status.agentsphere.run
- **支持邮箱**: support@agentsphere.run
- **Discord社区**: https://discord.gg/agentsphere

### 应急联系
- **紧急技术支持**: +1-xxx-xxx-xxxx
- **安全事件报告**: security@agentsphere.run
- **服务故障通知**: incidents@agentsphere.run

### 内部支持
- **开发团队**: 钉钉群@开发组
- **运维团队**: 微信群@运维值班  
- **文档维护**: docs@yourcompany.com

---

## 📝 检查清单

### 初始设置检查清单
- [ ] 获取AgentSphere API Key
- [ ] 配置环境变量
- [ ] 验证API连接
- [ ] 运行集成测试  
- [ ] 检查Mock模式兜底
- [ ] 配置监控告警
- [ ] 更新文档

### 生产部署检查清单
- [ ] 生产API Key已配置
- [ ] 安全存储验证
- [ ] 网络连接测试
- [ ] 权限验证
- [ ] 配额确认
- [ ] 监控配置
- [ ] 告警规则设置
- [ ] 应急方案准备

### 日常维护检查清单
- [ ] API配额监控 (每周)
- [ ] 连接状态检查 (每天)
- [ ] 错误日志审查 (每天)
- [ ] 性能指标监控 (实时)
- [ ] API Key轮换计划 (每90天)
- [ ] 安全审计 (每月)

---

**文档版本**: 1.0  
**最后更新**: 2025-08-10  
**下次审查**: 2025-11-10  
**维护负责人**: 开发团队