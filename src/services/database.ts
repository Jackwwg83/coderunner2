import { Pool, PoolClient, QueryResult } from 'pg';
import { createDatabasePool } from '../config/database';
import {
  User,
  Project,
  Deployment,
  CreateUserInput,
  UpdateUserInput,
  CreateProjectInput,
  UpdateProjectInput,
  CreateDeploymentInput,
  UpdateDeploymentInput,
  DeploymentStatus,
  TransactionClient
} from '../types';

export class DatabaseService {
  private static instance: DatabaseService;
  private pool: Pool | null = null;
  private isShuttingDown: boolean = false;

  private constructor() {
    // Set up graceful shutdown handlers
    process.on('SIGINT', this.gracefulShutdown.bind(this));
    process.on('SIGTERM', this.gracefulShutdown.bind(this));
    process.on('uncaughtException', this.gracefulShutdown.bind(this));
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * Initialize database connection pool
   */
  public async connect(): Promise<void> {
    if (this.pool) {
      console.log('Database pool already exists');
      return;
    }

    try {
      this.pool = createDatabasePool();
      
      // Test the connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW() as current_time, version() as pg_version');
      client.release();
      
      console.log('✅ Database connection established successfully');
      console.log(`📊 Pool configuration: min=${this.pool.options.min}, max=${this.pool.options.max}`);
    } catch (error) {
      console.error('❌ Failed to connect to database:', error);
      throw new Error(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Initialize database schema (run migrations)
   */
  public async initialize(): Promise<void> {
    if (!this.pool) {
      throw new Error('Database pool not initialized. Call connect() first.');
    }

    try {
      // Check if tables exist
      const tablesExist = await this.checkTablesExist();
      if (!tablesExist) {
        console.log('⚠️ Database tables not found. Please run migrations first.');
        console.log('Run: npm run migrate');
      } else {
        console.log('✅ Database tables verified');
      }
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  /**
   * Check if required tables exist
   */
  private async checkTablesExist(): Promise<boolean> {
    const query = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'projects', 'deployments')
    `;
    
    const result = await this.query(query);
    return result.rows.length === 3;
  }

  /**
   * Health check method
   */
  public async healthCheck(): Promise<{ status: string; details: any }> {
    try {
      if (!this.pool) {
        return { status: 'error', details: { message: 'Database pool not initialized' } };
      }

      const start = Date.now();
      const result = await this.pool.query('SELECT NOW() as timestamp, version() as version');
      const responseTime = Date.now() - start;

      const poolInfo = this.getPoolInfo();
      
      return {
        status: 'healthy',
        details: {
          timestamp: result.rows[0].timestamp,
          version: result.rows[0].version,
          responseTime: `${responseTime}ms`,
          pool: poolInfo,
          connections: {
            total: poolInfo.totalCount,
            idle: poolInfo.idleCount,
            waiting: poolInfo.waitingCount
          }
        }
      };
    } catch (error) {
      return {
        status: 'error',
        details: {
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Gracefully shutdown database connections
   */
  public async gracefulShutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    console.log('🔄 Initiating graceful database shutdown...');

    try {
      if (this.pool) {
        // Wait for active connections to finish (with timeout)
        const shutdownTimeout = setTimeout(() => {
          console.log('⚠️ Forcing database pool shutdown due to timeout');
          this.pool?.end();
        }, 5000);

        await this.pool.end();
        clearTimeout(shutdownTimeout);
        this.pool = null;
        console.log('✅ Database connections closed gracefully');
      }
    } catch (error) {
      console.error('❌ Error during database shutdown:', error);
    }
  }

  /**
   * Close database connections
   */
  public async disconnect(): Promise<void> {
    await this.gracefulShutdown();
  }

  /**
   * Execute a query
   */
  public async query(text: string, params?: any[]): Promise<QueryResult> {
    if (!this.pool) {
      throw new Error('Database pool not initialized. Call connect() first.');
    }

    if (this.isShuttingDown) {
      throw new Error('Database is shutting down');
    }

    try {
      const start = Date.now();
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      // Log slow queries (>1000ms)
      if (duration > 1000) {
        console.warn(`🐌 Slow query (${duration}ms):`, text.substring(0, 100));
      }
      
      return result;
    } catch (error) {
      console.error('❌ Database query error:', {
        query: text.substring(0, 100),
        params: params ? JSON.stringify(params).substring(0, 200) : undefined,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get a database client for manual transaction management
   */
  public async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      throw new Error('Database pool not initialized. Call connect() first.');
    }

    if (this.isShuttingDown) {
      throw new Error('Database is shutting down');
    }

    return await this.pool.connect();
  }

  /**
   * Execute queries within a transaction
   */
  public async executeInTransaction<T>(callback: (client: TransactionClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      
      const transactionClient: TransactionClient = {
        query: async (text: string, params?: any[]) => {
          const result = await client.query(text, params);
          return {
            rows: result.rows,
            rowCount: result.rowCount || 0,
            command: result.command,
            oid: result.oid,
            fields: result.fields
          };
        }
      };
      
      const result = await callback(transactionClient);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Transaction rolled back:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    } finally {
      client.release();
    }
  }

  // Legacy transaction method for backward compatibility
  public async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    return this.executeInTransaction(async (transactionClient) => {
      // Create a mock PoolClient interface for backward compatibility
      const mockClient = {
        query: transactionClient.query,
        release: () => {}, // No-op since we handle release in executeInTransaction
      } as any;
      
      return callback(mockClient);
    });
  }

  /**
   * Manual transaction control methods
   */
  public async beginTransaction(): Promise<PoolClient> {
    const client = await this.getClient();
    await client.query('BEGIN');
    return client;
  }

  public async commitTransaction(client: PoolClient): Promise<void> {
    await client.query('COMMIT');
    client.release();
  }

  public async rollbackTransaction(client: PoolClient): Promise<void> {
    await client.query('ROLLBACK');
    client.release();
  }

  /**
   * Check if database is connected
   */
  public isConnected(): boolean {
    return this.pool !== null && !this.isShuttingDown;
  }

  /**
   * Get connection pool information
   */

  public getPoolInfo() {
    if (!this.pool) {
      return { totalCount: 0, idleCount: 0, waitingCount: 0 };
    }

    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
      connectedClients: this.pool.totalCount - this.pool.idleCount
    };
  }

  // ========================================
  // USER OPERATIONS
  // ========================================

  /**
   * Create a new user
   */
  public async createUser(input: CreateUserInput): Promise<User> {
    const { email, password_hash, plan_type = 'free' } = input;

    const query = `
      INSERT INTO users (email, password_hash, plan_type)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    try {
      const result = await this.query(query, [email, password_hash, plan_type]);
      return result.rows[0];
    } catch (error) {
      if (error instanceof Error && error.message.includes('unique_violation')) {
        throw new Error(`User with email '${email}' already exists`);
      }
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  public async getUserById(id: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await this.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Get user by email
   */
  public async getUserByEmail(email: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await this.query(query, [email]);
    return result.rows[0] || null;
  }

  /**
   * Update user information
   */
  public async updateUser(id: string, updates: UpdateUserInput): Promise<User | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    const query = `
      UPDATE users 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    
    values.push(id);

    try {
      const result = await this.query(query, values);
      return result.rows[0] || null;
    } catch (error) {
      if (error instanceof Error && error.message.includes('unique_violation')) {
        throw new Error('Email already exists');
      }
      throw error;
    }
  }

  /**
   * Delete a user (and all associated projects and deployments)
   */
  public async deleteUser(id: string): Promise<boolean> {
    const query = 'DELETE FROM users WHERE id = $1';
    const result = await this.query(query, [id]);
    return (result.rowCount || 0) > 0;
  }

  /**
   * Get all users with pagination
   */
  public async getUsers(limit: number = 50, offset: number = 0): Promise<{ users: User[]; total: number }> {
    const countQuery = 'SELECT COUNT(*) FROM users';
    const dataQuery = `
      SELECT * FROM users 
      ORDER BY created_at DESC 
      LIMIT $1 OFFSET $2
    `;

    const [countResult, dataResult] = await Promise.all([
      this.query(countQuery),
      this.query(dataQuery, [limit, offset])
    ]);

    return {
      users: dataResult.rows,
      total: parseInt(countResult.rows[0].count)
    };
  }

  // ========================================
  // PROJECT OPERATIONS
  // ========================================

  /**
   * Create a new project
   */
  public async createProject(input: CreateProjectInput): Promise<Project> {
    const { user_id, name, description } = input;

    const query = `
      INSERT INTO projects (user_id, name, description)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    const result = await this.query(query, [user_id, name, description]);
    return result.rows[0];
  }

  /**
   * Get project by ID
   */
  public async getProjectById(id: string): Promise<Project | null> {
    const query = 'SELECT * FROM projects WHERE id = $1';
    const result = await this.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Get projects by user ID
   */
  public async getProjectsByUserId(userId: string, limit: number = 50, offset: number = 0): Promise<{ projects: Project[]; total: number }> {
    const countQuery = 'SELECT COUNT(*) FROM projects WHERE user_id = $1';
    const dataQuery = `
      SELECT * FROM projects 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `;

    const [countResult, dataResult] = await Promise.all([
      this.query(countQuery, [userId]),
      this.query(dataQuery, [userId, limit, offset])
    ]);

    return {
      projects: dataResult.rows,
      total: parseInt(countResult.rows[0].count)
    };
  }

  /**
   * Update project information
   */
  public async updateProject(id: string, updates: UpdateProjectInput): Promise<Project | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    const query = `
      UPDATE projects 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    
    values.push(id);
    const result = await this.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Delete a project (and all associated deployments)
   */
  public async deleteProject(id: string): Promise<boolean> {
    const query = 'DELETE FROM projects WHERE id = $1';
    const result = await this.query(query, [id]);
    return (result.rowCount || 0) > 0;
  }

  /**
   * Get project with user information
   */
  public async getProjectWithUser(id: string): Promise<(Project & { user: User }) | null> {
    const query = `
      SELECT 
        p.*,
        u.email as user_email,
        u.plan_type as user_plan_type,
        u.created_at as user_created_at
      FROM projects p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = $1
    `;
    
    const result = await this.query(query, [id]);
    if (!result.rows[0]) return null;
    
    const row = result.rows[0];
    return {
      ...row,
      user: {
        id: row.user_id,
        email: row.user_email,
        plan_type: row.user_plan_type,
        created_at: row.user_created_at
      }
    };
  }

  // ========================================
  // DEPLOYMENT OPERATIONS
  // ========================================

  /**
   * Create a new deployment
   */
  public async createDeployment(input: CreateDeploymentInput): Promise<Deployment> {
    const {
      project_id,
      app_sandbox_id,
      public_url,
      db_sandbox_id,
      db_connection_info,
      status = DeploymentStatus.PENDING,
      runtime_type
    } = input;

    const query = `
      INSERT INTO deployments (
        project_id, app_sandbox_id, public_url, db_sandbox_id, 
        db_connection_info, status, runtime_type
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const result = await this.query(query, [
      project_id, app_sandbox_id, public_url, db_sandbox_id,
      db_connection_info ? JSON.stringify(db_connection_info) : null,
      status, runtime_type
    ]);

    return result.rows[0];
  }

  /**
   * Get deployment by ID
   */
  public async getDeploymentById(id: string): Promise<Deployment | null> {
    const query = 'SELECT * FROM deployments WHERE id = $1';
    const result = await this.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Get deployments by project ID
   */
  public async getDeploymentsByProjectId(projectId: string, limit: number = 50, offset: number = 0): Promise<{ deployments: Deployment[]; total: number }> {
    const countQuery = 'SELECT COUNT(*) FROM deployments WHERE project_id = $1';
    const dataQuery = `
      SELECT * FROM deployments 
      WHERE project_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `;

    const [countResult, dataResult] = await Promise.all([
      this.query(countQuery, [projectId]),
      this.query(dataQuery, [projectId, limit, offset])
    ]);

    return {
      deployments: dataResult.rows,
      total: parseInt(countResult.rows[0].count)
    };
  }

  /**
   * Update deployment status
   */
  public async updateDeploymentStatus(id: string, status: DeploymentStatus): Promise<Deployment | null> {
    const query = `
      UPDATE deployments 
      SET status = $1
      WHERE id = $2
      RETURNING *
    `;
    
    const result = await this.query(query, [status, id]);
    return result.rows[0] || null;
  }

  /**
   * Update deployment information
   */
  public async updateDeployment(id: string, updates: UpdateDeploymentInput): Promise<Deployment | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === 'db_connection_info' && value !== null) {
          fields.push(`${key} = $${paramIndex}`);
          values.push(JSON.stringify(value));
        } else {
          fields.push(`${key} = $${paramIndex}`);
          values.push(value);
        }
        paramIndex++;
      }
    });

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    const query = `
      UPDATE deployments 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    
    values.push(id);
    const result = await this.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Delete a deployment
   */
  public async deleteDeployment(id: string): Promise<boolean> {
    const query = 'DELETE FROM deployments WHERE id = $1';
    const result = await this.query(query, [id]);
    return (result.rowCount || 0) > 0;
  }

  /**
   * Get deployment with project and user information
   */
  public async getDeploymentWithDetails(id: string): Promise<(Deployment & { project: Project & { user: User } }) | null> {
    const query = `
      SELECT 
        d.*,
        p.name as project_name,
        p.description as project_description,
        p.created_at as project_created_at,
        u.email as user_email,
        u.plan_type as user_plan_type
      FROM deployments d
      JOIN projects p ON d.project_id = p.id
      JOIN users u ON p.user_id = u.id
      WHERE d.id = $1
    `;
    
    const result = await this.query(query, [id]);
    if (!result.rows[0]) return null;
    
    const row = result.rows[0];
    return {
      ...row,
      project: {
        id: row.project_id,
        name: row.project_name,
        description: row.project_description,
        created_at: row.project_created_at,
        user: {
          id: row.user_id,
          email: row.user_email,
          plan_type: row.user_plan_type
        }
      }
    };
  }

  /**
   * Get deployments by status
   */
  public async getDeploymentsByStatus(status: DeploymentStatus, limit: number = 50, offset: number = 0): Promise<{ deployments: Deployment[]; total: number }> {
    const countQuery = 'SELECT COUNT(*) FROM deployments WHERE status = $1';
    const dataQuery = `
      SELECT * FROM deployments 
      WHERE status = $1 
      ORDER BY created_at ASC 
      LIMIT $2 OFFSET $3
    `;

    const [countResult, dataResult] = await Promise.all([
      this.query(countQuery, [status]),
      this.query(dataQuery, [status, limit, offset])
    ]);

    return {
      deployments: dataResult.rows,
      total: parseInt(countResult.rows[0].count)
    };
  }

  /**
   * Get running deployments count by user
   */
  public async getRunningDeploymentCountByUser(userId: string): Promise<number> {
    const query = `
      SELECT COUNT(*) 
      FROM deployments d
      JOIN projects p ON d.project_id = p.id
      WHERE p.user_id = $1 AND d.status = 'RUNNING'
    `;
    
    const result = await this.query(query, [userId]);
    return parseInt(result.rows[0].count);
  }

  // ========================================
  // ANALYTICS AND REPORTING
  // ========================================

  /**
   * Get system statistics
   */
  public async getSystemStats(): Promise<{
    totalUsers: number;
    totalProjects: number;
    totalDeployments: number;
    runningDeployments: number;
    deploymentsByStatus: { [key: string]: number };
  }> {
    const queries = [
      'SELECT COUNT(*) as count FROM users',
      'SELECT COUNT(*) as count FROM projects',
      'SELECT COUNT(*) as count FROM deployments',
      'SELECT COUNT(*) as count FROM deployments WHERE status = \'RUNNING\'',
      'SELECT status, COUNT(*) as count FROM deployments GROUP BY status'
    ];

    const results = await Promise.all(queries.map(q => this.query(q)));

    const deploymentsByStatus: { [key: string]: number } = {};
    results[4].rows.forEach((row: any) => {
      deploymentsByStatus[row.status] = parseInt(row.count);
    });

    return {
      totalUsers: parseInt(results[0].rows[0].count),
      totalProjects: parseInt(results[1].rows[0].count),
      totalDeployments: parseInt(results[2].rows[0].count),
      runningDeployments: parseInt(results[3].rows[0].count),
      deploymentsByStatus
    };
  }
}