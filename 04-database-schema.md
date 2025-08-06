# 📄 CodeRunner 数据库 Schema (v1.0)

> **AI专用**: 本文档是 CodeRunner 内部数据库的“唯一事实源”。所有数据库相关的开发任务，都必须严格遵守此文件定义的表结构和字段。此文件由 `backend-architect` 设计并拥有。

## 核心设计理念

- **简单性**: 只存储服务运行所必需的核心元数据。
- **关系型**: 使用 PostgreSQL，通过外键明确实体间的关系。
- **安全性**: 敏感信息（如密码）在存入数据库前必须经过哈希或加密处理。

---

## SQL 定义语言 (DDL)

```sql
-- ## 表: users (用户信息) ##
-- 存储使用 CodeRunner 服务的用户信息。
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL, -- 存储哈希后的密码，绝不能存明文
    plan_type VARCHAR(50) NOT NULL DEFAULT 'free', -- e.g., 'free', 'personal', 'team'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引: 加速邮箱查找
CREATE INDEX idx_users_email ON users(email);

-- ## 表: projects (用户项目) ##
-- 存储用户创建的项目的元数据。一个项目可以有多次部署。
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- 当用户被删除时，其所有项目也被删除
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引: 加速用户项目查找
CREATE INDEX idx_projects_user_id ON projects(user_id);

-- ## 表: deployments (部署实例) ##
-- 存储项目的每一次具体部署实例。这是本系统的核心表。
CREATE TYPE deployment_status AS ENUM (
    'PENDING',      -- 正在排队等待部署
    'PROVISIONING', -- 正在创建沙箱和资源
    'BUILDING',     -- 正在安装依赖、编译代码
    'RUNNING',      -- 部署成功，正在运行
    'STOPPED',      -- 用户手动停止
    'FAILED',       -- 部署过程中发生错误
    'DESTROYED'     -- 部署已被销毁
);

CREATE TABLE deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE, -- 当项目被删除时，其所有部署也被删除

    -- 应用沙箱信息
    app_sandbox_id VARCHAR(255) UNIQUE, -- AgentSphere 返回的应用沙箱ID
    public_url VARCHAR(255) UNIQUE,     -- 应用的公开访问URL

    -- 数据库沙箱信息 (可以为 NULL，因为不是所有应用都需要数据库)
    db_sandbox_id VARCHAR(255) UNIQUE,  -- AgentSphere 返回的数据库沙箱ID
    db_connection_info JSONB,           -- 存储加密后的数据库连接信息，如 host, port, user, password

    -- 状态与配置
    status deployment_status NOT NULL DEFAULT 'PENDING',
    runtime_type VARCHAR(50),           -- e.g., 'nodejs', 'python', 'manifest'
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引: 加速项目部署查找和状态查询
CREATE INDEX idx_deployments_project_id ON deployments(project_id);
CREATE INDEX idx_deployments_status ON deployments(status);

-- 触发器: 自动更新 updated_at 时间戳 --
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_deployments_updated_at BEFORE UPDATE ON deployments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

```

---

## 字段说明

### `users` 表
- `id`: 用户唯一标识 (UUID)。
- `email`: 用户登录邮箱，唯一。
- `password_hash`: **严禁存储明文密码**。使用 `bcrypt` 或 `argon2` 进行哈希。
- `plan_type`: 用户订阅的套餐类型。

### `projects` 表
- `id`: 项目唯一标识 (UUID)。
- `user_id`: 外键，关联到 `users` 表。
- `name`: 用户定义的项目名称。

### `deployments` 表
- `id`: 部署唯一标识 (UUID)。
- `project_id`: 外键，关联到 `projects` 表。
- `app_sandbox_id`: 运行应用代码的 AgentSphere 沙箱 ID。
- `public_url`: 应用的公网访问地址，由 AgentSphere SDK 的 `get_host()` 方法返回。
- `db_sandbox_id`: (可选) 运行数据库的 AgentSphere 沙箱 ID。
- `db_connection_info`: (可选) **必须加密存储**。一个 JSON 对象，包含连接数据库所需的所有信息。
- `status`: 部署的当前状态，使用预定义的 ENUM 类型。
- `runtime_type`: 部署的应用类型，用于快速识别和过滤。
