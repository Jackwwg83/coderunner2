# 🧪 Phase 1 全面测试计划

**项目**: CodeRunner v2.0  
**阶段**: Phase 1 MVP  
**目标**: 确保所有Phase 1组件的质量、可靠性和安全性

## 📋 测试范围

### Phase 1 核心模块
1. **ProjectAnalyzer** - 项目类型检测
2. **ManifestEngine** - YAML到代码生成
3. **OrchestrationService** - 部署编排
4. **Deploy API** - RESTful接口
5. **集成测试** - 端到端流程

## 🎯 测试目标

- **代码覆盖率**: ≥80%
- **所有测试通过**: 100%
- **性能基准**: API响应<200ms
- **安全验证**: 所有安全场景覆盖

## 📊 测试策略矩阵

| 模块 | 单元测试 | 集成测试 | 性能测试 | 安全测试 | 优先级 |
|-----|---------|---------|---------|---------|-------|
| ProjectAnalyzer | ✅ | ✅ | ⚠️ | ✅ | P0 |
| ManifestEngine | ✅ | ✅ | ✅ | ✅ | P0 |
| OrchestrationService | ✅ | ✅ | ✅ | ✅ | P0 |
| Deploy API | ✅ | ✅ | ✅ | ✅ | P0 |
| AgentSphere Integration | ⚠️ | ✅ | ⚠️ | ✅ | P1 |

## 🔍 详细测试计划

### 1. ProjectAnalyzer 测试

#### 单元测试
```typescript
describe('ProjectAnalyzer', () => {
  // 核心功能
  - ✅ 检测Node.js项目 (package.json)
  - ✅ 检测Manifest项目 (manifest.yaml)
  - ✅ 检测混合项目 (Manifest优先)
  - ✅ 检测空项目
  - ✅ 检测无效项目结构
  
  // 框架检测
  - ✅ 识别Express框架
  - ✅ 识别React应用
  - ✅ 识别Next.js应用
  - ✅ 识别Vue应用
  
  // 边界条件
  - ✅ 处理损坏的package.json
  - ✅ 处理无效的manifest.yaml
  - ✅ 处理大文件
  - ✅ 处理特殊字符文件名
});
```

#### 性能测试
- 分析100个文件的速度 < 100ms
- 内存使用 < 50MB

### 2. ManifestEngine 测试

#### 单元测试
```typescript
describe('ManifestEngine', () => {
  // YAML解析
  - ✅ 解析简单实体
  - ✅ 解析复杂实体关系
  - ✅ 处理无效YAML
  - ✅ 处理空manifest
  
  // 代码生成
  - ✅ 生成package.json
  - ✅ 生成index.js (Express服务器)
  - ✅ 生成database.js (LowDB)
  - ✅ 生成.env文件
  - ✅ 生成README.md
  
  // CRUD操作
  - ✅ GET端点生成
  - ✅ POST端点生成
  - ✅ PUT端点生成
  - ✅ DELETE端点生成
  
  // 验证逻辑
  - ✅ 必填字段验证
  - ✅ 类型验证
  - ✅ 唯一性约束
  
  // 边界条件
  - ✅ 超长实体名
  - ✅ 特殊字符处理
  - ✅ 保留字冲突
});
```

#### 集成测试
- 生成的代码可以运行
- API端点正常工作
- 数据持久化正确

### 3. OrchestrationService 测试

#### 单元测试
```typescript
describe('OrchestrationService', () => {
  // 部署流程
  - ✅ Node.js项目部署
  - ✅ Manifest项目部署
  - ✅ 混合项目部署
  
  // AgentSphere集成
  - ✅ 沙箱创建
  - ✅ 文件上传
  - ✅ 命令执行
  - ✅ URL生成
  
  // 错误处理
  - ✅ 项目分析失败
  - ✅ Manifest生成失败
  - ✅ 沙箱创建失败
  - ✅ 部署超时
  
  // 状态管理
  - ✅ deploying状态
  - ✅ running状态
  - ✅ failed状态
  - ✅ stopped状态
});
```

#### Mock策略
- Mock AgentSphere SDK
- Mock DatabaseService
- Mock文件系统操作

### 4. Deploy API 测试

#### 单元测试
```typescript
describe('POST /api/deploy', () => {
  // 认证测试
  - ✅ 需要JWT token
  - ✅ 拒绝无效token
  - ✅ 拒绝过期token
  
  // 参数验证
  - ✅ 项目名必填
  - ✅ 文件列表非空
  - ✅ 文件路径验证
  - ✅ base64解码
  
  // 配额限制
  - ✅ 免费用户限制
  - ✅ Pro用户限制
  - ✅ 企业用户无限制
  
  // 安全测试
  - ✅ 路径遍历防护
  - ✅ XSS防护
  - ✅ SQL注入防护
  - ✅ 文件大小限制
});
```

#### 集成测试
- 完整部署流程
- 错误回滚
- 并发部署

### 5. 端到端测试

#### 场景测试
```typescript
describe('E2E Deployment', () => {
  // 成功场景
  - ✅ 部署简单Node.js应用
  - ✅ 部署Express API
  - ✅ 部署Manifest博客应用
  - ✅ 部署Manifest电商应用
  
  // 失败场景
  - ✅ 无效manifest处理
  - ✅ 启动失败处理
  - ✅ 超时处理
  - ✅ 资源限制处理
  
  // 性能场景
  - ✅ 并发10个部署
  - ✅ 大文件上传
  - ✅ 复杂项目部署
});
```

## 🛡️ 安全测试清单

### 输入验证
- [ ] SQL注入测试
- [ ] XSS攻击测试
- [ ] 路径遍历测试
- [ ] 命令注入测试
- [ ] LDAP注入测试

### 认证授权
- [ ] JWT伪造测试
- [ ] 权限提升测试
- [ ] Session固定测试
- [ ] CSRF测试

### 资源限制
- [ ] 文件大小限制
- [ ] 请求频率限制
- [ ] 内存使用限制
- [ ] CPU使用限制

## 📈 性能基准

### API响应时间
- GET请求: <50ms
- POST请求: <200ms
- 文件上传: <5s
- 部署完成: <30s

### 资源使用
- 内存: <200MB
- CPU: <50%
- 数据库连接: <10

### 并发能力
- 同时用户: 100+
- 并发部署: 10+
- QPS: 1000+

## 🔧 测试工具

### 必需工具
- **Jest**: 单元测试框架
- **Supertest**: HTTP测试
- **Mock**: Jest mock功能
- **Coverage**: Jest coverage

### 可选工具
- **K6**: 负载测试
- **OWASP ZAP**: 安全扫描
- **Lighthouse**: 性能审计

## 📝 测试数据准备

### 示例项目
1. **简单Node.js项目**
```json
{
  "name": "test-node-app",
  "version": "1.0.0",
  "scripts": {
    "start": "node index.js"
  }
}
```

2. **Manifest博客项目**
```yaml
name: TestBlog
entities:
  - name: Post
    properties:
      - name: title
        type: string
        required: true
      - name: content
        type: text
      - name: published
        type: boolean
```

3. **复杂Manifest项目**
```yaml
name: TestEcommerce
entities:
  - name: Product
    properties:
      - name: name
        type: string
        required: true
      - name: price
        type: number
        required: true
      - name: stock
        type: number
  - name: Order
    properties:
      - name: customer
        type: string
        required: true
      - name: total
        type: number
      - name: status
        type: string
```

## 🚀 执行计划

### Phase 1: 修复现有测试 (2小时)
1. 修复失败的Auth测试
2. 修复Mock配置问题
3. 更新测试依赖

### Phase 2: 增强单元测试 (3小时)
1. ProjectAnalyzer完整覆盖
2. ManifestEngine边界测试
3. OrchestrationService Mock测试
4. Deploy API安全测试

### Phase 3: 集成测试 (2小时)
1. 端到端部署流程
2. 错误恢复测试
3. 并发测试

### Phase 4: 性能测试 (1小时)
1. API响应时间
2. 资源使用监控
3. 负载测试

### Phase 5: 安全测试 (2小时)
1. 输入验证测试
2. 认证授权测试
3. 资源限制测试

## 📊 成功标准

### 必须达到
- ✅ 所有单元测试通过
- ✅ 所有集成测试通过
- ✅ 代码覆盖率 ≥80%
- ✅ 无高危安全问题

### 应该达到
- ⚠️ API响应时间达标
- ⚠️ 并发测试通过
- ⚠️ 性能基准达标

### 可以达到
- 💡 100%代码覆盖
- 💡 完整安全扫描
- 💡 压力测试通过

## 🎯 下一步行动

1. 调用test-writer-fixer SubAgent执行测试计划
2. 修复所有失败的测试
3. 增加缺失的测试用例
4. 生成测试报告
5. 更新项目文档

---

**准备人**: Studio Producer  
**日期**: 2025-08-07  
**状态**: 待执行