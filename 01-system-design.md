# 📐 CodeRunner 系统设计文档 (v2.0)

> **AI专用**: 本文档是 CodeRunner 的核心技术规范，基于 **AgentSphere SDK** 和 **自定义模板** 的精简架构。所有 SubAgent 必须严格遵守此设计。

## 1. 核心架构理念

CodeRunner 是一个**业务流程编排器**，它在 AgentSphere 的 IaaS (基础设施即服务) 之上，为用户提供一个 PaaS (平台即服务) 体验。

我们的核心产品不是虚拟机，而是**“应用装置 (Appliance)”**。一个“应用装置”是一个我们预先定义和构建的 AgentSphere 沙箱模板，例如 `template-nodejs-18` 或 `template-postgres-15`。

CodeRunner 的主要职责是根据用户请求，**编排**这些“应用装置”的部署、配置和网络连接，为用户提供一个完整、可用的应用环境。

## 2. 技术栈

- **后端**: Node.js + TypeScript, Express
- **数据库 (CodeRunner自身)**: PostgreSQL
- **底层运行时**: AgentSphere (MicroVM)
- **核心依赖**: AgentSphere SDK

## 3. 精简后的系统架构图

```
┌─────────────────────────────────────────────┐
│                用户 (API / Web)               │
└─────────────────────────────────────────────┘
                      │
                      ↓
┌─────────────────────────────────────────────┐
│         CodeRunner API Service (Node.js)      │
│  - Auth Service (用户认证)                     │
│  - Orchestration Service (业务流程编排)        │
│  - Project Service (项目管理)                  │
└─────────────────────────────────────────────┘
       │                         │
       │ (状态与元数据)            │ (指令)
       ↓                         ↓
┌──────────────────┐   ┌───────────────────────────┐
│   PostgreSQL DB  │   │    AgentSphere SDK Layer  │
│ (CodeRunner自身状态) │   │ (沙箱模板实例化与管理)      │
└──────────────────┘   └───────────────────────────┘
                                 │
                                 ↓
┌──────────────────────────────────────────────────────────┐
│                 AgentSphere Cloud (IaaS)                   │
│                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ App Sandbox     │  │ DB Sandbox      │  │ ...             │  │
│  │ (基于Node.js模板) │  │ (基于Postgres模板)│  │                 │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## 4. 核心服务模块 (精简后)

原有的10个模块被大幅精简和重组。CodeRunner 的后端是一个**单体 (Monolith)** Node.js 应用，内部逻辑划分为以下服务：

### a. `AuthService` (认证服务)
- **职责**: 用户注册、登录、JWT令牌管理。
- **依赖**: `DatabaseService` (读写 `users` 表)。

### b. `ProjectService` (项目服务)
- **职责**: 管理用户的项目元数据，如项目名、源码信息等。
- **依赖**: `DatabaseService` (读写 `projects` 表)。

### c. `OrchestrationService` (编排服务)
- **职责**: **这是 CodeRunner 的大脑**。负责执行部署、销毁、重启等所有与 AgentSphere 交互的复杂工作流 (Playbooks)。
- **依赖**: `DatabaseService`, AgentSphere SDK, `ProjectAnalyzer`。

### d. `DatabaseService` (数据库服务)
- **职责**: 提供一个简单的接口，用于与 CodeRunner 自身的 PostgreSQL 数据库进行交互。封装了所有 SQL 查询。
- **依赖**: `node-postgres` (pg) 库。

### e. `ProjectAnalyzer` (项目分析器)
- **职责**: 一个纯函数工具集，用于分析用户上传的文件，以确定项目类型 (Node.js, Python, Manifest)、启动命令和所需端口。
- **依赖**: 无。

## 5. 关键工作流：部署一个带数据库的Node.js应用

这是我们核心的“部署应用装置”剧本 (Playbook)，由 `OrchestrationService` 执行：

1.  **接收请求**: 收到用户通过 API 发起的部署请求，包含代码文件和配置（例如 `runtime: 'nodejs'`, `database: 'postgres'`）。
2.  **认证用户**: 调用 `AuthService` 验证用户身份。
3.  **创建项目记录**: 调用 `ProjectService` 在 `projects` 表中创建记录。
4.  **部署数据库装置**:
    a. 调用 AgentSphere SDK，基于 `template-postgres-15` 模板实例化一个新的“数据库沙箱”。
    b. 生成一个唯一的、安全的新密码。
    c. 在数据库沙箱内执行命令，设置新密码。
    d. 获取此沙箱的内部网络地址 (`db_host`)。
    e. 调用 `DatabaseService`，在 `deployments` 表中创建一条记录，存储 `db_sandbox_id`, `db_host`, 和加密后的密码。
5.  **部署应用装置**:
    a. 调用 AgentSphere SDK，基于 `template-nodejs-18` 模板实例化一个新的“应用沙箱”。
    b. 从数据库中读取刚刚创建的数据库信息，构建 `DATABASE_URL` 连接字符串。
    c. 将 `DATABASE_URL` 作为环境变量注入到应用沙箱中。
    d. 将用户的代码上传到应用沙箱。
    e. 在应用沙箱内运行 `npm install` 和 `npm start`。
    f. 获取此应用沙箱的公网访问 URL。
    g. 调用 `DatabaseService`，更新 `deployments` 记录，存入 `app_sandbox_id` 和 `url`。
6.  **返回结果**: 将应用的公网 URL 返回给用户。

## 6. 核心设计文档链接

- **数据库 Schema**: [04-database-schema.md](./04-database-schema.md)
- **模板规格**: [05-templates-spec.md](./05-templates-spec.md)
- **任务清单**: [03-subagent-tasks.md](./03-subagent-tasks.md)

---
> **v2.0 更新说明**: 此版本彻底摒弃了原有的微服务和复杂模块划分，转向一个更务实的、围绕 AgentSphere SDK 的单体编排器架构。这大大降低了开发复杂性，并使任务能被 SubAgent 更清晰地执行。
