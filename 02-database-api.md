# 💾 CodeRunner 数据库与API规范

> **AI专用**：数据库架构和API接口的完整技术规范

## 📊 数据库架构

### 概览
- **数据库**: PostgreSQL 14+
- **总表数**: 21个
- **索引策略**: 覆盖所有外键和常用查询
- **分区策略**: logs和metrics表按月分区

### 核心表结构

#### 1. 用户管理

```sql
-- users表：用户基础信息
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100),
    avatar_url VARCHAR(500),
    role VARCHAR(50) DEFAULT 'user',
    status VARCHAR(50) DEFAULT 'active',
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP,
    
    INDEX idx_users_email (email),
    INDEX idx_users_status (status),
    INDEX idx_users_created_at (created_at)
);

-- user_sessions表：会话管理
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_sessions_user_id (user_id),
    INDEX idx_sessions_token (token_hash),
    INDEX idx_sessions_expires (expires_at)
);

-- api_keys表：API密钥
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100),
    permissions JSONB DEFAULT '[]',
    last_used_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_api_keys_user_id (user_id),
    INDEX idx_api_keys_hash (key_hash)
);
```

#### 2. 部署管理

```sql
-- deployments表：部署记录
CREATE TABLE deployments (
    id VARCHAR(100) PRIMARY KEY, -- dep_timestamp_random格式
    user_id UUID NOT NULL REFERENCES users(id),
    project_id UUID REFERENCES projects(id),
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    endpoint VARCHAR(500),
    runtime VARCHAR(50),
    config JSONB,
    error_message TEXT,
    deployed_at TIMESTAMP,
    stopped_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_deployments_user_id (user_id),
    INDEX idx_deployments_status (status),
    INDEX idx_deployments_created_at (created_at)
);

-- deployment_versions表：部署版本
CREATE TABLE deployment_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id VARCHAR(100) REFERENCES deployments(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    commit_hash VARCHAR(100),
    files JSONB NOT NULL,
    config JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(deployment_id, version_number),
    INDEX idx_versions_deployment_id (deployment_id)
);

-- deployment_logs表：部署日志（分区表）
CREATE TABLE deployment_logs (
    id BIGSERIAL,
    deployment_id VARCHAR(100) NOT NULL,
    level VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- 创建月度分区
CREATE TABLE deployment_logs_2024_01 PARTITION OF deployment_logs
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

#### 3. 沙箱管理

```sql
-- sandboxes表：沙箱实例
CREATE TABLE sandboxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id VARCHAR(100) REFERENCES deployments(id),
    agentsphere_id VARCHAR(255) UNIQUE,
    status VARCHAR(50) NOT NULL,
    resources JSONB,
    started_at TIMESTAMP,
    stopped_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_sandboxes_deployment_id (deployment_id),
    INDEX idx_sandboxes_status (status)
);

-- sandbox_metrics表：沙箱指标（分区表）
CREATE TABLE sandbox_metrics (
    id BIGSERIAL,
    sandbox_id UUID NOT NULL,
    cpu_usage DECIMAL(5,2),
    memory_usage DECIMAL(5,2),
    disk_usage DECIMAL(5,2),
    network_in BIGINT,
    network_out BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
```

#### 4. 项目管理

```sql
-- projects表：项目信息
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50),
    repository_url VARCHAR(500),
    default_config JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, name),
    INDEX idx_projects_user_id (user_id)
);

-- project_files表：项目文件
CREATE TABLE project_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    path VARCHAR(500) NOT NULL,
    content TEXT,
    size INTEGER,
    hash VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(project_id, path),
    INDEX idx_files_project_id (project_id)
);
```

#### 5. 订阅与计费

```sql
-- subscriptions表：订阅信息
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    plan_id VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_subscriptions_user_id (user_id),
    INDEX idx_subscriptions_status (status)
);

-- usage_records表：使用记录
CREATE TABLE usage_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    resource_type VARCHAR(50) NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit VARCHAR(20),
    period_start TIMESTAMP,
    period_end TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_usage_user_id (user_id),
    INDEX idx_usage_period (period_start, period_end)
);
```

### 数据库优化策略

```yaml
索引策略:
  - 所有外键自动创建索引
  - 常用查询字段创建复合索引
  - 使用部分索引优化特定查询
  
分区策略:
  - deployment_logs按月分区
  - sandbox_metrics按月分区
  - 自动创建新分区脚本
  
性能优化:
  - 连接池: min=10, max=100
  - 查询超时: 30秒
  - 慢查询日志: >1秒
  - 定期VACUUM和ANALYZE
```

---

## 🚀 API规范

### API设计原则
- RESTful设计
- JSON请求/响应
- JWT认证
- 版本化URL(/api/v1)
- 统一错误格式

### 认证机制

```typescript
// JWT Token结构
interface JWTPayload {
  sub: string;      // user_id
  email: string;
  role: string;
  iat: number;
  exp: number;
}

// 认证头
Headers: {
  'Authorization': 'Bearer <jwt_token>'
}

// API Key认证（可选）
Headers: {
  'X-API-Key': '<api_key>'
}
```

### 核心API端点

#### 1. 认证相关 API

```typescript
// 用户注册
POST /api/v1/auth/register
Body: {
  email: string;
  password: string;
  name?: string;
}
Response: {
  user: User;
  tokens: {
    access: string;
    refresh: string;
  }
}

// 用户登录
POST /api/v1/auth/login
Body: {
  email: string;
  password: string;
}
Response: {
  user: User;
  tokens: {
    access: string;
    refresh: string;
  }
}

// 刷新Token
POST /api/v1/auth/refresh
Body: {
  refresh_token: string;
}
Response: {
  access: string;
  refresh: string;
}

// 登出
POST /api/v1/auth/logout
Headers: { Authorization: 'Bearer <token>' }
Response: { success: true }
```

#### 2. 部署相关 API

```typescript
// 创建部署 ⭐ 核心API
POST /api/v1/deployments
Headers: { Authorization: 'Bearer <token>' }
Body: {
  name: string;
  files: Array<{
    path: string;
    content: string;
  }>;
  runtime?: 'nodejs' | 'python' | 'manifest';
  config?: {
    env_vars?: Record<string, string>;
    build_command?: string;
    start_command?: string;
  };
}
Response: {
  deployment: {
    id: string;          // dep_xxx格式
    name: string;
    status: 'pending';
    endpoint: string;    // https://dep_xxx.coderunner.io
    created_at: string;
  }
}

// 获取部署列表
GET /api/v1/deployments
Query: {
  page?: number;
  limit?: number;
  status?: string;
}
Response: {
  deployments: Deployment[];
  pagination: {
    total: number;
    page: number;
    pages: number;
  }
}

// 获取部署详情
GET /api/v1/deployments/:id
Response: {
  deployment: Deployment;
  metrics?: Metrics;
  logs?: LogEntry[];
}

// 更新部署
PATCH /api/v1/deployments/:id
Body: {
  name?: string;
  config?: object;
}
Response: {
  deployment: Deployment;
}

// 停止部署
POST /api/v1/deployments/:id/stop
Response: {
  deployment: {
    id: string;
    status: 'stopping';
  }
}

// 重启部署
POST /api/v1/deployments/:id/restart
Response: {
  deployment: {
    id: string;
    status: 'restarting';
  }
}

// 删除部署
DELETE /api/v1/deployments/:id
Response: {
  success: true;
}
```

#### 3. 文件管理 API

```typescript
// 上传文件
POST /api/v1/files/upload
Headers: { 
  'Content-Type': 'multipart/form-data'
}
Body: FormData {
  files: File[];
  project_id?: string;
}
Response: {
  files: Array<{
    id: string;
    path: string;
    size: number;
    url: string;
  }>
}

// 下载文件
GET /api/v1/files/:id/download
Response: Binary file data

// 获取文件列表
GET /api/v1/projects/:id/files
Response: {
  files: FileInfo[];
}
```

#### 4. 日志 API

```typescript
// 获取部署日志
GET /api/v1/deployments/:id/logs
Query: {
  level?: 'debug' | 'info' | 'warn' | 'error';
  start_time?: string;
  end_time?: string;
  limit?: number;
}
Response: {
  logs: Array<{
    timestamp: string;
    level: string;
    message: string;
    metadata?: object;
  }>
}

// 实时日志流（WebSocket）
WS /api/v1/deployments/:id/logs/stream
Message: {
  type: 'subscribe' | 'unsubscribe';
}
Response: {
  type: 'log';
  data: LogEntry;
}
```

#### 5. 监控指标 API

```typescript
// 获取部署指标
GET /api/v1/deployments/:id/metrics
Query: {
  metrics?: string[];  // cpu,memory,requests
  period?: '1h' | '24h' | '7d';
  resolution?: '1m' | '5m' | '1h';
}
Response: {
  metrics: {
    cpu: TimeSeries[];
    memory: TimeSeries[];
    requests: TimeSeries[];
  }
}

// 获取聚合指标
GET /api/v1/metrics/summary
Response: {
  total_deployments: number;
  active_deployments: number;
  total_requests: number;
  error_rate: number;
}
```

### 错误响应格式

```typescript
// 统一错误格式
{
  error: {
    code: string;        // 错误代码
    message: string;     // 用户友好的消息
    details?: any;       // 详细错误信息
    request_id: string;  // 请求追踪ID
  }
}

// 常见错误代码
400 Bad Request: {
  code: 'VALIDATION_ERROR',
  message: 'Invalid input data'
}

401 Unauthorized: {
  code: 'UNAUTHORIZED',
  message: 'Authentication required'
}

403 Forbidden: {
  code: 'FORBIDDEN',
  message: 'Insufficient permissions'
}

404 Not Found: {
  code: 'NOT_FOUND',
  message: 'Resource not found'
}

429 Too Many Requests: {
  code: 'RATE_LIMITED',
  message: 'Too many requests',
  details: {
    retry_after: 60
  }
}

500 Internal Server Error: {
  code: 'INTERNAL_ERROR',
  message: 'An error occurred'
}
```

### WebSocket事件

```typescript
// 连接建立
ws.on('connection', () => {
  // 发送认证
  ws.send({
    type: 'auth',
    token: '<jwt_token>'
  })
})

// 订阅部署更新
ws.send({
  type: 'subscribe',
  channel: 'deployment:dep_xxx'
})

// 接收更新
ws.on('message', (data) => {
  // data.type: 'update' | 'log' | 'metric'
  // data.channel: 'deployment:dep_xxx'
  // data.payload: 实际数据
})

// 取消订阅
ws.send({
  type: 'unsubscribe',
  channel: 'deployment:dep_xxx'
})
```

### API速率限制

```yaml
默认限制:
  匿名用户:
    - 10 请求/分钟
    - 100 请求/小时
  
  免费用户:
    - 60 请求/分钟
    - 1000 请求/小时
    - 10 部署/天
  
  付费用户:
    - 300 请求/分钟
    - 10000 请求/小时
    - 100 部署/天
  
  企业用户:
    - 无限制

限制头:
  X-RateLimit-Limit: 60
  X-RateLimit-Remaining: 45
  X-RateLimit-Reset: 1640995200
```

### API版本管理

```typescript
// 版本在URL中
/api/v1/...  // 当前版本
/api/v2/...  // 未来版本

// 版本废弃通知
Headers: {
  'X-API-Version': 'v1',
  'X-API-Deprecation-Date': '2024-12-31',
  'X-API-Sunset-Date': '2025-03-31'
}
```

---

## 🔐 数据安全

### 加密策略
```yaml
传输加密:
  - HTTPS/TLS 1.3
  - WSS for WebSocket
  
存储加密:
  - 密码: bcrypt (rounds=12)
  - Token: SHA256
  - 敏感数据: AES-256
  
密钥管理:
  - 环境变量存储
  - Vault集成（生产）
  - 定期轮换
```

### 数据备份
```yaml
备份策略:
  - 全量备份: 每天凌晨
  - 增量备份: 每小时
  - 保留期限: 30天
  - 异地备份: S3
  
恢复目标:
  - RPO: 1小时
  - RTO: 4小时
```

---

## 📈 性能基准

### 查询性能目标
```sql
-- 用户登录查询 < 10ms
SELECT * FROM users WHERE email = ? LIMIT 1;

-- 部署列表查询 < 50ms
SELECT * FROM deployments 
WHERE user_id = ? 
ORDER BY created_at DESC 
LIMIT 20;

-- 日志查询 < 100ms（使用分区）
SELECT * FROM deployment_logs 
WHERE deployment_id = ? 
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

### API性能目标
```yaml
响应时间(P95):
  - 认证API: < 100ms
  - 部署API: < 500ms
  - 文件上传: < 2s (10MB)
  - 日志查询: < 200ms
  
吞吐量:
  - 认证: 1000 req/s
  - 部署: 100 req/s
  - 日志写入: 10000 req/s
```

---

## 🎯 使用示例

### 创建部署的完整流程
```typescript
// 1. 登录获取Token
const loginRes = await fetch('/api/v1/auth/login', {
  method: 'POST',
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123'
  })
});
const { tokens } = await loginRes.json();

// 2. 创建部署
const deployRes = await fetch('/api/v1/deployments', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${tokens.access}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'my-app',
    files: [
      { path: 'index.js', content: 'console.log("Hello")' },
      { path: 'package.json', content: '{"name":"my-app"}' }
    ],
    runtime: 'nodejs'
  })
});
const { deployment } = await deployRes.json();

// 3. 监听部署状态
const ws = new WebSocket('wss://api.coderunner.io/ws');
ws.send({
  type: 'subscribe',
  channel: `deployment:${deployment.id}`
});

// 4. 查看日志
const logsRes = await fetch(`/api/v1/deployments/${deployment.id}/logs`);
const { logs } = await logsRes.json();
```