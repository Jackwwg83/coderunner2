import { ProjectService } from '../../src/services/project';
import { CreateProjectRequest, UpdateProjectRequest } from '../../src/types';

/**
 * ProjectService Unit Tests
 * 
 * Tests basic functionality of the ProjectService class.
 * Since this is currently a mock implementation, tests focus on:
 * - Method signatures and return types
 * - Basic business logic validation
 * - Error handling scenarios
 * - Mock data consistency
 */

describe('ProjectService', () => {
  let projectService: ProjectService;
  let consoleSpy: jest.SpyInstance;

  beforeAll(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';
  });

  beforeEach(() => {
    // Mock console.log to avoid test output pollution
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    // Get ProjectService instance
    projectService = ProjectService.getInstance();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('Initialization', () => {
    it('should be a singleton', () => {
      const instance1 = ProjectService.getInstance();
      const instance2 = ProjectService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should log initialization message', () => {
      // Reset singleton to force re-creation
      (ProjectService as any).instance = null;
      
      ProjectService.getInstance();
      
      expect(consoleSpy).toHaveBeenCalledWith('ProjectService initialized');
    });
  });

  describe('createProject()', () => {
    const validCreateRequest: CreateProjectRequest = {
      name: 'Test Project',
      description: 'A test project description'
    };

    it('should create project with all required fields', async () => {
      const userId = 'user_123';
      const result = await projectService.createProject(userId, validCreateRequest);

      expect(result).toBeDefined();
      expect(result.id).toMatch(/^proj_\d+_[a-z0-9]{9}$/);
      expect(result.user_id).toBe(userId);
      expect(result.name).toBe(validCreateRequest.name);
      expect(result.description).toBe(validCreateRequest.description);
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should create project with empty description when not provided', async () => {
      const requestWithoutDescription: CreateProjectRequest = {
        name: 'Test Project'
      };
      
      const result = await projectService.createProject('user_123', requestWithoutDescription);
      
      expect(result.description).toBe('');
    });

    it('should log project creation', async () => {
      const userId = 'user_123';
      
      await projectService.createProject(userId, validCreateRequest);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        `Creating project for user ${userId}:`,
        validCreateRequest
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        'Project created:',
        expect.any(Object)
      );
    });

    it('should generate unique project IDs', async () => {
      const project1 = await projectService.createProject('user_1', { name: 'Project 1' });
      const project2 = await projectService.createProject('user_2', { name: 'Project 2' });
      
      expect(project1.id).not.toBe(project2.id);
      expect(project1.id).toMatch(/^proj_\d+_[a-z0-9]{9}$/);
      expect(project2.id).toMatch(/^proj_\d+_[a-z0-9]{9}$/);
    });

    it('should handle different user IDs correctly', async () => {
      const userIds = ['user_123', 'user_456', 'user_789'];
      
      for (const userId of userIds) {
        const result = await projectService.createProject(userId, validCreateRequest);
        expect(result.user_id).toBe(userId);
      }
    });
  });

  describe('getProjectById()', () => {
    it('should return null (mock implementation)', async () => {
      const result = await projectService.getProjectById('proj_123');
      expect(result).toBeNull();
    });

    it('should return null with user ID', async () => {
      const result = await projectService.getProjectById('proj_123', 'user_123');
      expect(result).toBeNull();
    });

    it('should log project retrieval', async () => {
      const projectId = 'proj_123';
      const userId = 'user_123';
      
      await projectService.getProjectById(projectId, userId);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        `Getting project ${projectId} for user ${userId}`
      );
    });

    it('should handle missing user ID', async () => {
      const projectId = 'proj_123';
      
      await projectService.getProjectById(projectId);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        `Getting project ${projectId} for user undefined`
      );
    });
  });

  describe('getUserProjects()', () => {
    it('should return empty projects list (mock implementation)', async () => {
      const result = await projectService.getUserProjects('user_123');
      
      expect(result).toEqual({
        projects: [],
        total: 0
      });
    });

    it('should handle custom pagination parameters', async () => {
      const limit = 10;
      const offset = 5;
      const result = await projectService.getUserProjects('user_123', limit, offset);
      
      expect(result.projects).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should use default pagination parameters', async () => {
      const userId = 'user_123';
      
      await projectService.getUserProjects(userId);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        `Getting projects for user ${userId} (limit: 20, offset: 0)`
      );
    });

    it('should log correct parameters', async () => {
      const userId = 'user_123';
      const limit = 15;
      const offset = 10;
      
      await projectService.getUserProjects(userId, limit, offset);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        `Getting projects for user ${userId} (limit: ${limit}, offset: ${offset})`
      );
    });
  });

  describe('updateProject()', () => {
    const validUpdateRequest: UpdateProjectRequest = {
      name: 'Updated Project Name',
      description: 'Updated description'
    };

    it('should return null (mock implementation)', async () => {
      const result = await projectService.updateProject('proj_123', 'user_123', validUpdateRequest);
      expect(result).toBeNull();
    });

    it('should log update operation', async () => {
      const projectId = 'proj_123';
      const userId = 'user_123';
      
      await projectService.updateProject(projectId, userId, validUpdateRequest);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        `Updating project ${projectId} for user ${userId}:`,
        validUpdateRequest
      );
    });

    it('should handle partial updates', async () => {
      const partialUpdate: UpdateProjectRequest = {
        name: 'Only Name Update'
      };
      
      const result = await projectService.updateProject('proj_123', 'user_123', partialUpdate);
      expect(result).toBeNull();
    });

    it('should handle empty updates', async () => {
      const emptyUpdate: UpdateProjectRequest = {};
      
      const result = await projectService.updateProject('proj_123', 'user_123', emptyUpdate);
      expect(result).toBeNull();
    });
  });

  describe('deleteProject()', () => {
    it('should return true (mock implementation)', async () => {
      const result = await projectService.deleteProject('proj_123', 'user_123');
      expect(result).toBe(true);
    });

    it('should log deletion operation', async () => {
      const projectId = 'proj_123';
      const userId = 'user_123';
      
      await projectService.deleteProject(projectId, userId);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        `Deleting project ${projectId} for user ${userId}`
      );
    });

    it('should handle different project IDs', async () => {
      const projectIds = ['proj_123', 'proj_456', 'proj_789'];
      
      for (const projectId of projectIds) {
        const result = await projectService.deleteProject(projectId, 'user_123');
        expect(result).toBe(true);
      }
    });
  });

  describe('getProjectTemplates()', () => {
    it('should return mock project templates', async () => {
      const result = await projectService.getProjectTemplates();
      
      expect(result).toBeInstanceOf(Array);
      expect(result).toHaveLength(1);
      
      const template = result[0];
      expect(template.id).toBe('template_nodejs');
      expect(template.name).toBe('Node.js Application');
      expect(template.description).toBe('Basic Node.js application with Express');
      expect(template.language).toBe('javascript');
      expect(template.framework).toBe('express');
      expect(template.isOfficial).toBe(true);
    });

    it('should return templates with proper structure', async () => {
      const result = await projectService.getProjectTemplates();
      const template = result[0];
      
      expect(template).toHaveProperty('id');
      expect(template).toHaveProperty('name');
      expect(template).toHaveProperty('description');
      expect(template).toHaveProperty('language');
      expect(template).toHaveProperty('framework');
      expect(template).toHaveProperty('files');
      expect(template).toHaveProperty('tags');
      expect(template).toHaveProperty('isOfficial');
      expect(template).toHaveProperty('createdAt');
      expect(template).toHaveProperty('updatedAt');
    });

    it('should return templates with proper files structure', async () => {
      const result = await projectService.getProjectTemplates();
      const template = result[0];
      
      expect(template.files).toBeInstanceOf(Array);
      expect(template.files).toHaveLength(2);
      
      template.files.forEach(file => {
        expect(file).toHaveProperty('path');
        expect(file).toHaveProperty('content');
        expect(file).toHaveProperty('isTemplate');
        expect(file.isTemplate).toBe(true);
      });
    });

    it('should log template retrieval', async () => {
      await projectService.getProjectTemplates();
      
      expect(consoleSpy).toHaveBeenCalledWith('Getting project templates');
    });
  });

  describe('searchProjects()', () => {
    it('should return empty results (mock implementation)', async () => {
      const result = await projectService.searchProjects('test query');
      
      expect(result).toEqual({
        projects: [],
        total: 0
      });
    });

    it('should handle search with tags', async () => {
      const result = await projectService.searchProjects('test', ['javascript', 'node']);
      
      expect(result.projects).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should handle custom limit', async () => {
      const result = await projectService.searchProjects('test', undefined, 10);
      
      expect(result.projects).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should log search parameters', async () => {
      const query = 'test query';
      const tags = ['javascript', 'react'];
      const limit = 15;
      
      await projectService.searchProjects(query, tags, limit);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        `Searching projects with query: "${query}", tags:`,
        tags,
        `limit: ${limit}`
      );
    });
  });

  describe('getProjectStats()', () => {
    it('should return zero stats (mock implementation)', async () => {
      const result = await projectService.getProjectStats('user_123');
      
      expect(result).toEqual({
        totalProjects: 0,
        publicProjects: 0,
        privateProjects: 0,
        totalExecutions: 0,
        popularTags: []
      });
    });

    it('should log stats retrieval', async () => {
      const userId = 'user_123';
      
      await projectService.getProjectStats(userId);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        `Getting project statistics for user ${userId}`
      );
    });

    it('should return proper stats structure', async () => {
      const result = await projectService.getProjectStats('user_123');
      
      expect(result).toHaveProperty('totalProjects');
      expect(result).toHaveProperty('publicProjects');
      expect(result).toHaveProperty('privateProjects');
      expect(result).toHaveProperty('totalExecutions');
      expect(result).toHaveProperty('popularTags');
      expect(result.popularTags).toBeInstanceOf(Array);
    });
  });

  describe('hasProjectAccess()', () => {
    it('should return false (mock implementation)', async () => {
      const result = await projectService.hasProjectAccess('proj_123', 'user_123');
      expect(result).toBe(false);
    });

    it('should log access check', async () => {
      const projectId = 'proj_123';
      const userId = 'user_123';
      
      await projectService.hasProjectAccess(projectId, userId);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        `Checking access for project ${projectId} and user ${userId}`
      );
    });

    it('should handle different project and user combinations', async () => {
      const combinations = [
        { projectId: 'proj_1', userId: 'user_1' },
        { projectId: 'proj_2', userId: 'user_2' },
        { projectId: 'proj_3', userId: 'user_3' }
      ];
      
      for (const combo of combinations) {
        const result = await projectService.hasProjectAccess(combo.projectId, combo.userId);
        expect(result).toBe(false);
      }
    });
  });

  describe('generateProjectId() (private method behavior)', () => {
    it('should generate unique IDs through createProject', async () => {
      const ids = new Set();
      const iterations = 10;
      
      for (let i = 0; i < iterations; i++) {
        const project = await projectService.createProject('user_test', { name: `Project ${i}` });
        ids.add(project.id);
      }
      
      // All IDs should be unique
      expect(ids.size).toBe(iterations);
    });

    it('should generate IDs with correct format', async () => {
      const project = await projectService.createProject('user_test', { name: 'Test' });
      
      expect(project.id).toMatch(/^proj_\d+_[a-z0-9]{9}$/);
      expect(project.id.startsWith('proj_')).toBe(true);
    });
  });
});