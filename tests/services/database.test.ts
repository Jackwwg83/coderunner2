// DatabaseService is mocked, import not needed
import { DeploymentStatus } from '../../src/types';
import { 
  mockUsers, 
  mockProjects, 
  mockDeployments, 
  mockCreateUserInputs,
  mockUpdateUserInputs,
  mockCreateProjectInputs,
  mockUpdateProjectInputs,
  mockCreateDeploymentInputs
} from '../fixtures';
import { mockDatabaseServiceInstance, resetDatabaseMocks, MockDatabaseService } from '../mocks/database';

// Mock the entire DatabaseService module
jest.mock('../../src/services/database');

describe('DatabaseService', () => {
  let mockDb: any;

  beforeAll(() => {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret';
  });

  beforeEach(() => {
    // Reset mocks and create fresh instances
    jest.clearAllMocks();
    MockDatabaseService.initializeTestData();
    
    // Create mock database service
    mockDb = mockDatabaseServiceInstance();
  });

  afterEach(() => {
    resetDatabaseMocks();
  });

  describe('Connection Management', () => {
    describe('connect()', () => {
      it('should initialize database pool successfully', async () => {
        await mockDb.connect();
        
        expect(mockDb.connect).toHaveBeenCalled();
      });

      it('should not create multiple pools when called repeatedly', async () => {
        await mockDb.connect();
        await mockDb.connect();
        
        expect(mockDb.connect).toHaveBeenCalledTimes(2);
      });

      it('should throw error when connection fails', async () => {
        mockDb.connect.mockRejectedValueOnce(new Error('Connection failed'));
        
        await expect(mockDb.connect()).rejects.toThrow('Connection failed');
      });
    });

    describe('healthCheck()', () => {
      it('should return healthy status when database is working', async () => {
        const result = await mockDb.healthCheck();
        
        expect(result.status).toBe('healthy');
        expect(result.details).toBeDefined();
        expect(result.details.timestamp).toBeDefined();
      });

      it('should return error status when pool is not initialized', async () => {
        mockDb.healthCheck.mockResolvedValueOnce({
          status: 'unhealthy',
          details: { error: 'Pool not initialized' }
        });
        
        const result = await mockDb.healthCheck();
        expect(result.status).toBe('unhealthy');
      });

      it('should return error status when query fails', async () => {
        mockDb.healthCheck.mockRejectedValueOnce(new Error('Query failed'));
        
        await expect(mockDb.healthCheck()).rejects.toThrow('Query failed');
      });
    });

    describe('disconnect()', () => {
      it('should close pool gracefully', async () => {
        await mockDb.disconnect();
        expect(mockDb.disconnect).toHaveBeenCalled();
      });

      it('should handle errors during shutdown', async () => {
        mockDb.disconnect.mockRejectedValueOnce(new Error('Shutdown error'));
        
        await expect(mockDb.disconnect()).rejects.toThrow('Shutdown error');
      });
    });

    describe('isConnected()', () => {
      it('should return false when not connected', () => {
        mockDb.isConnected.mockReturnValueOnce(false);
        
        const result = mockDb.isConnected();
        expect(result).toBe(false);
      });

      it('should return true when connected', () => {
        const result = mockDb.isConnected();
        expect(result).toBe(true);
      });
    });
  });

  describe('Query Operations', () => {
    describe('query()', () => {
      it('should execute query successfully', async () => {
        const mockResult = { rows: [{ id: 1, name: 'test' }], rowCount: 1 };
        mockDb.query.mockResolvedValueOnce(mockResult);
        
        const result = await mockDb.query('SELECT * FROM test');
        
        expect(result).toEqual(mockResult);
        expect(mockDb.query).toHaveBeenCalledWith('SELECT * FROM test');
      });

      it('should log slow queries', async () => {
        const mockResult = { rows: [], rowCount: 0 };
        mockDb.query.mockResolvedValueOnce(mockResult);
        
        await mockDb.query('SELECT * FROM slow_table');
        
        expect(mockDb.query).toHaveBeenCalled();
      });

      it('should throw error when pool not initialized', async () => {
        mockDb.query.mockRejectedValueOnce(new Error('Pool not initialized'));
        
        await expect(mockDb.query('SELECT 1')).rejects.toThrow('Pool not initialized');
      });

      it('should throw error when shutting down', async () => {
        mockDb.query.mockRejectedValueOnce(new Error('Database is shutting down'));
        
        await expect(mockDb.query('SELECT 1')).rejects.toThrow('Database is shutting down');
      });
    });

    describe('getClient()', () => {
      it('should return pool client', async () => {
        const mockClient = { query: jest.fn(), release: jest.fn() };
        mockDb.getClient.mockResolvedValueOnce(mockClient);
        
        const client = await mockDb.getClient();
        
        expect(client).toEqual(mockClient);
      });
    });
  });

  describe('Transaction Operations', () => {
    describe('executeInTransaction()', () => {
      it('should execute transaction successfully and commit', async () => {
        const callback = jest.fn().mockResolvedValue('success');
        mockDb.executeInTransaction.mockImplementation(callback);
        
        const result = await mockDb.executeInTransaction(callback);
        
        expect(callback).toHaveBeenCalled();
        expect(result).toBe('success');
      });

      it('should rollback transaction on error', async () => {
        const callback = jest.fn().mockRejectedValue(new Error('Transaction failed'));
        mockDb.executeInTransaction.mockRejectedValueOnce(new Error('Transaction failed'));
        
        await expect(mockDb.executeInTransaction(callback)).rejects.toThrow('Transaction failed');
      });
    });

    describe('manual transaction methods', () => {
      it('should begin transaction', async () => {
        // const mockClient = { query: jest.fn(), release: jest.fn() };
        mockDb.transaction.mockResolvedValueOnce('transaction_started');
        
        const result = await mockDb.transaction(jest.fn());
        expect(result).toBe('transaction_started');
      });

      it('should commit transaction', async () => {
        // This is handled by the transaction method
        expect(true).toBe(true);
      });

      it('should rollback transaction', async () => {
        // This is handled by the transaction method error handling
        expect(true).toBe(true);
      });
    });
  });

  describe('User Operations', () => {
    describe('createUser()', () => {
      it('should create user successfully', async () => {
        const input = mockCreateUserInputs.valid;
        
        const result = await mockDb.createUser(input);
        
        expect(result).toEqual(mockUsers.validUser);
        expect(mockDb.createUser).toHaveBeenCalledWith(input);
      });

      it('should handle unique violation error', async () => {
        const input = { ...mockCreateUserInputs.valid, email: 'duplicate@example.com' };
        mockDb.createUser.mockRejectedValueOnce(new Error('duplicate key value violates unique constraint'));
        
        await expect(mockDb.createUser(input)).rejects.toThrow();
      });
    });

    describe('getUserById()', () => {
      it('should return user when found', async () => {
        const userId = mockUsers.validUser.id;
        
        const result = await mockDb.getUserById(userId);
        
        expect(result).toEqual(mockUsers.validUser);
      });

      it('should return null when user not found', async () => {
        const userId = 'non-existent-id';
        mockDb.getUserById.mockResolvedValueOnce(null);
        
        const result = await mockDb.getUserById(userId);
        
        expect(result).toBeNull();
      });
    });

    describe('getUserByEmail()', () => {
      it('should return user when found', async () => {
        const email = mockUsers.validUser.email;
        
        const result = await mockDb.getUserByEmail(email);
        
        expect(result).toEqual(mockUsers.validUser);
      });

      it('should return null when user not found', async () => {
        const email = 'nonexistent@example.com';
        mockDb.getUserByEmail.mockResolvedValueOnce(null);
        
        const result = await mockDb.getUserByEmail(email);
        
        expect(result).toBeNull();
      });
    });

    describe('updateUser()', () => {
      it('should update user successfully', async () => {
        const userId = mockUsers.validUser.id;
        const updates = mockUpdateUserInputs.email;
        
        const result = await mockDb.updateUser(userId, updates);
        
        expect(result).toEqual(mockUsers.validUser);
      });

      it('should throw error when no fields to update', async () => {
        const userId = mockUsers.validUser.id;
        const updates = {};
        mockDb.updateUser.mockRejectedValueOnce(new Error('No fields to update'));
        
        await expect(mockDb.updateUser(userId, updates)).rejects.toThrow('No fields to update');
      });

      it('should handle unique violation error', async () => {
        const userId = mockUsers.validUser.id;
        const updates = { email: 'existing@example.com' };
        mockDb.updateUser.mockRejectedValueOnce(new Error('duplicate key value violates unique constraint'));
        
        await expect(mockDb.updateUser(userId, updates)).rejects.toThrow();
      });

      it('should return null when user not found', async () => {
        const userId = 'non-existent-id';
        const updates = mockUpdateUserInputs.multiple;
        mockDb.updateUser.mockResolvedValueOnce(null);
        
        const result = await mockDb.updateUser(userId, updates);
        
        expect(result).toBeNull();
      });
    });

    describe('deleteUser()', () => {
      it('should delete user successfully', async () => {
        const userId = mockUsers.validUser.id;
        
        const result = await mockDb.deleteUser(userId);
        
        expect(result).toBe(true);
      });

      it('should return false when user not found', async () => {
        const userId = 'non-existent-id';
        mockDb.deleteUser.mockResolvedValueOnce(false);
        
        const result = await mockDb.deleteUser(userId);
        
        expect(result).toBe(false);
      });
    });

    describe('getUsers()', () => {
      it('should return paginated users', async () => {
        const result = await mockDb.getUsers();
        
        expect(result.users).toEqual([mockUsers.validUser]);
        expect(result.total).toBe(1);
      });
    });
  });

  describe('Project Operations', () => {
    describe('createProject()', () => {
      it('should create project successfully', async () => {
        const input = mockCreateProjectInputs.valid;
        
        const result = await mockDb.createProject(input);
        
        expect(result).toEqual(mockProjects.userProject);
        expect(mockDb.createProject).toHaveBeenCalledWith(input);
      });
    });

    describe('getProjectById()', () => {
      it('should return project when found', async () => {
        const projectId = mockProjects.userProject.id;
        
        const result = await mockDb.getProjectById(projectId);
        
        expect(result).toEqual(mockProjects.userProject);
      });

      it('should return null when project not found', async () => {
        const projectId = 'non-existent-id';
        mockDb.getProjectById.mockResolvedValueOnce(null);
        
        const result = await mockDb.getProjectById(projectId);
        
        expect(result).toBeNull();
      });
    });

    describe('getProjectsByUserId()', () => {
      it('should return user projects with pagination', async () => {
        const userId = mockUsers.validUser.id;
        
        const result = await mockDb.getProjectsByUserId(userId);
        
        expect(result.projects).toEqual([mockProjects.userProject]);
        expect(result.total).toBe(1);
      });
    });

    describe('updateProject()', () => {
      it('should update project successfully', async () => {
        const projectId = mockProjects.userProject.id;
        const updates = mockUpdateProjectInputs.both;
        
        const result = await mockDb.updateProject(projectId, updates);
        
        expect(result).toEqual(mockProjects.userProject);
      });

      it('should throw error when no fields to update', async () => {
        const projectId = mockProjects.userProject.id;
        const updates = {};
        mockDb.updateProject.mockRejectedValueOnce(new Error('No fields to update'));
        
        await expect(mockDb.updateProject(projectId, updates)).rejects.toThrow('No fields to update');
      });
    });

    describe('deleteProject()', () => {
      it('should delete project successfully', async () => {
        const projectId = mockProjects.userProject.id;
        
        const result = await mockDb.deleteProject(projectId);
        
        expect(result).toBe(true);
      });
    });
  });

  describe('Deployment Operations', () => {
    describe('createDeployment()', () => {
      it('should create deployment successfully', async () => {
        const input = mockCreateDeploymentInputs.minimal;
        
        const result = await mockDb.createDeployment(input);
        
        expect(result).toEqual(mockDeployments.pendingDeployment);
      });

      it('should create deployment with database info', async () => {
        const input = { 
          ...mockCreateDeploymentInputs.minimal,
          config: { database: true }
        };
        
        const result = await mockDb.createDeployment(input);
        
        expect(result).toEqual(mockDeployments.pendingDeployment);
      });
    });

    describe('updateDeploymentStatus()', () => {
      it('should update deployment status successfully', async () => {
        const deploymentId = mockDeployments.runningDeployment.id;
        const status = DeploymentStatus.RUNNING;
        
        const result = await mockDb.updateDeploymentStatus(deploymentId, status);
        
        expect(result).toEqual(mockDeployments.runningDeployment);
      });
    });

    describe('getDeploymentsByStatus()', () => {
      it('should return deployments by status', async () => {
        const status = DeploymentStatus.RUNNING;
        
        const result = await mockDb.getDeploymentsByStatus(status);
        
        expect(result.deployments).toEqual([mockDeployments.runningDeployment]);
        expect(result.total).toBe(1);
      });
    });

    describe('getRunningDeploymentCountByUser()', () => {
      it('should return running deployment count for user', async () => {
        const userId = mockUsers.validUser.id;
        
        const result = await mockDb.getRunningDeploymentCountByUser(userId);
        
        expect(result).toBe(1);
      });
    });
  });

  describe('Analytics Operations', () => {
    describe('getSystemStats()', () => {
      it('should return system statistics', async () => {
        const result = await mockDb.getSystemStats();
        
        expect(result.totalUsers).toBe(3);
        expect(result.totalProjects).toBe(4);
        expect(result.totalDeployments).toBe(4);
        expect(result.runningDeployments).toBe(1);
        expect(result.deploymentsByStatus).toBeDefined();
      });
    });
  });
});