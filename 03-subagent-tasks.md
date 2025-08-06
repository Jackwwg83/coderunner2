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

## 后续阶段 (占位)

- **Phase 2**: 增加对数据库“应用装置”的编排能力。
- **Phase 3**: 构建 Web 管理控制台。