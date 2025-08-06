import { Pool } from 'pg';
import { DatabaseService } from '../../src/services/database';
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
import { MockDatabaseService } from '../mocks/database';

// Mock the pg module
jest.mock('pg');
jest.mock('../../src/config/database');

const MockedPool = Pool as any;

describe('DatabaseService', () => {
  let databaseService: DatabaseService;
  let mockPool: any;
  let mockClient: any;

  beforeAll(() => {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret';
  });

  beforeEach(() => {
    // Reset mocks and create fresh instances
    jest.clearAllMocks();
    MockDatabaseService.initializeTestData();

    // Create mock pool
    mockPool = {
      connect: jest.fn(),
      query: jest.fn(),
      end: jest.fn(),
      totalCount: 5,
      idleCount: 3,
      waitingCount: 0,
      options: { min: 1, max: 10 }
    } as any;

    // Create mock client
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    } as any;

    // Mock pool.connect to return mock client
    mockPool.connect.mockResolvedValue(mockClient);

    // Mock the Pool constructor
    MockedPool.mockImplementation(() => mockPool);

    // Get database service instance
    databaseService = DatabaseService.getInstance();
  });

  afterEach(() => {
    MockDatabaseService.clearTestData();
  });

  describe('Connection Management', () => {
    describe('connect()', () => {
      it('should initialize database pool successfully', async () => {
        // Mock successful connection test
        mockClient.query.mockResolvedValueOnce({
          rows: [{ current_time: new Date(), pg_version: 'PostgreSQL 13.0' }],
          rowCount: 1
        } as any);

        await databaseService.connect();

        expect(MockedPool).toHaveBeenCalled();
        expect(mockPool.connect).toHaveBeenCalled();
        expect(mockClient.query).toHaveBeenCalledWith('SELECT NOW() as current_time, version() as pg_version');
        expect(mockClient.release).toHaveBeenCalled();
      });

      it('should not create multiple pools when called repeatedly', async () => {
        mockClient.query.mockResolvedValue({
          rows: [{ current_time: new Date(), pg_version: 'PostgreSQL 13.0' }],
          rowCount: 1
        } as any);

        await databaseService.connect();
        await databaseService.connect();

        expect(MockedPool).toHaveBeenCalledTimes(1);
      });

      it('should throw error when connection fails', async () => {
        mockPool.connect.mockRejectedValueOnce(new Error('Connection failed'));

        await expect(databaseService.connect()).rejects.toThrow('Database connection failed: Connection failed');
      });
    });

    describe('healthCheck()', () => {
      beforeEach(async () => {
        mockClient.query.mockResolvedValue({
          rows: [{ current_time: new Date(), pg_version: 'PostgreSQL 13.0' }],
          rowCount: 1
        } as any);
        await databaseService.connect();
      });

      it('should return healthy status when database is working', async () => {
        const timestamp = new Date();
        const version = 'PostgreSQL 13.0';
        
        mockPool.query.mockResolvedValueOnce({
          rows: [{ timestamp, version }],
          rowCount: 1
        } as any);

        const result = await databaseService.healthCheck();

        expect(result.status).toBe('healthy');
        expect(result.details.timestamp).toBe(timestamp);
        expect(result.details.version).toBe(version);
        expect(result.details.responseTime).toMatch(/\d+ms/);
        expect(result.details.pool).toBeDefined();
      });

      it('should return error status when pool is not initialized', async () => {
        const freshService = new (DatabaseService as any)();
        
        const result = await freshService.healthCheck();

        expect(result.status).toBe('error');
        expect(result.details.message).toBe('Database pool not initialized');
      });

      it('should return error status when query fails', async () => {
        mockPool.query.mockRejectedValueOnce(new Error('Query failed'));

        const result = await databaseService.healthCheck();

        expect(result.status).toBe('error');
        expect(result.details.message).toBe('Query failed');
      });
    });

    describe('disconnect()', () => {
      beforeEach(async () => {
        mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 } as any);
        await databaseService.connect();
      });

      it('should close pool gracefully', async () => {
        mockPool.end.mockResolvedValueOnce(undefined);

        await databaseService.disconnect();

        expect(mockPool.end).toHaveBeenCalled();
      });

      it('should handle errors during shutdown', async () => {
        mockPool.end.mockRejectedValueOnce(new Error('Shutdown error'));

        // Should not throw
        await expect(databaseService.disconnect()).resolves.not.toThrow();
      });
    });

    describe('isConnected()', () => {
      it('should return false when not connected', () => {
        const freshService = new (DatabaseService as any)();
        expect(freshService.isConnected()).toBe(false);
      });

      it('should return true when connected', async () => {
        mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 } as any);
        await databaseService.connect();
        
        expect(databaseService.isConnected()).toBe(true);
      });
    });
  });

  describe('Query Operations', () => {
    beforeEach(async () => {
      mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 } as any);
      await databaseService.connect();
    });

    describe('query()', () => {
      it('should execute query successfully', async () => {
        const expectedResult = { rows: [{ id: 1, name: 'test' }], rowCount: 1 };
        mockPool.query.mockResolvedValueOnce(expectedResult as any);

        const result = await databaseService.query('SELECT * FROM test WHERE id = $1', [1]);

        expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM test WHERE id = $1', [1]);
        expect(result).toEqual(expectedResult);
      });

      it('should log slow queries', async () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
        
        // Mock slow query (delay the resolution)
        mockPool.query.mockImplementation(() => 
          new Promise(resolve => 
            setTimeout(() => resolve({ rows: [], rowCount: 0 } as any), 1100)
          )
        );

        await databaseService.query('SLOW QUERY');

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('🐌 Slow query'),
          expect.stringContaining('SLOW QUERY')
        );

        consoleSpy.mockRestore();
      });

      it('should throw error when pool not initialized', async () => {
        const freshService = new (DatabaseService as any)();

        await expect(freshService.query('SELECT 1')).rejects.toThrow('Database pool not initialized');
      });

      it('should throw error when shutting down', async () => {
        // Force shutting down state
        (databaseService as any).isShuttingDown = true;

        await expect(databaseService.query('SELECT 1')).rejects.toThrow('Database is shutting down');
      });
    });

    describe('getClient()', () => {
      it('should return pool client', async () => {
        const client = await databaseService.getClient();

        expect(mockPool.connect).toHaveBeenCalled();
        expect(client).toBe(mockClient);
      });
    });
  });

  describe('Transaction Operations', () => {
    beforeEach(async () => {
      mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 } as any);
      await databaseService.connect();
    });

    describe('executeInTransaction()', () => {
      it('should execute transaction successfully and commit', async () => {
        mockClient.query
          .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // BEGIN
          .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 } as any) // User query
          .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // COMMIT

        const result = await databaseService.executeInTransaction(async (client) => {
          const queryResult = await client.query('INSERT INTO users VALUES ($1)', ['test']);
          return { success: true, data: queryResult.rows[0] };
        });

        expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
        expect(mockClient.query).toHaveBeenCalledWith('INSERT INTO users VALUES ($1)', ['test']);
        expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
        expect(mockClient.release).toHaveBeenCalled();
        expect(result).toEqual({ success: true, data: { id: 1 } });
      });

      it('should rollback transaction on error', async () => {
        mockClient.query
          .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // BEGIN
          .mockRejectedValueOnce(new Error('Query failed')) // User query fails
          .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // ROLLBACK

        await expect(
          databaseService.executeInTransaction(async (client) => {
            await client.query('INVALID QUERY');
            return { success: true };
          })
        ).rejects.toThrow('Query failed');

        expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
        expect(mockClient.release).toHaveBeenCalled();
      });
    });

    describe('manual transaction methods', () => {
      it('should begin transaction', async () => {
        const client = await databaseService.beginTransaction();

        expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
        expect(client).toBe(mockClient);
      });

      it('should commit transaction', async () => {
        await databaseService.commitTransaction(mockClient);

        expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
        expect(mockClient.release).toHaveBeenCalled();
      });

      it('should rollback transaction', async () => {
        await databaseService.rollbackTransaction(mockClient);

        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
        expect(mockClient.release).toHaveBeenCalled();
      });
    });
  });

  describe('User Operations', () => {
    beforeEach(async () => {
      mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 } as any);
      await databaseService.connect();
    });

    describe('createUser()', () => {
      it('should create user successfully', async () => {
        const newUser = mockUsers.validUser;
        mockPool.query.mockResolvedValueOnce({
          rows: [newUser],
          rowCount: 1
        } as any);

        const result = await databaseService.createUser(mockCreateUserInputs.valid);

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO users'),
          [mockCreateUserInputs.valid.email, mockCreateUserInputs.valid.password_hash, mockCreateUserInputs.valid.plan_type]
        );
        expect(result).toEqual(newUser);
      });

      it('should handle unique violation error', async () => {
        const error = new Error('duplicate key value violates unique constraint "users_email_key"');
        (error as any).message = 'unique_violation';
        mockPool.query.mockRejectedValueOnce(error);

        await expect(databaseService.createUser(mockCreateUserInputs.valid))
          .rejects.toThrow(`User with email '${mockCreateUserInputs.valid.email}' already exists`);
      });
    });

    describe('getUserById()', () => {
      it('should return user when found', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [mockUsers.validUser],
          rowCount: 1
        } as any);

        const result = await databaseService.getUserById(mockUsers.validUser.id);

        expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1', [mockUsers.validUser.id]);
        expect(result).toEqual(mockUsers.validUser);
      });

      it('should return null when user not found', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [],
          rowCount: 0
        } as any);

        const result = await databaseService.getUserById('nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('getUserByEmail()', () => {
      it('should return user when found', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [mockUsers.validUser],
          rowCount: 1
        } as any);

        const result = await databaseService.getUserByEmail(mockUsers.validUser.email);

        expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM users WHERE email = $1', [mockUsers.validUser.email]);
        expect(result).toEqual(mockUsers.validUser);
      });

      it('should return null when user not found', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [],
          rowCount: 0
        } as any);

        const result = await databaseService.getUserByEmail('nonexistent@example.com');

        expect(result).toBeNull();
      });
    });

    describe('updateUser()', () => {
      it('should update user successfully', async () => {
        const updatedUser = { ...mockUsers.validUser, email: 'updated@example.com' };
        mockPool.query.mockResolvedValueOnce({
          rows: [updatedUser],
          rowCount: 1
        } as any);

        const result = await databaseService.updateUser(mockUsers.validUser.id, mockUpdateUserInputs.email);

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE users'),
          ['updated@example.com', mockUsers.validUser.id]
        );
        expect(result).toEqual(updatedUser);
      });

      it('should throw error when no fields to update', async () => {
        await expect(databaseService.updateUser(mockUsers.validUser.id, {}))
          .rejects.toThrow('No fields to update');
      });

      it('should handle unique violation error', async () => {
        const error = new Error('unique_violation');
        mockPool.query.mockRejectedValueOnce(error);

        await expect(databaseService.updateUser(mockUsers.validUser.id, mockUpdateUserInputs.email))
          .rejects.toThrow('Email already exists');
      });

      it('should return null when user not found', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [],
          rowCount: 0
        } as any);

        const result = await databaseService.updateUser('nonexistent', mockUpdateUserInputs.email);

        expect(result).toBeNull();
      });
    });

    describe('deleteUser()', () => {
      it('should delete user successfully', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [],
          rowCount: 1
        } as any);

        const result = await databaseService.deleteUser(mockUsers.validUser.id);

        expect(mockPool.query).toHaveBeenCalledWith('DELETE FROM users WHERE id = $1', [mockUsers.validUser.id]);
        expect(result).toBe(true);
      });

      it('should return false when user not found', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [],
          rowCount: 0
        } as any);

        const result = await databaseService.deleteUser('nonexistent');

        expect(result).toBe(false);
      });
    });

    describe('getUsers()', () => {
      it('should return paginated users', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ count: '2' }], rowCount: 1 } as any) // Count query
          .mockResolvedValueOnce({ rows: [mockUsers.validUser, mockUsers.adminUser], rowCount: 2 } as any); // Data query

        const result = await databaseService.getUsers(50, 0);

        expect(result.users).toHaveLength(2);
        expect(result.total).toBe(2);
        expect(mockPool.query).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Project Operations', () => {
    beforeEach(async () => {
      mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 } as any);
      await databaseService.connect();
    });

    describe('createProject()', () => {
      it('should create project successfully', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [mockProjects.userProject],
          rowCount: 1
        } as any);

        const result = await databaseService.createProject(mockCreateProjectInputs.valid);

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO projects'),
          [mockCreateProjectInputs.valid.user_id, mockCreateProjectInputs.valid.name, mockCreateProjectInputs.valid.description]
        );
        expect(result).toEqual(mockProjects.userProject);
      });
    });

    describe('getProjectById()', () => {
      it('should return project when found', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [mockProjects.userProject],
          rowCount: 1
        } as any);

        const result = await databaseService.getProjectById(mockProjects.userProject.id);

        expect(result).toEqual(mockProjects.userProject);
      });

      it('should return null when project not found', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [],
          rowCount: 0
        } as any);

        const result = await databaseService.getProjectById('nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('getProjectsByUserId()', () => {
      it('should return user projects with pagination', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 } as any)
          .mockResolvedValueOnce({ rows: [mockProjects.userProject], rowCount: 1 } as any);

        const result = await databaseService.getProjectsByUserId(mockUsers.validUser.id);

        expect(result.projects).toHaveLength(1);
        expect(result.total).toBe(1);
      });
    });

    describe('updateProject()', () => {
      it('should update project successfully', async () => {
        const updatedProject = { ...mockProjects.userProject, name: 'Updated Name' };
        mockPool.query.mockResolvedValueOnce({
          rows: [updatedProject],
          rowCount: 1
        } as any);

        const result = await databaseService.updateProject(mockProjects.userProject.id, mockUpdateProjectInputs.name);

        expect(result).toEqual(updatedProject);
      });

      it('should throw error when no fields to update', async () => {
        await expect(databaseService.updateProject(mockProjects.userProject.id, {}))
          .rejects.toThrow('No fields to update');
      });
    });

    describe('deleteProject()', () => {
      it('should delete project successfully', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [],
          rowCount: 1
        } as any);

        const result = await databaseService.deleteProject(mockProjects.userProject.id);

        expect(result).toBe(true);
      });
    });
  });

  describe('Deployment Operations', () => {
    beforeEach(async () => {
      mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 } as any);
      await databaseService.connect();
    });

    describe('createDeployment()', () => {
      it('should create deployment successfully', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [mockDeployments.pendingDeployment],
          rowCount: 1
        } as any);

        const result = await databaseService.createDeployment(mockCreateDeploymentInputs.minimal);

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO deployments'),
          expect.arrayContaining([mockCreateDeploymentInputs.minimal.project_id, mockCreateDeploymentInputs.minimal.app_sandbox_id])
        );
        expect(result).toEqual(mockDeployments.pendingDeployment);
      });

      it('should create deployment with database info', async () => {
        const deploymentWithDb = mockDeployments.runningDeployment;
        mockPool.query.mockResolvedValueOnce({
          rows: [deploymentWithDb],
          rowCount: 1
        } as any);

        const result = await databaseService.createDeployment(mockCreateDeploymentInputs.withDatabase);

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO deployments'),
          expect.arrayContaining([
            mockCreateDeploymentInputs.withDatabase.project_id,
            mockCreateDeploymentInputs.withDatabase.app_sandbox_id,
            null, // public_url
            mockCreateDeploymentInputs.withDatabase.db_sandbox_id,
            JSON.stringify(mockCreateDeploymentInputs.withDatabase.db_connection_info),
            DeploymentStatus.PENDING,
            mockCreateDeploymentInputs.withDatabase.runtime_type
          ])
        );
        expect(result).toEqual(deploymentWithDb);
      });
    });

    describe('updateDeploymentStatus()', () => {
      it('should update deployment status successfully', async () => {
        const updatedDeployment = { ...mockDeployments.pendingDeployment, status: DeploymentStatus.RUNNING };
        mockPool.query.mockResolvedValueOnce({
          rows: [updatedDeployment],
          rowCount: 1
        } as any);

        const result = await databaseService.updateDeploymentStatus(
          mockDeployments.pendingDeployment.id,
          DeploymentStatus.RUNNING
        );

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE deployments SET status = $1'),
          [DeploymentStatus.RUNNING, mockDeployments.pendingDeployment.id]
        );
        expect(result).toEqual(updatedDeployment);
      });
    });

    describe('getDeploymentsByStatus()', () => {
      it('should return deployments by status', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 } as any)
          .mockResolvedValueOnce({ rows: [mockDeployments.runningDeployment], rowCount: 1 } as any);

        const result = await databaseService.getDeploymentsByStatus(DeploymentStatus.RUNNING);

        expect(result.deployments).toHaveLength(1);
        expect(result.total).toBe(1);
      });
    });

    describe('getRunningDeploymentCountByUser()', () => {
      it('should return running deployment count for user', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [{ count: '2' }],
          rowCount: 1
        } as any);

        const result = await databaseService.getRunningDeploymentCountByUser(mockUsers.validUser.id);

        expect(result).toBe(2);
      });
    });
  });

  describe('Analytics Operations', () => {
    beforeEach(async () => {
      mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 } as any);
      await databaseService.connect();
    });

    describe('getSystemStats()', () => {
      it('should return system statistics', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ count: '5' }] } as any) // users
          .mockResolvedValueOnce({ rows: [{ count: '10' }] } as any) // projects
          .mockResolvedValueOnce({ rows: [{ count: '15' }] } as any) // deployments
          .mockResolvedValueOnce({ rows: [{ count: '3' }] } as any) // running
          .mockResolvedValueOnce({ rows: [ // by status
            { status: 'PENDING', count: '2' },
            { status: 'RUNNING', count: '3' },
            { status: 'FAILED', count: '1' }
          ] } as any);

        const result = await databaseService.getSystemStats();

        expect(result).toEqual({
          totalUsers: 5,
          totalProjects: 10,
          totalDeployments: 15,
          runningDeployments: 3,
          deploymentsByStatus: {
            PENDING: 2,
            RUNNING: 3,
            FAILED: 1
          }
        });
      });
    });
  });
});