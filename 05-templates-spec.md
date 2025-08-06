# 📦 CodeRunner 应用装置模板规格 (v1.0)

> **AI专用**: 本文档为 `devops-automator` 或 AgentSphere 平台团队提供了构建 CodeRunner 所需的沙箱模板的技术规格。所有模板都必须严格按照这些规格构建，以确保上层编排服务的兼容性。

## 核心原则

- **最小化**: 每个模板只包含运行其指定服务所必需的最小软件包集。
- **标准化**: 所有模板都应基于一个共同的基础镜像 (例如 Debian 12)，并遵循相似的文件系统布局。
- **无状态**: 模板自身是无状态的。所有状态都应通过环境变量注入或在运行时写入文件系统。

---

## 1. 应用运行时模板

这些模板用于直接运行用户的代码。

### 1.1. `template-nodejs-18`
- **基础系统**: Debian 12 (Slim)
- **预装软件**:
  - Node.js v18.18.0 (通过 `nvm` 或官方二进制文件安装)
  - npm v9.8.1
  - `build-essential` (用于编译原生 Node.js 模块)
  - `python3` (作为 `node-gyp` 的依赖)
- **工作目录**: `/app`
- **启动约定**: 默认启动命令将是 `npm start`。用户的 `package.json` 将被放置在 `/app` 目录下。

### 1.2. `template-python-3.10`
- **基础系统**: Debian 12 (Slim)
- **预装软件**:
  - Python v3.10.12
  - pip v23.2.1
  - `venv` (Python 标准库)
- **工作目录**: `/app`
- **启动约定**: 默认启动命令将是 `python main.py` 或由 `Procfile` 定义。用户的 `requirements.txt` 将被放置在 `/app` 目录下，并自动在 `venv` 环境中安装。

### 1.3. `template-manifest-runner`
- **基础系统**: Debian 12 (Slim)
- **预装软件**:
  - Manifest 框架的最新稳定版运行时。
  - Python 3.10+ (作为 Manifest 的依赖)。
- **工作目录**: `/app`
- **启动约定**: 模板启动时，会自动运行 `manifest` 命令，加载位于 `/app/manifest.yaml` 的配置文件，并启动其生成的服务。

---

## 2. 数据库即服务 (DBaaS) 模板

这些模板用于为用户的应用提供持久化的数据存储服务。

### 2.1. `template-postgres-15`
- **基础系统**: Debian 12 (Slim)
- **预装软件**: PostgreSQL 15
- **配置**:
  - PostgreSQL 服务配置为开机自启。
  - 监听所有网络接口 (`listen_addresses = '*'`) 以接受来自其他沙箱的连接。
  - `pg_hba.conf` 配置为允许来自指定私有网段的密码认证 (`host all all 10.0.0.0/8 md5`)。
  - **数据目录 (`/var/lib/postgresql/15/main`) 必须被配置为可挂载到 AgentSphere 的持久化存储卷**。这是确保数据不丢失的关键。
- **初始化**: 模板应包含一个初始化脚本 (`/usr/local/bin/init_db.sh`)，该脚本可以接收环境变量（`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`）来创建新的用户和数据库。

### 2.2. `template-redis-7`
- **基础系统**: Debian 12 (Slim)
- **预装软件**: Redis 7.2
- **配置**:
  - Redis 服务配置为开机自启。
  - 监听所有网络接口 (`bind 0.0.0.0`)。
  - 开启密码认证 (`requirepass`)。密码应能通过环境变量在启动时设置。
  - **数据文件 (`dump.rdb`) 必须被配置为可保存到 AgentSphere 的持久化存储卷**。

---

## 3. 工具类模板

### 3.1. `template-generic-builder`
- **基础系统**: Debian 12 (Full)
- **预装软件**: 一个丰富的编译工具集，包括但不限于：
  - `build-essential`, `cmake`
  - `git`
  - `openjdk-17-jdk` (Java)
  - `golang` (Go)
  - `rustc`, `cargo` (Rust)
- **用途**: 当 `OrchestrationService` 检测到用户的项目需要一个复杂的、非标准的编译步骤时，可以临时启动这个沙箱，在其中执行编译，然后将生成物拷贝到最终的应用运行时沙箱中。
