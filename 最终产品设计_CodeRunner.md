# CodeRunner - AI代码即时运行平台

## 📌 产品定位

**一句话描述：为AI生成的代码提供一键部署运行的云端环境**

基于深度分析所有设计文档，这是最靠谱的产品定位：
- 不做AI已经擅长的事（代码生成）
- 专注解决AI代码没地方运行的痛点
- 简单实用，技术可行，商业价值清晰

---

## 🎯 核心用户场景

### 场景1：AI编程工具用户
```
用户：用Claude Code生成了一个博客系统
问题：代码在哪里运行？
解决：一键部署到CodeRunner，立即获得访问地址
```

### 场景2：学习者和原型开发者
```
用户：想快速验证AI生成的代码
问题：本地环境配置复杂
解决：直接部署到云端，无需本地配置
```

### 场景3：教育和演示
```
用户：教学中展示代码运行效果
问题：学生环境不一致
解决：统一的云端运行环境
```

---

## 💡 产品核心功能

### 1. 一键部署（MVP核心）

```typescript
// 极简的部署接口
POST /api/deploy
{
  "files": [
    {"path": "server.js", "content": "..."},
    {"path": "package.json", "content": "..."}
  ],
  "runtime": "nodejs"  // 自动检测
}

Response:
{
  "deploymentId": "dep_xxx",
  "endpoint": "https://dep_xxx.coderunner.io",
  "status": "running"
}
```

**技术实现：**
- 基于AgentSphere创建沙箱
- 自动检测项目类型（Node.js/Python/Java）
- 自动安装依赖并启动
- 返回访问地址

### 2. 智能项目识别

```typescript
interface ProjectDetection {
  detectType(files: CodeFile[]): {
    type: 'nodejs' | 'python' | 'java' | 'manifest'
    framework?: 'express' | 'fastapi' | 'spring' | 'manifest'
    database?: 'postgres' | 'mysql' | 'mongodb'
    startCommand: string
  }
}
```

**识别规则：**
- 有`manifest.yaml` → Manifest项目，使用特殊处理
- 有`package.json` → Node.js项目
- 有`requirements.txt` → Python项目
- 有`pom.xml` → Java项目

### 3. 基础管理功能

```typescript
interface ManagementAPI {
  // 查看状态
  GET /api/deployments/:id/status
  
  // 查看日志
  GET /api/deployments/:id/logs
  
  // 更新文件
  PUT /api/deployments/:id/files/:path
  
  // 重启服务
  POST /api/deployments/:id/restart
  
  // 删除部署
  DELETE /api/deployments/:id
}
```

### 4. Manifest深度集成

对于Manifest项目的特殊优化：

```yaml
# 用户只需要写manifest.yaml
name: my-blog
entities:
  Post:
    properties:
      - name: title
        type: text
        required: true
      - name: content
        type: longtext
      - name: author
        type: text
```

**自动生成：**
- 完整的CRUD API
- 数据库表结构
- 认证系统（如配置）
- API文档

---

## 🛠️ 技术架构

### 架构图

```
┌──────────────────────────────────────┐
│         CodeRunner Frontend          │
│         (管理控制台，可选)            │
└──────────────────────────────────────┘
                    │
                    ↓
┌──────────────────────────────────────┐
│        CodeRunner API Service        │
│  - 项目识别                          │
│  - 部署管理                          │
│  - 日志聚合                          │
└──────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        ↓                       ↓
┌─────────────────┐    ┌─────────────────┐
│   AgentSphere   │    │    Manifest     │
│  (运行时环境)    │    │  (后端生成器)   │
│                 │    │                 │
│  - 沙箱隔离     │    │  - YAML解析     │
│  - 文件系统     │    │  - API生成      │
│  - 命令执行     │    │  - 数据库管理   │
└─────────────────┘    └─────────────────┘
```

### 技术栈

**后端服务：**
- Node.js + Express/Fastify
- TypeScript
- AgentSphere SDK
- Manifest Runtime

**存储：**
- PostgreSQL（部署元数据）
- Redis（缓存和会话）
- S3兼容存储（文件持久化）

**基础设施：**
- Docker容器化
- Kubernetes编排
- Nginx反向代理

---

## 📈 开发路线图

### Phase 1: MVP (4周)
**目标：基础部署能力**

```yaml
Week 1-2:
  - AgentSphere集成
  - 基础部署API
  - 项目类型检测

Week 3-4:
  - Manifest集成
  - 日志和状态API
  - 基础错误处理
```

**交付物：**
- ✅ API可以部署Node.js项目
- ✅ API可以部署Manifest项目
- ✅ 基础管理API

### Phase 2: 开发体验 (3周)
**目标：提升开发调试体验**

```yaml
Week 5-6:
  - Web管理控制台
  - 实时日志流
  - 文件编辑器

Week 7:
  - API测试工具
  - 性能监控
  - 错误诊断
```

**交付物：**
- ✅ Web管理界面
- ✅ 实时日志查看
- ✅ 在线文件编辑
- ✅ API测试工具

### Phase 3: 生产就绪 (4周)
**目标：生产级功能**

```yaml
Week 8-9:
  - 数据持久化
  - 自动备份
  - 故障恢复

Week 10-11:
  - 用户认证
  - 配额管理
  - 计费系统
```

**交付物：**
- ✅ 持久化存储
- ✅ 用户系统
- ✅ 商业化能力

### Phase 4: 增值功能 (4周)
**目标：差异化竞争力**

```yaml
Week 12-13:
  - 自定义域名
  - SSL证书
  - CDN集成

Week 14-15:
  - 团队协作
  - CI/CD集成
  - 企业功能
```

---

## 💰 商业模式

### 定价策略

**免费层：**
- 3个活跃部署
- 每月100小时运行时间
- 基础资源（512MB内存）

**个人版（$9/月）：**
- 10个活跃部署
- 每月500小时运行时间
- 标准资源（1GB内存）
- 自定义域名

**团队版（$29/月）：**
- 无限部署
- 每月2000小时运行时间
- 高级资源（2GB内存）
- 团队协作功能

**企业版（定制）：**
- 私有部署
- SLA保证
- 专属支持

### 目标市场

1. **AI编程工具用户**（主要）
   - Claude Code用户
   - Cursor用户
   - GitHub Copilot用户

2. **教育市场**（次要）
   - 编程教育平台
   - 在线课程
   - 技术培训

3. **开发者社区**（增长）
   - 原型开发者
   - 开源项目
   - 技术博主

---

## ✅ 为什么这个设计最靠谱

### 1. 技术可行性高
- **基于现有能力**：80%功能基于AgentSphere和Manifest现有API
- **开发成本可控**：MVP只需4周，核心团队3-4人
- **技术风险低**：不需要复杂的AI或分布式系统

### 2. 市场需求明确
- **痛点清晰**：AI生成的代码没地方运行
- **用户明确**：所有AI编程工具的用户
- **价值明显**：节省配置时间，提高开发效率

### 3. 商业模式清晰
- **免费获客**：免费层吸引用户
- **自然升级**：使用增长带动付费
- **企业市场**：高价值企业客户

### 4. 竞争优势明显
- **AI原生**：专为AI编程场景设计
- **Manifest加持**：YAML驱动的快速后端
- **简单易用**：一键部署，零配置

### 5. 扩展性良好
- **横向扩展**：支持更多语言和框架
- **纵向深化**：增加企业级功能
- **生态集成**：与AI工具深度集成

---

## 🚀 下一步行动

### 立即可做
1. **技术验证**（1周）
   - 搭建AgentSphere环境
   - 测试Manifest集成
   - 验证核心流程

2. **MVP开发**（3周）
   - 实现基础部署API
   - 项目类型检测
   - 基础管理功能

3. **用户测试**（持续）
   - 邀请AI编程工具用户测试
   - 收集反馈迭代
   - 优化用户体验

### 需要的资源
- **技术团队**：3-4名全栈工程师
- **基础设施**：云服务器和存储
- **运营支持**：产品经理和设计师

---

## 📊 成功指标

### 技术指标
- 部署成功率 > 95%
- 平均部署时间 < 30秒
- 服务可用性 > 99.9%

### 业务指标
- MVP阶段：100个活跃用户
- 3个月：1000个活跃用户
- 6个月：20%付费转化率

### 用户指标
- 用户满意度 > 4.5/5
- 月活跃留存 > 60%
- 推荐意愿 NPS > 50

---

## 总结

**CodeRunner是一个技术可行、市场需求明确、商业模式清晰的产品。**

通过聚焦"为AI代码提供运行环境"这个核心价值，避免过度工程化，我们可以快速推出MVP，验证市场，然后逐步增强功能。

这是基于所有分析文档后，**最靠谱、最实际、最可行的产品设计！** 🎯