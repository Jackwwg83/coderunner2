import { Project, CreateProjectInput, UpdateProjectInput, Deployment, DeploymentStatus, CreateDeploymentInput } from '../../src/types';
import { mockUsers } from './users';

/**
 * Test project and deployment fixtures
 */

export const mockProjects = {
  userProject: {
    id: '660e8400-e29b-41d4-a716-446655440000',
    user_id: mockUsers.validUser.id,
    name: 'Test Project',
    description: 'A test project for unit testing',
    created_at: new Date('2024-01-01T10:00:00Z'),
    updated_at: new Date('2024-01-01T10:00:00Z')
  } as Project,

  adminProject: {
    id: '660e8400-e29b-41d4-a716-446655440001',
    user_id: mockUsers.adminUser.id,
    name: 'Admin Project',
    description: 'An admin project for testing',
    created_at: new Date('2024-01-01T11:00:00Z'),
    updated_at: new Date('2024-01-01T11:00:00Z')
  } as Project,

  personalProject: {
    id: '660e8400-e29b-41d4-a716-446655440002',
    user_id: mockUsers.personalUser.id,
    name: 'Personal Project',
    description: 'A personal user project',
    created_at: new Date('2024-01-01T12:00:00Z'),
    updated_at: new Date('2024-01-01T12:00:00Z')
  } as Project,

  noDescriptionProject: {
    id: '660e8400-e29b-41d4-a716-446655440003',
    user_id: mockUsers.validUser.id,
    name: 'No Description Project',
    description: null,
    created_at: new Date('2024-01-01T13:00:00Z'),
    updated_at: new Date('2024-01-01T13:00:00Z')
  } as any
};

export const mockCreateProjectInputs = {
  valid: {
    user_id: mockUsers.validUser.id,
    name: 'New Test Project',
    description: 'A new project for testing'
  } as CreateProjectInput,

  withoutDescription: {
    user_id: mockUsers.validUser.id,
    name: 'Project Without Description'
  } as CreateProjectInput,

  forAdminUser: {
    user_id: mockUsers.adminUser.id,
    name: 'Admin New Project',
    description: 'A new admin project'
  } as CreateProjectInput
};

export const mockUpdateProjectInputs = {
  name: {
    name: 'Updated Project Name'
  } as UpdateProjectInput,

  description: {
    description: 'Updated project description'
  } as UpdateProjectInput,

  both: {
    name: 'Updated Name',
    description: 'Updated description'
  } as UpdateProjectInput,

  clearDescription: {
    description: null
  } as any
};

export const mockDeployments = {
  pendingDeployment: {
    id: '770e8400-e29b-41d4-a716-446655440000',
    project_id: mockProjects.userProject.id,
    app_sandbox_id: 'app-sandbox-123',
    public_url: null,
    db_sandbox_id: null,
    db_connection_info: null,
    status: DeploymentStatus.PENDING,
    runtime_type: 'node',
    created_at: new Date('2024-01-01T14:00:00Z'),
    updated_at: new Date('2024-01-01T14:00:00Z')
  } as any,

  runningDeployment: {
    id: '770e8400-e29b-41d4-a716-446655440001',
    project_id: mockProjects.userProject.id,
    app_sandbox_id: 'app-sandbox-456',
    public_url: 'https://app-sandbox-456.example.com',
    db_sandbox_id: 'db-sandbox-789',
    db_connection_info: {
      host: 'db-sandbox-789.example.com',
      port: 5432,
      database: 'app_db',
      user: 'app_user'
    },
    status: DeploymentStatus.RUNNING,
    runtime_type: 'node',
    created_at: new Date('2024-01-01T15:00:00Z'),
    updated_at: new Date('2024-01-01T15:00:00Z')
  } as Deployment,

  failedDeployment: {
    id: '770e8400-e29b-41d4-a716-446655440002',
    project_id: mockProjects.adminProject.id,
    app_sandbox_id: 'app-sandbox-failed',
    public_url: null,
    db_sandbox_id: null,
    db_connection_info: null,
    status: DeploymentStatus.FAILED,
    runtime_type: 'python',
    created_at: new Date('2024-01-01T16:00:00Z'),
    updated_at: new Date('2024-01-01T16:00:00Z')
  } as any,

  stoppedDeployment: {
    id: '770e8400-e29b-41d4-a716-446655440003',
    project_id: mockProjects.personalProject.id,
    app_sandbox_id: 'app-sandbox-stopped',
    public_url: null,
    db_sandbox_id: null,
    db_connection_info: null,
    status: DeploymentStatus.STOPPED,
    runtime_type: 'node',
    created_at: new Date('2024-01-01T17:00:00Z'),
    updated_at: new Date('2024-01-01T17:00:00Z')
  } as any
};

export const mockCreateDeploymentInputs = {
  minimal: {
    project_id: mockProjects.userProject.id,
    app_sandbox_id: 'new-app-sandbox',
    runtime_type: 'node'
  } as CreateDeploymentInput,

  withDatabase: {
    project_id: mockProjects.userProject.id,
    app_sandbox_id: 'new-app-with-db',
    db_sandbox_id: 'new-db-sandbox',
    db_connection_info: {
      host: 'new-db-sandbox.example.com',
      port: 5432,
      database: 'new_app_db',
      user: 'new_app_user'
    },
    runtime_type: 'node'
  } as CreateDeploymentInput,

  withUrl: {
    project_id: mockProjects.adminProject.id,
    app_sandbox_id: 'app-with-url',
    public_url: 'https://app-with-url.example.com',
    status: DeploymentStatus.RUNNING,
    runtime_type: 'python'
  } as CreateDeploymentInput
};

export const createMockProject = (overrides: Partial<Project> = {}): Project => ({
  ...mockProjects.userProject,
  ...overrides
});

export const createMockDeployment = (overrides: Partial<Deployment> = {}): Deployment => ({
  ...mockDeployments.pendingDeployment,
  ...overrides
});

export const createMockCreateProjectInput = (overrides: Partial<CreateProjectInput> = {}): CreateProjectInput => ({
  ...mockCreateProjectInputs.valid,
  ...overrides
});

export const createMockCreateDeploymentInput = (overrides: Partial<CreateDeploymentInput> = {}): CreateDeploymentInput => ({
  ...mockCreateDeploymentInputs.minimal,
  ...overrides
});