# 📝 CodeRunner 主任务清单 (v2.1)

> **AI专用**: 本文档是 CodeRunner 项目的任务板，由 **studio-producer** (主AI) 进行管理。所有 SubAgent 必须从此清单中领取任务，并严格按照关联的设计文档执行。

## 📜 最高指导原则 (AI必读)

**此为最高指令，优先级高于一切任务描述。**

1.  **你是协调者，不是执行者**: 你的核心角色是理解人类指令，分解任务，并使用工具调用合适的 SubAgent。**严禁自己直接编写业务逻辑或实现代码。**
2.  **设计文档是唯一事实源**: 你的所有工作都必须严格基于 `01-system-design.md`, `04-database-schema.md` 等核心设计文档。**严禁修改设计文档，严禁做出任何与设计相悖的实现。**
3.  **不确定时必须提问**: 如果对任务、业务逻辑或技术实现有任何不确定性，**必须**在 `QUESTIONS.md` 中提出问题，等待项目总指挥决策。**严禁做出任何技术或业务假设。**
4.  **任务必须原子化**: 你分配给 SubAgent 的任务必须是清晰、具体、小颗粒的，确保其能在一次调用中完成。


## 核心设计文档

在开始任何任务前，必须阅读并理解以下核心设计：

- **系统架构**: [01-system-design.md](./01-system-design.md)
- **数据库 Schema**: [04-database-schema.md](./04-database-schema.md)
- **模板规格**: [05-templates-spec.md](./05-templates-spec.md)

---

##  Phase 0: 项目奠基 (预计用时: 2-3天)

**目标**: 搭建项目骨架，实现最核心的数据库交互，并准备好开发环境。

*   **任务 P0-T01: 初始化 Node.js 项目** (指派给: `backend-architect`)
*   **任务 P0-T02: 实现数据库服务 (`DatabaseService`)** (指派给: `backend-architect`)
*   **任务 P0-T03: 实现认证服务 (`AuthService`)** (指派给: `backend-architect`)
*   **任务 P0-T04: 编写核心服务的单元测试** (指派给: `test-writer-fixer`)

*(注: 详细任务描述见v2.0版本，此处省略以保持简洁)*

---

## Phase 1: MVP - 支持 Node.js 与 Manifest (预计用时: 4-5天)

**目标**: 实现端到端的部署流程，并同时支持标准的 Node.js 项目和我们独特的 Manifest 项目。

### **任务 P1-T01: 扩展项目分析器 (`ProjectAnalyzer`)**
- **描述**: 编写一个能同时识别 Node.js 和 Manifest 项目的工具集。
- **指派给**: `rapid-prototyper`
- **可交付成果**:
  1. `src/utils/analyzer.ts` 文件。
  2. 实现一个 `analyzeProject(files)` 函数，该函数能接收文件列表，并返回一个对象，包含：
     - `projectType`: 'nodejs' 或 'manifest'。
     - `startCommand`: 对于 Node.js，从 `package.json` 读取；对于 Manifest，默认为 `npm start`。
     - `dependencies`: 如 `npm`。

### **任务 P1-T02: 实现 Manifest 代码生成器 (`ManifestEngine`)**
- **描述**: 编写一个服务，该服务可以接收 `manifest.yaml` 的内容，并为其生成一个功能完整的 Express 后端项目文件列表。
- **指派给**: `backend-architect`
- **设计约束**: 生成的代码应包括 Express 服务器、基于 `manifest` 实体定义的 CRUD 路由、以及一个用于存储数据的内存数据库（如 `lowdb` 或 `sqlite`）。
- **可交付成果**:
  1. `src/services/manifestEngine.ts` 文件。
  2. 实现一个 `generateProject(manifestContent)` 函数，该函数返回一个文件对象数组，例如 `[{ path: 'index.js', content: '...' }, { path: 'package.json', content: '...' }]`。

### **任务 P1-T03: 重构编排服务 (`OrchestrationService`) 以支持多类型部署**
- **描述**: 重构 `OrchestrationService`，使其能根据项目类型执行不同的部署剧本。
- **指派给**: `backend-architect`
- **前置依赖**: P1-T01, P1-T02
- **可交付成果**:
  1. 修改 `src/services/orchestration.ts`。
  2. 实现一个 `deployProject(userId, files)` 主函数，其内部逻辑如下：
     a. 调用 `ProjectAnalyzer` 确定项目类型。
     b. **如果类型是 `manifest`**: 首先调用 `ManifestEngine` 生成项目文件，并将生成的文件与用户文件合并。
     c. 调用 AgentSphere SDK，基于合适的模板 (`template-nodejs-18` 或 `template-manifest-runner`) 创建沙箱。
     d. 上传所有项目文件到沙箱。
     e. 在沙箱内执行依赖安装 (`npm install`) 和启动命令 (`npm start`)。
     f. 获取公网 URL 并存入数据库。
     g. 返回公网 URL。

### **任务 P1-T04: 创建统一的 `/deploy` API 端点**
- **描述**: 创建一个统一的 API 端点，用于接收所有类型的部署请求。
- **指派给**: `backend-architect`
- **前置依赖**: P1-T03
- **可交付成果**:
  1. `src/routes/deploy.ts` 文件，实现 `POST /deploy` 路由。
  2. 该路由能自动处理包含 `manifest.yaml` 或 `package.json` 的请求，并调用 `OrchestrationService` 完成部署。

### **任务 P1-T05: 编写 Manifest 部署的集成测试**
- **描述**: 编写一个专门的集成测试，验证 Manifest 项目的端到端部署流程。
- **指派给**: `test-writer-fixer`
- **前置依赖**: P1-T04
- **可交付成果**:
  1. 一个新的集成测试文件，该测试将：
     a. 模拟用户上传一个包含 `manifest.yaml` 的项目。
     b. 调用 `/deploy` 端点。
     c. 断言部署成功，并返回一个有效的 URL。
     d. (可选) 请求返回的 URL，并验证 Manifest 生成的某个 API 端点（如 `GET /items`）是否能正常工作。

---

## Phase 2: 前后端集成与实时界面 (预计用时: 6天冲刺)

**目标**: 将 CodeRunner 从 MVP 提升为生产就绪平台，整合 V0 生成的前端界面，实现前后端完整集成。

**V0 前端整合状态**: ✅ 前端代码已生成，需要与后端 API 集成
- **技术栈对齐**: Next.js 15 + React 19 + shadcn/ui + TypeScript (符合决策 D007)
- **页面完成度**: 6个核心页面已实现 (登录、部署列表、新建部署、部署详情、项目管理等)
- **待集成功能**: WebSocket 实时通信、API 对接、状态管理

### **任务 P2-T01: WebSocket 实时日志传输** (待开始)
- **描述**: 实现基于 Socket.io 的 WebSocket 服务器，提供部署日志的实时流式传输。
- **指派给**: `backend-architect`
- **状态**: 📋 **准备开始** - 等待前端集成并行启动
- **技术要求**:
  - 使用 Socket.io 实现 WebSocket 服务器
  - Redis pub/sub 支持水平扩展
  - 日志缓冲机制（支持延迟加入的客户端）
  - 连接生命周期管理和自动重连
- **可交付成果**:
  1. `src/services/websocket.ts` - WebSocket 服务实现
  2. `src/services/logStream.ts` - 日志流管理服务
  3. 客户端 SDK 用于日志消费
  4. 集成测试验证实时传输（延迟 <100ms）

### **任务 P2-T02: 部署监控与指标收集** (待开始)
- **描述**: 实现全面的监控系统，收集部署指标并提供健康检查。
- **指派给**: `devops-automator`
- **状态**: 📋 **准备开始** - 可与 P2-T01 并行开始
- **前置依赖**: 无 (与 P2-T01 并行执行)
- **技术要求**:
  - CPU、内存、网络使用率收集（10秒间隔）
  - 健康检查端点实现
  - Prometheus 集成用于指标存储
  - AlertManager 配置用于关键告警
- **可交付成果**:
  1. `src/services/metrics.ts` - 指标收集服务
  2. `src/services/healthCheck.ts` - 健康检查系统
  3. Prometheus 配置文件
  4. Grafana 仪表板模板

### **任务 P2-T03: V0 前端集成与后端对接** (Day 3 今天开始)
- **描述**: 整合 V0 生成的前端代码，实现与现有后端 API 的完整集成。
- **指派给**: `frontend-developer`
- **状态**: 🎯 **今天开始** - Day 3 启动任务
- **前置依赖**: 无 (基础集成可先开始，实时功能等待 P2-T01)
- **V0 已完成组件**:
  - ✅ 部署仪表板 (`app/page.tsx`) - 部署列表、状态卡片、搜索功能
  - ✅ 新建部署页 (`app/deploy/new/page.tsx`) - 项目类型选择、文件上传、环境变量
  - ✅ 部署详情页 (`app/deployments/[id]/page.tsx`) - 多标签界面、日志查看、指标展示
  - ✅ 认证页面 (`app/auth/page.tsx`) - 登录/注册表单
  - ✅ 项目管理、团队、设置等页面
- **Day 3 集成任务**:
  1. 迁移 V0 前端到项目 `/frontend` 目录
  2. 配置 API 基础路径和后端连接
  3. 实现认证状态管理 (JWT token)
  4. 集成部署 API (`POST /api/deploy` → V0 新建部署表单)
  5. 实现部署列表数据获取
- **Day 4 实时功能集成** (需要 P2-T01 WebSocket 服务完成):
  1. Socket.io 客户端集成到 V0 组件
  2. 实时日志流集成到部署详情页
  3. 实时状态更新 (部署状态、指标)
  4. 错误处理和加载状态优化
  5. 响应式适配和主题切换完善

### **任务 P2-T04: 配置与环境变量管理** (Day 5)
- **描述**: 实现环境变量管理系统，支持加密存储和多环境配置。
- **指派给**: `backend-architect`
- **前置依赖**: P2-T03
- **技术要求**:
  - 环境变量 CRUD API
  - 秘钥加密存储（AES-256）
  - 配置模板系统
  - 多环境支持（dev/staging/prod）
- **可交付成果**:
  1. `src/services/configManager.ts` - 配置管理服务
  2. `src/services/secretsManager.ts` - 秘钥加密服务
  3. 配置管理 UI 组件
  4. 环境变量注入到沙箱的集成

### **任务 P2-T05: 自动扩缩容与资源优化** (Day 6)
- **描述**: 实现基于指标的自动扩缩容引擎和资源优化算法。
- **指派给**: `devops-automator`
- **前置依赖**: P2-T02
- **技术要求**:
  - CPU/内存/请求触发的扩缩容策略
  - 冷却期和阈值配置
  - 资源优化算法（激进/平衡/保守）
  - 成本计算器
- **可交付成果**:
  1. `src/services/autoScaler.ts` - 自动扩缩容引擎
  2. `src/services/resourceOptimizer.ts` - 资源优化器
  3. 扩缩容策略配置 API
  4. 性能基准测试报告

### **任务 P2-T06: 前后端集成测试与 V0 界面验证** (Day 6 - 并行)
- **描述**: 验证 V0 前端与后端的完整集成，确保用户体验流畅。
- **指派给**: `test-writer-fixer`
- **前置依赖**: P2-T01 到 P2-T05
- **V0 特定测试任务**:
  1. 用户认证流程 E2E 测试 (登录 → 仪表板)
  2. 完整部署流程测试 (新建 → 文件上传 → 部署 → 状态监控)
  3. 实时日志流在 V0 日志查看器中的测试
  4. 部署控制功能测试 (启动/停止/重启)
  5. 响应式设计跨设备测试
- **API 集成测试**:
  1. V0 组件与后端 API 数据格式对齐验证
  2. WebSocket 连接稳定性测试
  3. 错误处理和用户反馈测试
  4. 性能测试 (页面加载、API 响应时间)
  5. 跨浏览器兼容性测试

---

## Phase 3: 数据库编排与高级管理控制台 (预计用时: 8-10天)

**目标**: 实现数据库"应用装置"编排，完善 Web 管理控制台，提供企业级功能。

### 子阶段 3A: 数据库模板实现 (Days 1-4)

### **任务 P3-T01: PostgreSQL 模板开发**
- **描述**: 创建支持多租户的 PostgreSQL 15 数据库模板。
- **指派给**: `devops-automator`
- **技术要求**:
  - 每租户独立数据库隔离
  - 持久化存储卷管理
  - 网络安全配置（pg_hba.conf）
  - 自动备份/恢复机制
  - 资源配额管理
- **可交付成果**:
  1. `template-postgres-15` 沙箱模板
  2. 多租户数据库创建脚本
  3. 备份/恢复自动化脚本
  4. 性能监控集成

### **任务 P3-T02: Redis 模板开发**
- **描述**: 创建支持多租户的 Redis 7 缓存服务模板。
- **指派给**: `devops-automator`
- **前置依赖**: P3-T01（经验复用）
- **技术要求**:
  - 基于数据库索引的租户隔离
  - 内存配额管理
  - 持久化配置（RDB + AOF）
  - 密码认证和 ACL
- **可交付成果**:
  1. `template-redis-7` 沙箱模板
  2. Redis 配置管理脚本
  3. 内存优化配置
  4. 集群模式准备

### **任务 P3-T03: 数据库编排服务**
- **描述**: 扩展 OrchestrationService 以支持数据库模板的部署和管理。
- **指派给**: `backend-architect`
- **前置依赖**: P3-T01, P3-T02
- **技术要求**:
  - 数据库沙箱生命周期管理
  - 应用-数据库网络连接
  - 连接字符串生成和注入
  - 数据库健康监控
- **可交付成果**:
  1. 更新 `src/services/orchestration.ts`
  2. 数据库部署 API 端点
  3. 连接管理服务
  4. 数据库状态监控

### **任务 P3-T04: 数据库管理 UI**
- **描述**: 扩展 React 应用，添加数据库管理界面。
- **指派给**: `frontend-developer`
- **前置依赖**: P3-T03
- **可交付成果**:
  1. 数据库实例列表组件
  2. 数据库创建/配置表单
  3. 连接信息显示（安全处理）
  4. 备份/恢复操作界面

### 子阶段 3B: 高级管理功能与 V0 界面扩展 (Days 5-8)

### **任务 P3-T05: 用户认证与 V0 认证页面集成**
- **描述**: 完善前端认证系统，集成 V0 认证页面，实现完整的用户管理流程。
- **指派给**: `backend-architect`
- **V0 集成要求**:
  - 集成 V0 登录/注册表单 (`app/auth/page.tsx`)
  - JWT 令牌管理和自动刷新
  - 用户状态持久化和路由保护
  - OAuth2 集成准备 (Google/GitHub 按钮)
- **技术要求**:
  - 角色和权限管理
  - 会话管理和安全性
  - 密码重置流程
- **可交付成果**:
  1. V0 认证页面功能完善
  2. JWT 中间件和前端状态管理
  3. 用户管理 API 扩展
  4. 认证流程 E2E 测试

### **任务 P3-T06: V0 高级页面功能实现**
- **描述**: 完善 V0 生成的高级管理页面，实现项目管理、团队协作、设置等功能。
- **指派给**: `frontend-developer`
- **前置依赖**: P3-T05
- **V0 页面完善任务**:
  1. 项目管理页 (`app/projects/page.tsx`) - 后端数据集成
  2. 团队管理页 (`app/team/page.tsx`) - 用户邀请、角色管理
  3. 设置页面 (`app/settings/page.tsx`) - 用户配置、API 密钥
  4. 数据库管理页 (`app/databases/page.tsx`) - 数据库实例管理
- **功能增强**:
  1. 多项目切换和过滤
  2. 实时协作状态显示
  3. 批量操作和搜索功能
  4. 用户权限控制集成

### **任务 P3-T07: 高级监控与分析**
- **描述**: 实现高级性能分析和成本优化功能。
- **指派给**: `performance-benchmarker`
- **技术要求**:
  - 详细的性能指标收集
  - 成本分析和预测
  - 性能瓶颈识别
  - 优化建议生成
- **可交付成果**:
  1. 性能分析服务
  2. 成本计算引擎
  3. 分析仪表板 UI
  4. 优化报告生成器

### **任务 P3-T08: 文件编辑器增强**
- **描述**: 升级文件编辑器为功能完整的代码编辑器。
- **指派给**: `frontend-developer`
- **技术要求**:
  - Monaco Editor 集成
  - 语法高亮和自动完成
  - 多文件编辑支持
  - Git 差异查看
- **可交付成果**:
  1. Monaco Editor 集成
  2. 文件树导航增强
  3. 编辑器设置面板
  4. 协作编辑准备

### 子阶段 3C: 质量保证与文档 (Days 9-10)

### **任务 P3-T09: 全面的端到端测试**
- **描述**: 创建完整的 E2E 测试套件，覆盖所有用户工作流。
- **指派给**: `test-writer-fixer`
- **前置依赖**: 所有 P3 任务
- **可交付成果**:
  1. 数据库部署测试场景
  2. 多租户隔离验证
  3. UI 工作流测试（Playwright）
  4. 性能和负载测试
  5. 安全测试套件

### **任务 P3-T10: API 文档和开发者指南**
- **描述**: 创建全面的 API 文档和开发者使用指南。
- **指派给**: `backend-architect`
- **可交付成果**:
  1. OpenAPI/Swagger 规范
  2. API 参考文档
  3. 快速入门指南
  4. 最佳实践文档
  5. 故障排除指南

---

## Phase 3D: 补充任务 - 产品完善 (预计用时: 5-6天)

**目标**: 补充缺失的关键功能，提升产品体验，完善开发者生态。

### **任务 P3-T11: OAuth2 社交登录集成**
- **描述**: 实现 Google 和 GitHub OAuth2 登录功能，提供社交登录选项。
- **指派给**: `backend-architect`
- **优先级**: P0 (产品设计核心功能)
- **前置依赖**: P3-T05 (基础认证系统)
- **预计时间**: 1-2天
- **技术要求**:
  - Google OAuth2 策略实现 (Passport.js)
  - GitHub OAuth2 策略实现
  - OAuth 回调处理和用户账号关联
  - 前端 OAuth 按钮功能激活
  - 用户账号合并逻辑
- **可交付成果**:
  1. `src/services/oauth.ts` - OAuth2 服务实现
  2. `src/routes/auth/google.ts` - Google OAuth 路由
  3. `src/routes/auth/github.ts` - GitHub OAuth 路由
  4. 前端 OAuth 按钮集成
  5. OAuth 流程测试用例

### **任务 P3-T12: Monaco Editor 代码编辑器集成**
- **描述**: 集成 Monaco Editor 提供专业的代码编辑体验。
- **指派给**: `frontend-developer`
- **优先级**: P0 (核心用户体验)
- **前置依赖**: 基础文件管理功能
- **预计时间**: 2-3天
- **技术要求**:
  - Monaco Editor React 组件集成
  - 语法高亮支持 (JavaScript, TypeScript, Python, YAML, JSON)
  - 智能代码补全和错误提示
  - 多文件标签页支持
  - 主题适配 (Cyberpunk 风格)
  - 快捷键支持 (保存、搜索、替换)
- **可交付成果**:
  1. `components/editor/MonacoEditor.tsx` - 编辑器组件
  2. `components/editor/EditorTabs.tsx` - 多标签管理
  3. `hooks/useMonacoTheme.ts` - 主题管理
  4. 编辑器设置面板
  5. 文件保存和同步逻辑

### **任务 P3-T13: OpenAPI 文档生成系统**
- **描述**: 生成完整的 API 文档和开发者指南。
- **指派给**: `backend-architect`
- **优先级**: P1 (开发者生态)
- **前置依赖**: 所有 API 端点实现完成
- **预计时间**: 2天
- **技术要求**:
  - OpenAPI 3.0 规范生成
  - Swagger UI 集成
  - API 请求/响应示例
  - 认证说明文档
  - 错误码参考
- **可交付成果**:
  1. `openapi.yaml` - OpenAPI 3.0 规范文件
  2. `/api-docs` - Swagger UI 端点
  3. API 参考文档 (Markdown)
  4. Postman Collection 导出
  5. SDK 使用示例代码

### **任务 P3-T14: 生产环境部署配置**
- **描述**: 完善生产环境部署配置和 CI/CD 流程。
- **指派给**: `devops-automator`
- **优先级**: P1 (生产就绪)
- **前置依赖**: 核心功能测试通过
- **预计时间**: 1天
- **技术要求**:
  - Docker 镜像优化 (多阶段构建)
  - 环境变量管理 (.env.production)
  - GitHub Actions CI/CD 配置
  - 健康检查和监控端点
  - 日志聚合配置
- **可交付成果**:
  1. `Dockerfile.production` - 优化的生产镜像
  2. `.github/workflows/deploy.yml` - CI/CD 流水线
  3. `docker-compose.production.yml` - 生产环境编排
  4. 部署脚本和文档
  5. 监控和告警配置

---

## SubAgent 分配策略总结

### Phase 2 SubAgent 负载分析
- `backend-architect`: 3 个任务（P2-T01, P2-T04, 部分 P2-T03 支持）
- `frontend-developer`: 1 个主要任务（P2-T03，2天工作量）
- `devops-automator`: 2 个任务（P2-T02, P2-T05）
- `test-writer-fixer`: 1 个任务（P2-T06）

### Phase 3 SubAgent 负载分析
- `devops-automator`: 2 个任务（P3-T01, P3-T02）
- `backend-architect`: 3 个任务（P3-T03, P3-T05, P3-T10）
- `frontend-developer`: 3 个任务（P3-T04, P3-T06, P3-T08）
- `performance-benchmarker`: 1 个任务（P3-T07）
- `test-writer-fixer`: 1 个任务（P3-T09）

### 成功因素（基于 Phase 1 经验）
1. **清晰的任务边界**: 每个任务都有明确的输入、输出和验收标准
2. **合理的依赖管理**: 任务依赖关系清晰，避免阻塞
3. **技能匹配**: SubAgent 分配基于专长领域
4. **并行执行**: 尽可能并行执行独立任务
5. **质量门控**: 每个阶段都有测试任务确保质量

---

## 注意事项

1. **Phase 2 优先级**: 根据 PHASE2-PLAN.md，优先实现用户体验相关功能（实时日志、监控、UI）
2. **技术栈确认**: 等待人类确认 React 18 技术栈决策（见 QUESTIONS.md Q002）
3. **数据库策略**: 等待人类确认多租户隔离策略（见 QUESTIONS.md Q004）
4. **资源管理**: 所有任务都需要考虑 AgentSphere SDK 的限制和最佳实践
5. **测试覆盖**: 保持 80%+ 的测试覆盖率标准