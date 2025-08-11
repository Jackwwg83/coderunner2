import { Pool } from 'pg';
import { createDatabasePool } from '../config/database';
import { EncryptionService } from './encryption';
import {
  EnvironmentConfig,
  EnvironmentVariable,
  ConfigTemplate,
  ConfigAuditLog,
  CreateEnvironmentConfigRequest,
  CreateEnvironmentVariableRequest,
  ApplyTemplateRequest,
  ConfigurationDeploymentData
} from '../types';

/**
 * Configuration Service for managing environment variables and configurations
 * Provides encrypted storage, templates, and audit logging
 */
export class ConfigurationService {
  private static instance: ConfigurationService;
  private pool: Pool;
  private encryption: EncryptionService;

  private constructor() {
    this.pool = createDatabasePool();
    this.encryption = EncryptionService.getInstance();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ConfigurationService {
    if (!ConfigurationService.instance) {
      ConfigurationService.instance = new ConfigurationService();
    }
    return ConfigurationService.instance;
  }

  /**
   * Initialize the configuration service
   */
  async initialize(userId?: string): Promise<void> {
    await this.encryption.initialize(userId);
  }

  /**
   * Create new environment configuration
   */
  async createConfiguration(
    projectId: string, 
    config: CreateEnvironmentConfigRequest,
    userId: string
  ): Promise<EnvironmentConfig> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Set user context for audit logging
      await client.query('SELECT set_config($1, $2, true)', ['app.current_user_id', userId]);
      
      const result = await client.query(`
        INSERT INTO environment_configs (project_id, environment, name, description, is_active)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [projectId, config.environment, config.name, config.description || null, config.isActive !== false]);

      await client.query('COMMIT');
      
      const newConfig = this.mapDbRowToConfig(result.rows[0]);
      newConfig.variables = []; // New config has no variables yet
      
      return newConfig;
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Failed to create configuration: ${(error as any).message}`);
    } finally {
      client.release();
    }
  }

  /**
   * Get all configurations for a project
   */
  async getProjectConfigurations(projectId: string): Promise<EnvironmentConfig[]> {
    const result = await this.pool.query(`
      SELECT * FROM environment_configs 
      WHERE project_id = $1 
      ORDER BY environment, created_at DESC
    `, [projectId]);

    const configs = await Promise.all(
      result.rows.map(async (row) => {
        const config = this.mapDbRowToConfig(row);
        config.variables = await this.getConfigurationVariables(config.id);
        return config;
      })
    );

    return configs;
  }

  /**
   * Get configuration by ID
   */
  async getConfigurationById(configId: string): Promise<EnvironmentConfig | null> {
    const result = await this.pool.query(
      'SELECT * FROM environment_configs WHERE id = $1',
      [configId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const config = this.mapDbRowToConfig(result.rows[0]);
    config.variables = await this.getConfigurationVariables(configId);
    
    return config;
  }

  /**
   * Get variables for a configuration
   */
  async getConfigurationVariables(configId: string): Promise<EnvironmentVariable[]> {
    const result = await this.pool.query(`
      SELECT * FROM environment_variables 
      WHERE config_id = $1 
      ORDER BY key
    `, [configId]);

    return result.rows.map(this.mapDbRowToVariable);
  }

  /**
   * Add or update environment variable
   */
  async setVariable(
    configId: string,
    variable: CreateEnvironmentVariableRequest,
    userId: string
  ): Promise<EnvironmentVariable> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Set user context for audit logging
      await client.query('SELECT set_config($1, $2, true)', ['app.current_user_id', userId]);

      // Encrypt value if it's a secret or explicitly marked for encryption
      let finalValue = variable.value;
      const shouldEncrypt = variable.isEncrypted || variable.variableType === 'secret';
      
      if (shouldEncrypt && variable.value) {
        finalValue = await this.encryption.encrypt(variable.value);
      }

      const result = await client.query(`
        INSERT INTO environment_variables (config_id, key, value, is_encrypted, is_required, description, variable_type, default_value)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (config_id, key) 
        DO UPDATE SET 
          value = EXCLUDED.value,
          is_encrypted = EXCLUDED.is_encrypted,
          is_required = EXCLUDED.is_required,
          description = EXCLUDED.description,
          variable_type = EXCLUDED.variable_type,
          default_value = EXCLUDED.default_value,
          updated_at = NOW()
        RETURNING *
      `, [
        configId, 
        variable.key, 
        finalValue, 
        shouldEncrypt,
        variable.isRequired || false,
        variable.description || null,
        variable.variableType || 'string',
        variable.defaultValue || null
      ]);

      await client.query('COMMIT');
      
      return this.mapDbRowToVariable(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Failed to set variable: ${(error as any).message}`);
    } finally {
      client.release();
    }
  }

  /**
   * Delete environment variable
   */
  async deleteVariable(configId: string, key: string, userId: string): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Set user context for audit logging
      await client.query('SELECT set_config($1, $2, true)', ['app.current_user_id', userId]);

      const result = await client.query(
        'DELETE FROM environment_variables WHERE config_id = $1 AND key = $2',
        [configId, key]
      );

      if (result.rowCount === 0) {
        throw new Error('Variable not found');
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get configuration with decrypted variables for deployment
   */
  async getConfigurationForDeployment(
    projectId: string, 
    environment: string
  ): Promise<ConfigurationDeploymentData> {
    const result = await this.pool.query(`
      SELECT ev.key, ev.value, ev.is_encrypted, ec.updated_at
      FROM environment_configs ec
      JOIN environment_variables ev ON ec.id = ev.config_id
      WHERE ec.project_id = $1 AND ec.environment = $2 AND ec.is_active = true
      ORDER BY ev.key
    `, [projectId, environment]);

    const variables: Record<string, string> = {};
    let lastUpdated = new Date();

    for (const row of result.rows) {
      let value = row.value;
      
      if (row.is_encrypted && value) {
        try {
          value = await this.encryption.decrypt(value);
        } catch (error) {
          console.error(`Failed to decrypt variable ${row.key}:`, error.message);
          // Skip this variable rather than failing the entire deployment
          continue;
        }
      }
      
      variables[row.key] = value;
      
      // Track the most recent update
      if (row.updated_at > lastUpdated) {
        lastUpdated = row.updated_at;
      }
    }

    return {
      variables,
      environment,
      lastUpdated
    };
  }

  /**
   * Get available configuration templates
   */
  async getTemplates(category?: string): Promise<ConfigTemplate[]> {
    let query = 'SELECT * FROM config_templates WHERE 1=1';
    const params: any[] = [];

    if (category) {
      query += ' AND category = $1';
      params.push(category);
    }

    query += ' ORDER BY is_official DESC, usage_count DESC, name';

    const result = await this.pool.query(query, params);
    return result.rows.map(this.mapDbRowToTemplate);
  }

  /**
   * Get template by ID
   */
  async getTemplateById(templateId: string): Promise<ConfigTemplate> {
    const result = await this.pool.query(
      'SELECT * FROM config_templates WHERE id = $1',
      [templateId]
    );

    if (result.rows.length === 0) {
      throw new Error('Template not found');
    }

    return this.mapDbRowToTemplate(result.rows[0]);
  }

  /**
   * Apply template to create configuration
   */
  async applyTemplate(
    projectId: string,
    request: ApplyTemplateRequest,
    userId: string
  ): Promise<EnvironmentConfig> {
    const template = await this.getTemplateById(request.templateId);
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      
      // Set user context for audit logging
      await client.query('SELECT set_config($1, $2, true)', ['app.current_user_id', userId]);

      // Create configuration
      const config = await this.createConfiguration(
        projectId,
        {
          environment: request.environment,
          name: `${template.name} - ${request.environment}`,
          description: `Configuration based on ${template.name} template`,
          isActive: true
        },
        userId
      );

      // Apply template variables
      for (const templateVar of template.templateData.variables) {
        // Skip if this variable is not for this environment
        if (templateVar.environments && !templateVar.environments.includes(request.environment)) {
          continue;
        }

        const value = request.overrides[templateVar.key] || templateVar.defaultValue || '';
        
        if (templateVar.isRequired && !value) {
          throw new Error(`Required variable ${templateVar.key} is missing`);
        }

        if (value) {
          await this.setVariable(config.id, {
            key: templateVar.key,
            value,
            isEncrypted: templateVar.isEncrypted || false,
            isRequired: templateVar.isRequired,
            description: templateVar.description,
            variableType: templateVar.variableType,
            defaultValue: templateVar.defaultValue
          }, userId);
        }
      }

      // Increment template usage count
      await client.query(
        'UPDATE config_templates SET usage_count = usage_count + 1 WHERE id = $1',
        [request.templateId]
      );

      await client.query('COMMIT');

      return await this.getConfigurationById(config.id)!;
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Failed to apply template: ${(error as any).message}`);
    } finally {
      client.release();
    }
  }

  /**
   * Get configuration audit logs
   */
  async getAuditLogs(
    projectId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ logs: ConfigAuditLog[]; total: number }> {
    const countResult = await this.pool.query(
      'SELECT COUNT(*) as total FROM config_audit_logs WHERE project_id = $1',
      [projectId]
    );

    const result = await this.pool.query(`
      SELECT cal.*, u.email as user_email 
      FROM config_audit_logs cal
      LEFT JOIN users u ON cal.user_id = u.id
      WHERE cal.project_id = $1
      ORDER BY cal.timestamp DESC
      LIMIT $2 OFFSET $3
    `, [projectId, limit, offset]);

    const logs = result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      projectId: row.project_id,
      configId: row.config_id,
      variableId: row.variable_id,
      action: row.action,
      resourceType: row.resource_type,
      changes: row.changes,
      metadata: { ...row.metadata, userEmail: row.user_email },
      timestamp: row.timestamp
    }));

    return {
      logs,
      total: parseInt(countResult.rows[0].total)
    };
  }

  /**
   * Hot-reload configuration for running deployment
   */
  async reloadConfiguration(deploymentId: string): Promise<void> {
    // Get deployment info
    const deploymentResult = await this.pool.query(
      'SELECT project_id, status FROM deployments WHERE id = $1',
      [deploymentId]
    );

    if (deploymentResult.rows.length === 0) {
      throw new Error('Deployment not found');
    }

    const { project_id, status } = deploymentResult.rows[0];

    if (status !== 'RUNNING') {
      throw new Error('Configuration can only be reloaded for running deployments');
    }

    // Get current configuration
    const config = await this.getConfigurationForDeployment(project_id, 'production');

    // TODO: Integrate with AgentSphere to update environment variables in running sandbox
    // This would use AgentSphere SDK to inject new environment variables
    console.log(`Reloading configuration for deployment ${deploymentId}`, {
      variableCount: Object.keys(config.variables).length,
      lastUpdated: config.lastUpdated
    });

    // Log the reload action
    await this.pool.query(`
      INSERT INTO config_audit_logs (user_id, project_id, action, resource_type, metadata)
      VALUES ($1, $2, 'export', 'config', $3)
    `, [
      '00000000-0000-0000-0000-000000000000', // System user
      project_id,
      JSON.stringify({
        deployment_id: deploymentId,
        action: 'hot_reload',
        variable_count: Object.keys(config.variables).length
      })
    ]);
  }

  /**
   * Export configuration as environment file format
   */
  async exportConfiguration(
    configId: string,
    format: 'env' | 'json' | 'yaml' = 'env'
  ): Promise<string> {
    const config = await this.getConfigurationById(configId);
    if (!config) {
      throw new Error('Configuration not found');
    }

    const variables: Record<string, string> = {};
    
    // Decrypt variables for export
    for (const variable of config.variables) {
      let value = variable.value;
      
      if (variable.isEncrypted && value) {
        try {
          value = await this.encryption.decrypt(value);
        } catch (error) {
          console.warn(`Failed to decrypt variable ${variable.key} for export`);
          value = '[DECRYPT_ERROR]';
        }
      }
      
      variables[variable.key] = value;
    }

    switch (format) {
    case 'json':
      return JSON.stringify(variables, null, 2);
      
    case 'yaml':
      return Object.entries(variables)
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        .join('\n');
      
    case 'env':
    default:
      return Object.entries(variables)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
    }
  }

  // Helper methods
  private mapDbRowToConfig(row: any): EnvironmentConfig {
    return {
      id: row.id,
      projectId: row.project_id,
      environment: row.environment,
      name: row.name,
      description: row.description,
      variables: [], // Loaded separately
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapDbRowToVariable(row: any): EnvironmentVariable {
    return {
      id: row.id,
      configId: row.config_id,
      key: row.key,
      value: row.value,
      isEncrypted: row.is_encrypted,
      isRequired: row.is_required,
      description: row.description,
      variableType: row.variable_type,
      defaultValue: row.default_value,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapDbRowToTemplate(row: any): ConfigTemplate {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      framework: row.framework,
      isOfficial: row.is_official,
      usageCount: row.usage_count,
      templateData: row.template_data,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Cleanup - close database connections
   */
  async cleanup(): Promise<void> {
    await this.pool.end();
  }
}

export default ConfigurationService;