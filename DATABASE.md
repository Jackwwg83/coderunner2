# 🗃️ CodeRunner DatabaseService Documentation

Complete implementation of the DatabaseService for CodeRunner Phase 0 (Task P0-T02).

## 📋 Overview

The DatabaseService provides a comprehensive, type-safe interface to interact with the CodeRunner PostgreSQL database. It implements all required CRUD operations for users, projects, and deployments with connection pooling, transactions, and error handling.

## 🏗️ Architecture

### Core Components

- **DatabaseService** - Singleton service managing all database operations
- **Connection Pool** - Optimized PostgreSQL connection pool (min: 2, max: 10)  
- **Migration System** - Automated schema management
- **Type Safety** - Full TypeScript type definitions
- **Transaction Support** - ACID compliant transaction handling

### Database Schema

```sql
users (id, email, password_hash, plan_type, created_at, updated_at)
projects (id, user_id, name, description, created_at, updated_at)
deployments (id, project_id, app_sandbox_id, public_url, db_sandbox_id, 
             db_connection_info, status, runtime_type, created_at, updated_at)
```

## 🚀 Quick Start

### 1. Environment Setup

```bash
# Set database connection (choose one method)

# Method 1: Single DATABASE_URL
export DATABASE_URL="postgresql://user:pass@localhost:5432/coderunner"

# Method 2: Individual variables
export DB_HOST="localhost"
export DB_PORT="5432"
export DB_NAME="coderunner"
export DB_USER="postgres"
export DB_PASSWORD="your_password"
```

### 2. Install Dependencies

```bash
npm install pg @types/pg uuid @types/uuid
```

### 3. Run Migrations

```bash
# Run all pending migrations
npm run migrate

# Check migration status
npm run migrate:status

# Create new migration
npm run migrate:create "add new feature table"
```

### 4. Test Connection

```bash
# Health check
npm run db:health
```

## 💻 Usage Examples

### Basic Usage

```typescript
import { DatabaseService } from './src/services/database';

const db = DatabaseService.getInstance();

// Connect and initialize
await db.connect();
await db.initialize();

// Use the database
const user = await db.createUser({
  email: 'user@example.com',
  password_hash: 'hashed_password',
  plan_type: 'free'
});

// Always disconnect when done
await db.disconnect();
```

### User Operations

```typescript
// Create user
const newUser = await db.createUser({
  email: 'john@example.com',
  password_hash: await bcrypt.hash('password', 10),
  plan_type: 'personal'
});

// Get user by ID or email
const user = await db.getUserById(userId);
const userByEmail = await db.getUserByEmail('john@example.com');

// Update user
const updatedUser = await db.updateUser(userId, {
  plan_type: 'team'
});

// Get users with pagination
const { users, total } = await db.getUsers(50, 0);

// Delete user (cascades to projects and deployments)
await db.deleteUser(userId);
```

### Project Operations

```typescript
// Create project
const project = await db.createProject({
  user_id: userId,
  name: 'My Web App',
  description: 'A cool web application'
});

// Get user's projects
const { projects, total } = await db.getProjectsByUserId(userId);

// Update project
await db.updateProject(projectId, {
  description: 'Updated description'
});

// Get project with user info
const projectWithUser = await db.getProjectWithUser(projectId);
```

### Deployment Operations

```typescript
import { DeploymentStatus } from './src/types';

// Create deployment
const deployment = await db.createDeployment({
  project_id: projectId,
  app_sandbox_id: 'sandbox_abc123',
  public_url: 'https://myapp.coderunner.dev',
  runtime_type: 'nodejs',
  status: DeploymentStatus.PENDING
});

// Update deployment status
await db.updateDeploymentStatus(deploymentId, DeploymentStatus.RUNNING);

// Get deployment with full details
const deploymentDetails = await db.getDeploymentWithDetails(deploymentId);

// Get deployments by status
const { deployments } = await db.getDeploymentsByStatus(
  DeploymentStatus.RUNNING
);
```

### Transaction Support

```typescript
// Method 1: executeInTransaction (recommended)
await db.executeInTransaction(async (client) => {
  const user = await client.query(
    'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING *',
    ['user@example.com', 'hash']
  );
  
  await client.query(
    'INSERT INTO projects (user_id, name) VALUES ($1, $2)',
    [user.rows[0].id, 'New Project']
  );
});

// Method 2: Manual transaction control
const client = await db.beginTransaction();
try {
  // Your queries here
  await db.commitTransaction(client);
} catch (error) {
  await db.rollbackTransaction(client);
  throw error;
}
```

## 📊 Monitoring & Health

### Health Check

```typescript
const health = await db.healthCheck();
console.log(health);
// {
//   status: 'healthy',
//   details: {
//     timestamp: '2024-01-01T12:00:00Z',
//     version: 'PostgreSQL 15.3',
//     responseTime: '15ms',
//     pool: { totalCount: 5, idleCount: 3, waitingCount: 0 }
//   }
// }
```

### Pool Monitoring

```typescript
const poolInfo = db.getPoolInfo();
console.log(poolInfo);
// {
//   totalCount: 5,
//   idleCount: 3,
//   waitingCount: 0,
//   connectedClients: 2
// }
```

### System Statistics

```typescript
const stats = await db.getSystemStats();
console.log(stats);
// {
//   totalUsers: 150,
//   totalProjects: 423,
//   totalDeployments: 1205,
//   runningDeployments: 89,
//   deploymentsByStatus: {
//     'RUNNING': 89,
//     'PENDING': 12,
//     'FAILED': 3,
//     'STOPPED': 15
//   }
// }
```

## ⚙️ Configuration

### Environment Variables

```bash
# Database Connection
DATABASE_URL=postgresql://user:pass@host:port/db
# OR individual variables:
DB_HOST=localhost
DB_PORT=5432
DB_NAME=coderunner
DB_USER=postgres
DB_PASSWORD=password
DB_SSL=false

# Connection Pool
DB_POOL_MIN=2                  # Minimum connections (default: 2)
DB_POOL_MAX=10                 # Maximum connections (default: 10)
DB_IDLE_TIMEOUT=30000          # Idle timeout in ms (default: 30s)
DB_CONNECTION_TIMEOUT=2000     # Connection timeout (default: 2s)
DB_ACQUIRE_TIMEOUT=60000       # Acquire timeout (default: 60s)
DB_CREATE_TIMEOUT=3000         # Create timeout (default: 3s)
DB_DESTROY_TIMEOUT=5000        # Destroy timeout (default: 5s)
DB_REAP_INTERVAL=1000          # Reap interval (default: 1s)
```

### Production Recommendations

```bash
# Production database URL with SSL
DATABASE_URL="postgresql://user:pass@prod-host:5432/coderunner?ssl=true&sslmode=require"

# Larger connection pool for production
DB_POOL_MIN=5
DB_POOL_MAX=25

# Monitoring
NODE_ENV=production
```

## 🔧 Migration System

### Available Commands

```bash
# Run migrations
npm run migrate              # Apply all pending migrations
npm run migrate:status       # Show migration status
npm run migrate:create "name" # Create new migration file

# Database utilities
npm run db:init             # Initialize database (alias for migrate)
npm run db:health           # Health check
```

### Creating Migrations

```bash
npm run migrate:create "add user preferences table"
```

This creates: `src/migrations/20240101120000_add_user_preferences_table.sql`

```sql
-- Migration: add user preferences table
-- Created: 2024-01-01T12:00:00.000Z
-- Description: Add your migration description here

CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    preferences JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
```

### Migration Features

- ✅ **Automatic checksums** - Prevents accidental changes to applied migrations
- ✅ **Transaction safety** - Each migration runs in a transaction
- ✅ **Rollback support** - Automatic rollback on migration failure
- ✅ **Dependency tracking** - Migrations applied in correct order
- ✅ **Integrity validation** - Validates previously applied migrations

## 🛡️ Error Handling

### Common Errors

```typescript
try {
  await db.createUser({ email: 'existing@example.com', password_hash: 'hash' });
} catch (error) {
  if (error.message.includes('already exists')) {
    // Handle duplicate email
  }
}
```

### Connection Errors

```typescript
try {
  await db.connect();
} catch (error) {
  console.error('Database connection failed:', error.message);
  // Implement retry logic or fallback
}
```

### Transaction Errors

```typescript
try {
  await db.executeInTransaction(async (client) => {
    // Transaction operations
  });
} catch (error) {
  // Transaction automatically rolled back
  console.error('Transaction failed:', error.message);
}
```

## 🔒 Security Features

- **SQL Injection Protection** - Parameterized queries only
- **Password Hashing** - Never store plaintext passwords
- **Connection Encryption** - SSL/TLS support in production
- **Input Validation** - Database constraints and checks
- **Row-Level Security** - Ready for RLS implementation
- **Graceful Shutdown** - Proper connection cleanup

## 📈 Performance Features

- **Connection Pooling** - Efficient connection reuse
- **Query Optimization** - Indexed queries and slow query logging
- **Batch Operations** - Parallel query execution where possible
- **Prepared Statements** - Automatic query plan caching
- **Health Monitoring** - Real-time performance metrics

## 🧪 Testing

### Run Example

```bash
# Full demo with all operations
ts-node src/examples/database-example.ts demo

# Error handling demonstration
ts-node src/examples/database-example.ts error

# Migration examples
ts-node src/examples/database-example.ts migrations
```

### Manual Testing

```bash
# Test connection
npm run db:health

# Check migration status
npm run migrate:status

# Test with actual data
ts-node -e "
import { DatabaseService } from './src/services/database';
const db = DatabaseService.getInstance();
db.connect().then(() => db.getSystemStats()).then(console.log).finally(() => db.disconnect());
"
```

## 🚨 Troubleshooting

### Common Issues

1. **Connection timeout**: Check DATABASE_URL and PostgreSQL status
2. **Migration fails**: Ensure database exists and user has permissions
3. **Pool exhaustion**: Monitor pool usage with `getPoolInfo()`
4. **Slow queries**: Check logs for queries taking >1000ms

### Debug Mode

```bash
# Enable detailed logging
DEBUG=pg:* npm run dev

# Check pool status
ts-node -e "
import { DatabaseService } from './src/services/database';
const db = DatabaseService.getInstance();
db.connect().then(() => console.log(db.getPoolInfo())).finally(() => db.disconnect());
"
```

## 📚 API Reference

### Core Methods

- `connect()` - Initialize connection pool
- `initialize()` - Verify database schema
- `disconnect()` - Graceful shutdown
- `healthCheck()` - Database health status
- `query(sql, params)` - Execute raw query
- `executeInTransaction(callback)` - Transaction wrapper

### User Operations

- `createUser(input)` - Create new user
- `getUserById(id)` - Get user by ID
- `getUserByEmail(email)` - Get user by email
- `updateUser(id, updates)` - Update user
- `deleteUser(id)` - Delete user
- `getUsers(limit, offset)` - Get users with pagination

### Project Operations

- `createProject(input)` - Create new project
- `getProjectById(id)` - Get project by ID
- `getProjectsByUserId(userId, limit, offset)` - Get user's projects
- `updateProject(id, updates)` - Update project
- `deleteProject(id)` - Delete project
- `getProjectWithUser(id)` - Get project with user details

### Deployment Operations

- `createDeployment(input)` - Create new deployment
- `getDeploymentById(id)` - Get deployment by ID
- `getDeploymentsByProjectId(projectId, limit, offset)` - Get project's deployments
- `updateDeploymentStatus(id, status)` - Update deployment status
- `updateDeployment(id, updates)` - Update deployment
- `deleteDeployment(id)` - Delete deployment
- `getDeploymentWithDetails(id)` - Get deployment with full details
- `getDeploymentsByStatus(status, limit, offset)` - Get deployments by status
- `getRunningDeploymentCountByUser(userId)` - Get user's running deployments

### Analytics

- `getSystemStats()` - System-wide statistics

## 🎯 Phase 0 Completion

✅ **Task P0-T02: DatabaseService Implementation**

- [x] Complete DatabaseService with connection pool management
- [x] All user CRUD operations with type safety
- [x] All project CRUD operations with foreign key support
- [x] All deployment CRUD operations with ENUM status handling
- [x] Transaction support (manual and automatic)
- [x] Database initialization and health checks
- [x] Migration system with integrity validation
- [x] Environment variable configuration
- [x] Graceful shutdown and error handling
- [x] Connection pool monitoring and optimization
- [x] Comprehensive documentation and examples

The DatabaseService is production-ready and fully implements the Phase 0 requirements according to the database schema specification.

---

📝 **Last Updated**: January 2024  
🔗 **Schema Reference**: [04-database-schema.md](./04-database-schema.md)  
🎯 **Phase**: P0-T02 (Complete)