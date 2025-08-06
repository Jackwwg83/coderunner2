import { QueryResult, PoolClient } from 'pg';
import { DatabaseService } from '../../src/services/database';
import { User, Project, Deployment, TransactionClient } from '../../src/types';
import { mockUsers, mockProjects, mockDeployments } from '../fixtures';

/**
 * Mock implementations for DatabaseService for unit testing
 */

export interface MockQueryResult {
  rows: any[];
  rowCount: number;
  command?: string;
  oid?: number;
  fields?: any[];
}

export class MockDatabaseService {
  private static mockData = {
    users: new Map<string, User>(),
    projects: new Map<string, Project>(),
    deployments: new Map<string, Deployment>()
  };

  private static isConnected = false;

  // Initialize with test data
  static initializeTestData(): void {
    this.mockData.users.clear();
    this.mockData.projects.clear();
    this.mockData.deployments.clear();

    // Add mock users
    Object.values(mockUsers).forEach(user => {
      this.mockData.users.set(user.id, user);
    });

    // Add mock projects
    Object.values(mockProjects).forEach(project => {
      this.mockData.projects.set(project.id, project);
    });

    // Add mock deployments
    Object.values(mockDeployments).forEach(deployment => {
      this.mockData.deployments.set(deployment.id, deployment);
    });
  }

  static clearTestData(): void {
    this.mockData.users.clear();
    this.mockData.projects.clear();
    this.mockData.deployments.clear();
  }

  static createMockQueryResult<T>(rows: T[], command: string = 'SELECT'): MockQueryResult {
    return {
      rows,
      rowCount: rows.length,
      command,
      oid: 0,
      fields: []
    };
  }

  static createSuccessfulMockQuery(): jest.MockedFunction<(text: string, params?: any[]) => Promise<QueryResult>> {
    return jest.fn().mockImplementation(async (text: string, params?: any[]) => {
      // Simple mock query logic based on SQL patterns
      if (text.includes('SELECT NOW()')) {
        return this.createMockQueryResult([{ current_time: new Date(), pg_version: 'PostgreSQL 13.0' }]);
      }

      if (text.includes('SELECT table_name FROM information_schema.tables')) {
        return this.createMockQueryResult([
          { table_name: 'users' },
          { table_name: 'projects' },
          { table_name: 'deployments' }
        ]);
      }

      if (text.includes('SELECT * FROM users WHERE id =')) {
        const userId = params?.[0];
        const user = this.mockData.users.get(userId);
        return this.createMockQueryResult(user ? [user] : []);
      }

      if (text.includes('SELECT * FROM users WHERE email =')) {
        const email = params?.[0];
        const user = Array.from(this.mockData.users.values()).find(u => u.email === email);
        return this.createMockQueryResult(user ? [user] : []);
      }

      if (text.includes('INSERT INTO users')) {
        const newUser = {
          id: 'new-user-id',
          email: params?.[0],
          password_hash: params?.[1],
          plan_type: params?.[2] || 'free',
          created_at: new Date(),
          updated_at: new Date()
        };
        this.mockData.users.set(newUser.id, newUser);
        return this.createMockQueryResult([newUser], 'INSERT');
      }

      // Default empty result
      return this.createMockQueryResult([]);
    });
  }

  static createFailingMockQuery(errorMessage: string = 'Mock database error'): jest.MockedFunction<(text: string, params?: any[]) => Promise<QueryResult>> {
    return jest.fn().mockRejectedValue(new Error(errorMessage));
  }

  static createMockPoolClient(): Partial<PoolClient> {
    return {
      query: this.createSuccessfulMockQuery(),
      release: jest.fn(),
    };
  }

  static createMockTransactionClient(): TransactionClient {
    return {
      query: async (text: string, params?: any[]) => {
        const result = await this.createSuccessfulMockQuery()(text, params);
        return {
          rows: result.rows,
          rowCount: result.rowCount || 0,
          command: result.command || 'SELECT',
          oid: result.oid || 0,
          fields: result.fields || []
        };
      }
    };
  }
}

// Jest mock functions for DatabaseService methods
export const createMockDatabaseService = () => {
  const mockDb = {
    // Connection methods
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    gracefulShutdown: jest.fn().mockResolvedValue(undefined),
    isConnected: jest.fn().mockReturnValue(true),
    initialize: jest.fn().mockResolvedValue(undefined),
    
    // Health and info
    healthCheck: jest.fn().mockResolvedValue({
      status: 'healthy',
      details: {
        timestamp: new Date(),
        version: 'PostgreSQL 13.0',
        responseTime: '5ms',
        pool: { totalCount: 5, idleCount: 3, waitingCount: 0 },
        connections: { total: 5, idle: 3, waiting: 0 }
      }
    }),
    getPoolInfo: jest.fn().mockReturnValue({
      totalCount: 5,
      idleCount: 3,
      waitingCount: 0,
      connectedClients: 2
    }),

    // Query methods
    query: MockDatabaseService.createSuccessfulMockQuery(),
    getClient: jest.fn().mockResolvedValue(MockDatabaseService.createMockPoolClient()),
    executeInTransaction: jest.fn().mockImplementation(async (callback) => {
      return await callback(MockDatabaseService.createMockTransactionClient());
    }),
    transaction: jest.fn().mockImplementation(async (callback) => {
      return await callback(MockDatabaseService.createMockPoolClient());
    }),

    // User methods
    createUser: jest.fn().mockResolvedValue(mockUsers.validUser),
    getUserById: jest.fn().mockResolvedValue(mockUsers.validUser),
    getUserByEmail: jest.fn().mockResolvedValue(mockUsers.validUser),
    updateUser: jest.fn().mockResolvedValue(mockUsers.validUser),
    deleteUser: jest.fn().mockResolvedValue(true),
    getUsers: jest.fn().mockResolvedValue({
      users: [mockUsers.validUser],
      total: 1
    }),

    // Project methods
    createProject: jest.fn().mockResolvedValue(mockProjects.userProject),
    getProjectById: jest.fn().mockResolvedValue(mockProjects.userProject),
    getProjectsByUserId: jest.fn().mockResolvedValue({
      projects: [mockProjects.userProject],
      total: 1
    }),
    updateProject: jest.fn().mockResolvedValue(mockProjects.userProject),
    deleteProject: jest.fn().mockResolvedValue(true),
    getProjectWithUser: jest.fn().mockResolvedValue({
      ...mockProjects.userProject,
      user: mockUsers.validUser
    }),

    // Deployment methods
    createDeployment: jest.fn().mockResolvedValue(mockDeployments.pendingDeployment),
    getDeploymentById: jest.fn().mockResolvedValue(mockDeployments.runningDeployment),
    getDeploymentsByProjectId: jest.fn().mockResolvedValue({
      deployments: [mockDeployments.runningDeployment],
      total: 1
    }),
    updateDeploymentStatus: jest.fn().mockResolvedValue(mockDeployments.runningDeployment),
    updateDeployment: jest.fn().mockResolvedValue(mockDeployments.runningDeployment),
    deleteDeployment: jest.fn().mockResolvedValue(true),
    getDeploymentWithDetails: jest.fn().mockResolvedValue({
      ...mockDeployments.runningDeployment,
      project: {
        ...mockProjects.userProject,
        user: mockUsers.validUser
      }
    }),
    getDeploymentsByStatus: jest.fn().mockResolvedValue({
      deployments: [mockDeployments.runningDeployment],
      total: 1
    }),
    getRunningDeploymentCountByUser: jest.fn().mockResolvedValue(1),

    // Analytics
    getSystemStats: jest.fn().mockResolvedValue({
      totalUsers: 3,
      totalProjects: 4,
      totalDeployments: 4,
      runningDeployments: 1,
      deploymentsByStatus: {
        PENDING: 1,
        RUNNING: 1,
        FAILED: 1,
        STOPPED: 1
      }
    })
  };

  return mockDb;
};

// Helper to mock DatabaseService.getInstance()
export const mockDatabaseServiceInstance = () => {
  const mockDb = createMockDatabaseService();
  jest.spyOn(DatabaseService, 'getInstance').mockReturnValue(mockDb as any);
  return mockDb;
};

// Reset function for test cleanup
export const resetDatabaseMocks = () => {
  jest.restoreAllMocks();
  MockDatabaseService.clearTestData();
};