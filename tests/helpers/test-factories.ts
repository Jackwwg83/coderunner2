import { faker } from '@faker-js/faker';
import { DatabaseService } from '../../src/services/database';
import { AuthService } from '../../src/services/auth';

export interface TestUser {
  id: string;
  name: string;
  email: string;
  password: string;
  token: string;
}

export interface TestProject {
  id: string;
  name: string;
  description: string;
  userId: string;
}

export interface TestDeployment {
  id: string;
  name: string;
  projectId: string;
  userId: string;
  status: string;
  manifest: any;
}

export interface TestEnvironmentConfig {
  id: string;
  projectId: string;
  environment: string;
  name: string;
  description: string;
}

export interface TestEnvironmentVariable {
  id: string;
  configId: string;
  key: string;
  value: string;
  isEncrypted: boolean;
  isRequired: boolean;
  description: string;
  variableType: string;
}

export interface TestScalingPolicy {
  id: string;
  deploymentId: string;
  name: string;
  metricType: string;
  threshold: number;
  scaleDirection: string;
  scaleAmount: number;
  cooldownPeriod: number;
}

/**
 * Factory for creating test users
 */
export class UserFactory {
  private authService = new AuthService();

  /**
   * Creates a test user and returns user data with auth token
   */
  async create(overrides?: Partial<TestUser>): Promise<TestUser> {
    const userData = {
      name: overrides?.name || faker.person.fullName(),
      email: overrides?.email || faker.internet.email(),
      password: overrides?.password || 'TestPassword123!',
      ...overrides
    };

    const result = await this.authService.register(
      userData.email,
      userData.password,
      userData.name
    );

    return {
      id: result.id,
      name: result.name,
      email: result.email,
      password: userData.password,
      token: result.token
    };
  }

  /**
   * Creates multiple test users
   */
  async createMany(count: number, overrides?: Partial<TestUser>): Promise<TestUser[]> {
    const users: TestUser[] = [];
    for (let i = 0; i < count; i++) {
      users.push(await this.create(overrides));
    }
    return users;
  }

  /**
   * Creates a test user with specific role or permissions
   */
  async createWithRole(role: 'admin' | 'user' | 'readonly'): Promise<TestUser> {
    const user = await this.create({
      name: `${role.charAt(0).toUpperCase() + role.slice(1)} User`,
      email: `${role}-${Date.now()}@coderunner.io`
    });

    // Update user role in database
    const db = DatabaseService.getInstance();
    await db.query(
      'UPDATE users SET role = $1 WHERE id = $2',
      [role, user.id]
    );

    return user;
  }
}

/**
 * Factory for creating test projects
 */
export class ProjectFactory {
  private db = DatabaseService.getInstance();

  async create(userId: string, overrides?: Partial<TestProject>): Promise<TestProject> {
    const projectData = {
      name: overrides?.name || faker.company.name(),
      description: overrides?.description || faker.lorem.sentence(),
      ...overrides
    };

    const result = await this.db.query(
      `INSERT INTO projects (name, description, user_id) 
       VALUES ($1, $2, $3) RETURNING id`,
      [projectData.name, projectData.description, userId]
    );

    return {
      id: result.rows[0].id,
      name: projectData.name,
      description: projectData.description,
      userId
    };
  }

  async createMany(userId: string, count: number): Promise<TestProject[]> {
    const projects: TestProject[] = [];
    for (let i = 0; i < count; i++) {
      projects.push(await this.create(userId));
    }
    return projects;
  }

  async createWithDeployments(userId: string, deploymentCount: number = 3): Promise<{
    project: TestProject;
    deployments: TestDeployment[];
  }> {
    const project = await this.create(userId);
    const deploymentFactory = new DeploymentFactory();
    const deployments = await deploymentFactory.createMany(project.id, userId, deploymentCount);

    return { project, deployments };
  }
}

/**
 * Factory for creating test deployments
 */
export class DeploymentFactory {
  private db = DatabaseService.getInstance();

  async create(projectId: string, userId: string, overrides?: Partial<TestDeployment>): Promise<TestDeployment> {
    const deploymentData = {
      name: overrides?.name || `${faker.hacker.adjective()}-${faker.hacker.noun()}`,
      status: overrides?.status || 'running',
      manifest: overrides?.manifest || this.generateManifest(),
      ...overrides
    };

    const result = await this.db.query(
      `INSERT INTO deployments (name, project_id, user_id, status, manifest, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING id`,
      [
        deploymentData.name,
        projectId,
        userId,
        deploymentData.status,
        JSON.stringify(deploymentData.manifest)
      ]
    );

    return {
      id: result.rows[0].id,
      name: deploymentData.name,
      projectId,
      userId,
      status: deploymentData.status,
      manifest: deploymentData.manifest
    };
  }

  async createMany(projectId: string, userId: string, count: number): Promise<TestDeployment[]> {
    const deployments: TestDeployment[] = [];
    for (let i = 0; i < count; i++) {
      deployments.push(await this.create(projectId, userId));
    }
    return deployments;
  }

  async createWithStatus(
    projectId: string, 
    userId: string, 
    status: 'running' | 'stopped' | 'starting' | 'stopping' | 'error'
  ): Promise<TestDeployment> {
    return this.create(projectId, userId, { status });
  }

  async createWithScaling(projectId: string, userId: string): Promise<{
    deployment: TestDeployment;
    policies: TestScalingPolicy[];
  }> {
    const deployment = await this.create(projectId, userId);
    const scalingFactory = new ScalingPolicyFactory();
    const policies = await scalingFactory.createMany(deployment.id, 2);

    return { deployment, policies };
  }

  private generateManifest(): any {
    const appTypes = ['nodejs', 'python', 'go', 'docker'];
    const appType = faker.helpers.arrayElement(appTypes);

    const baseManifest = {
      version: '1.0',
      name: faker.system.fileName().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      type: appType,
      resources: {
        cpu: faker.number.float({ min: 0.1, max: 2.0, fractionDigits: 1 }),
        memory: faker.helpers.arrayElement([128, 256, 512, 1024, 2048])
      },
      environment: {
        NODE_ENV: faker.helpers.arrayElement(['development', 'staging', 'production']),
        PORT: faker.internet.port()
      }
    };

    // Add type-specific configuration
    switch (appType) {
      case 'nodejs':
        return {
          ...baseManifest,
          runtime: { version: faker.helpers.arrayElement(['16', '18', '20']) },
          build: {
            commands: ['npm install', 'npm run build']
          },
          start: {
            command: 'npm start',
            port: baseManifest.environment.PORT
          }
        };

      case 'python':
        return {
          ...baseManifest,
          runtime: { version: faker.helpers.arrayElement(['3.9', '3.10', '3.11']) },
          build: {
            commands: ['pip install -r requirements.txt']
          },
          start: {
            command: 'python app.py',
            port: baseManifest.environment.PORT
          }
        };

      case 'go':
        return {
          ...baseManifest,
          runtime: { version: faker.helpers.arrayElement(['1.19', '1.20', '1.21']) },
          build: {
            commands: ['go mod tidy', 'go build -o app']
          },
          start: {
            command: './app',
            port: baseManifest.environment.PORT
          }
        };

      case 'docker':
        return {
          ...baseManifest,
          docker: {
            image: faker.helpers.arrayElement([
              'node:18-alpine',
              'python:3.11-slim',
              'golang:1.21-alpine'
            ])
          },
          start: {
            command: 'docker run',
            port: baseManifest.environment.PORT
          }
        };

      default:
        return baseManifest;
    }
  }
}

/**
 * Factory for creating test environment configurations
 */
export class ConfigurationFactory {
  private db = DatabaseService.getInstance();

  async createEnvironmentConfig(
    projectId: string, 
    environment: 'development' | 'staging' | 'production',
    overrides?: Partial<TestEnvironmentConfig>
  ): Promise<TestEnvironmentConfig> {
    const configData = {
      name: overrides?.name || `${environment} Configuration`,
      description: overrides?.description || `Configuration for ${environment} environment`,
      ...overrides
    };

    const result = await this.db.query(
      `INSERT INTO environment_configs (project_id, environment, name, description, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id`,
      [projectId, environment, configData.name, configData.description]
    );

    return {
      id: result.rows[0].id,
      projectId,
      environment,
      name: configData.name,
      description: configData.description
    };
  }

  async createVariable(
    configId: string,
    overrides?: Partial<TestEnvironmentVariable>
  ): Promise<TestEnvironmentVariable> {
    const variableData = {
      key: overrides?.key || faker.hacker.noun().toUpperCase().replace(/\s+/g, '_'),
      value: overrides?.value || faker.lorem.word(),
      isEncrypted: overrides?.isEncrypted || false,
      isRequired: overrides?.isRequired || faker.datatype.boolean(),
      description: overrides?.description || faker.lorem.sentence(),
      variableType: overrides?.variableType || 'string',
      ...overrides
    };

    const result = await this.db.query(
      `INSERT INTO environment_variables 
       (config_id, key, value, is_encrypted, is_required, description, variable_type, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING id`,
      [
        configId,
        variableData.key,
        variableData.value,
        variableData.isEncrypted,
        variableData.isRequired,
        variableData.description,
        variableData.variableType
      ]
    );

    return {
      id: result.rows[0].id,
      configId,
      key: variableData.key,
      value: variableData.value,
      isEncrypted: variableData.isEncrypted,
      isRequired: variableData.isRequired,
      description: variableData.description,
      variableType: variableData.variableType
    };
  }

  async createFullConfiguration(projectId: string): Promise<{
    development: TestEnvironmentConfig;
    staging: TestEnvironmentConfig;
    production: TestEnvironmentConfig;
    variables: {
      development: TestEnvironmentVariable[];
      staging: TestEnvironmentVariable[];
      production: TestEnvironmentVariable[];
    };
  }> {
    // Create environment configs
    const development = await this.createEnvironmentConfig(projectId, 'development');
    const staging = await this.createEnvironmentConfig(projectId, 'staging');
    const production = await this.createEnvironmentConfig(projectId, 'production');

    // Create variables for each environment
    const devVariables = await this.createVariablesForEnvironment(development.id, 'development');
    const stagingVariables = await this.createVariablesForEnvironment(staging.id, 'staging');
    const prodVariables = await this.createVariablesForEnvironment(production.id, 'production');

    return {
      development,
      staging,
      production,
      variables: {
        development: devVariables,
        staging: stagingVariables,
        production: prodVariables
      }
    };
  }

  private async createVariablesForEnvironment(
    configId: string, 
    environment: string
  ): Promise<TestEnvironmentVariable[]> {
    const variables: TestEnvironmentVariable[] = [];

    // Common variables
    variables.push(await this.createVariable(configId, {
      key: 'NODE_ENV',
      value: environment,
      isRequired: true,
      variableType: 'string'
    }));

    variables.push(await this.createVariable(configId, {
      key: 'PORT',
      value: '3000',
      isRequired: true,
      variableType: 'number'
    }));

    // Environment-specific variables
    if (environment === 'production') {
      variables.push(await this.createVariable(configId, {
        key: 'DATABASE_URL',
        value: 'postgres://prod:secret@db.example.com/myapp',
        isEncrypted: true,
        isRequired: true,
        variableType: 'secret'
      }));

      variables.push(await this.createVariable(configId, {
        key: 'API_SECRET_KEY',
        value: 'super-secret-production-key',
        isEncrypted: true,
        isRequired: true,
        variableType: 'secret'
      }));
    } else {
      variables.push(await this.createVariable(configId, {
        key: 'DATABASE_URL',
        value: `postgres://dev:dev@localhost/myapp_${environment}`,
        isRequired: true,
        variableType: 'url'
      }));

      variables.push(await this.createVariable(configId, {
        key: 'DEBUG',
        value: 'true',
        variableType: 'boolean'
      }));
    }

    return variables;
  }
}

/**
 * Factory for creating test scaling policies
 */
export class ScalingPolicyFactory {
  private db = DatabaseService.getInstance();

  async create(deploymentId: string, overrides?: Partial<TestScalingPolicy>): Promise<TestScalingPolicy> {
    const policyData = {
      name: overrides?.name || `${faker.hacker.adjective()} Scaling Policy`,
      metricType: overrides?.metricType || faker.helpers.arrayElement(['cpu', 'memory', 'requests']),
      threshold: overrides?.threshold || faker.number.int({ min: 50, max: 90 }),
      scaleDirection: overrides?.scaleDirection || faker.helpers.arrayElement(['out', 'in']),
      scaleAmount: overrides?.scaleAmount || faker.number.int({ min: 1, max: 5 }),
      cooldownPeriod: overrides?.cooldownPeriod || faker.number.int({ min: 60, max: 600 }),
      ...overrides
    };

    const result = await this.db.query(
      `INSERT INTO scaling_policies 
       (deployment_id, name, metric_type, threshold, scale_direction, scale_amount, cooldown_period, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING id`,
      [
        deploymentId,
        policyData.name,
        policyData.metricType,
        policyData.threshold,
        policyData.scaleDirection,
        policyData.scaleAmount,
        policyData.cooldownPeriod
      ]
    );

    return {
      id: result.rows[0].id,
      deploymentId,
      name: policyData.name,
      metricType: policyData.metricType,
      threshold: policyData.threshold,
      scaleDirection: policyData.scaleDirection,
      scaleAmount: policyData.scaleAmount,
      cooldownPeriod: policyData.cooldownPeriod
    };
  }

  async createMany(deploymentId: string, count: number): Promise<TestScalingPolicy[]> {
    const policies: TestScalingPolicy[] = [];
    for (let i = 0; i < count; i++) {
      policies.push(await this.create(deploymentId));
    }
    return policies;
  }

  async createCpuScaleOutPolicy(deploymentId: string): Promise<TestScalingPolicy> {
    return this.create(deploymentId, {
      name: 'CPU Scale Out Policy',
      metricType: 'cpu',
      threshold: 75,
      scaleDirection: 'out',
      scaleAmount: 2,
      cooldownPeriod: 300
    });
  }

  async createMemoryScaleInPolicy(deploymentId: string): Promise<TestScalingPolicy> {
    return this.create(deploymentId, {
      name: 'Memory Scale In Policy',
      metricType: 'memory',
      threshold: 30,
      scaleDirection: 'in',
      scaleAmount: 1,
      cooldownPeriod: 600
    });
  }
}

/**
 * Cleanup utilities for test factories
 */
export class TestDataCleanup {
  private db = DatabaseService.getInstance();

  async cleanupUser(userId: string): Promise<void> {
    // Clean up in reverse dependency order
    await this.db.query('DELETE FROM scaling_events WHERE deployment_id IN (SELECT id FROM deployments WHERE user_id = $1)', [userId]);
    await this.db.query('DELETE FROM scaling_policies WHERE deployment_id IN (SELECT id FROM deployments WHERE user_id = $1)', [userId]);
    await this.db.query('DELETE FROM deployment_logs WHERE deployment_id IN (SELECT id FROM deployments WHERE user_id = $1)', [userId]);
    await this.db.query('DELETE FROM environment_variables WHERE config_id IN (SELECT id FROM environment_configs WHERE project_id IN (SELECT id FROM projects WHERE user_id = $1))', [userId]);
    await this.db.query('DELETE FROM environment_configs WHERE project_id IN (SELECT id FROM projects WHERE user_id = $1)', [userId]);
    await this.db.query('DELETE FROM deployments WHERE user_id = $1', [userId]);
    await this.db.query('DELETE FROM projects WHERE user_id = $1', [userId]);
    await this.db.query('DELETE FROM users WHERE id = $1', [userId]);
  }

  async cleanupProject(projectId: string): Promise<void> {
    await this.db.query('DELETE FROM scaling_events WHERE deployment_id IN (SELECT id FROM deployments WHERE project_id = $1)', [projectId]);
    await this.db.query('DELETE FROM scaling_policies WHERE deployment_id IN (SELECT id FROM deployments WHERE project_id = $1)', [projectId]);
    await this.db.query('DELETE FROM deployment_logs WHERE deployment_id IN (SELECT id FROM deployments WHERE project_id = $1)', [projectId]);
    await this.db.query('DELETE FROM environment_variables WHERE config_id IN (SELECT id FROM environment_configs WHERE project_id = $1)', [projectId]);
    await this.db.query('DELETE FROM environment_configs WHERE project_id = $1', [projectId]);
    await this.db.query('DELETE FROM deployments WHERE project_id = $1', [projectId]);
    await this.db.query('DELETE FROM projects WHERE id = $1', [projectId]);
  }

  async cleanupDeployment(deploymentId: string): Promise<void> {
    await this.db.query('DELETE FROM scaling_events WHERE deployment_id = $1', [deploymentId]);
    await this.db.query('DELETE FROM scaling_policies WHERE deployment_id = $1', [deploymentId]);
    await this.db.query('DELETE FROM deployment_logs WHERE deployment_id = $1', [deploymentId]);
    await this.db.query('DELETE FROM deployments WHERE id = $1', [deploymentId]);
  }

  async cleanupAll(): Promise<void> {
    // Nuclear cleanup - use with caution!
    const tables = [
      'scaling_events',
      'scaling_policies',
      'deployment_logs',
      'environment_variables',
      'environment_configs',
      'deployments',
      'projects',
      'users'
    ];

    for (const table of tables) {
      await this.db.query(`TRUNCATE TABLE ${table} CASCADE`);
    }
  }
}