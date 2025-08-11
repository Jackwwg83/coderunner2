-- Configuration Management Schema for P2-T04
-- Adds environment variable and configuration management tables

-- Enable encryption extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ## Table: environment_configs (Environment Configurations) ##
-- Stores environment configurations (dev, staging, prod) for each project
CREATE TABLE IF NOT EXISTS environment_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    environment VARCHAR(50) NOT NULL CHECK (environment IN ('development', 'staging', 'production')),
    name VARCHAR(255) NOT NULL, -- User-friendly name
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure only one active config per project-environment combination
    UNIQUE(project_id, environment, name)
);

-- ## Table: environment_variables (Configuration Variables) ##
-- Stores individual environment variables with encryption support
CREATE TABLE IF NOT EXISTS environment_variables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID NOT NULL REFERENCES environment_configs(id) ON DELETE CASCADE,
    key VARCHAR(255) NOT NULL,
    value TEXT NOT NULL, -- Encrypted if sensitive
    is_encrypted BOOLEAN NOT NULL DEFAULT false,
    is_required BOOLEAN NOT NULL DEFAULT false,
    description TEXT,
    variable_type VARCHAR(50) NOT NULL DEFAULT 'string' CHECK (variable_type IN ('string', 'number', 'boolean', 'secret', 'url', 'json')),
    default_value TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure unique keys within each configuration
    UNIQUE(config_id, key)
);

-- ## Table: config_templates (Configuration Templates) ##
-- Stores pre-built configuration templates for common frameworks
CREATE TABLE IF NOT EXISTS config_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL, -- 'nodejs', 'python', 'react', 'database', etc.
    framework VARCHAR(100), -- 'express', 'fastapi', 'create-react-app', etc.
    is_official BOOLEAN NOT NULL DEFAULT false,
    usage_count INTEGER NOT NULL DEFAULT 0,
    template_data JSONB NOT NULL, -- Template structure with variables and environments
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ## Table: config_audit_logs (Configuration Change Audit) ##
-- Tracks all configuration changes for security and compliance
CREATE TABLE IF NOT EXISTS config_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    project_id UUID NOT NULL REFERENCES projects(id),
    config_id UUID REFERENCES environment_configs(id),
    variable_id UUID REFERENCES environment_variables(id),
    action VARCHAR(50) NOT NULL CHECK (action IN ('create', 'update', 'delete', 'export', 'import', 'apply_template')),
    resource_type VARCHAR(50) NOT NULL CHECK (resource_type IN ('config', 'variable', 'template')),
    changes JSONB, -- Before/after values (encrypted if sensitive)
    metadata JSONB, -- IP, user agent, session info, etc.
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ## Table: encryption_keys (Encryption Key Management) ##
-- Stores encryption keys with rotation capability
CREATE TABLE IF NOT EXISTS encryption_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_id VARCHAR(100) NOT NULL UNIQUE, -- Human-readable key identifier
    key_data BYTEA NOT NULL, -- Encrypted master key
    algorithm VARCHAR(50) NOT NULL DEFAULT 'AES-256-GCM',
    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMPTZ, -- Key expiration for rotation
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- ## Indexes for Performance ##
CREATE INDEX IF NOT EXISTS idx_env_configs_project_env ON environment_configs(project_id, environment);
CREATE INDEX IF NOT EXISTS idx_env_configs_active ON environment_configs(is_active);
CREATE INDEX IF NOT EXISTS idx_env_variables_config ON environment_variables(config_id);
CREATE INDEX IF NOT EXISTS idx_env_variables_type ON environment_variables(variable_type);
CREATE INDEX IF NOT EXISTS idx_env_variables_encrypted ON environment_variables(is_encrypted);
CREATE INDEX IF NOT EXISTS idx_config_templates_category ON config_templates(category);
CREATE INDEX IF NOT EXISTS idx_config_templates_framework ON config_templates(framework);
CREATE INDEX IF NOT EXISTS idx_config_audit_project_time ON config_audit_logs(project_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_config_audit_user_time ON config_audit_logs(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_config_audit_action ON config_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_encryption_keys_active ON encryption_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_encryption_keys_expires ON encryption_keys(expires_at);

-- ## Triggers for Audit Logging ##
CREATE OR REPLACE FUNCTION log_config_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Log configuration changes
    IF TG_TABLE_NAME = 'environment_configs' THEN
        INSERT INTO config_audit_logs (
            user_id, 
            project_id, 
            config_id, 
            action, 
            resource_type, 
            changes,
            metadata
        ) VALUES (
            COALESCE(current_setting('app.current_user_id', true)::UUID, '00000000-0000-0000-0000-000000000000'::UUID),
            COALESCE(NEW.project_id, OLD.project_id),
            COALESCE(NEW.id, OLD.id),
            CASE 
                WHEN TG_OP = 'INSERT' THEN 'create'
                WHEN TG_OP = 'UPDATE' THEN 'update'
                WHEN TG_OP = 'DELETE' THEN 'delete'
            END,
            'config',
            jsonb_build_object(
                'old', CASE WHEN OLD IS NULL THEN NULL ELSE row_to_json(OLD) END,
                'new', CASE WHEN NEW IS NULL THEN NULL ELSE row_to_json(NEW) END
            ),
            jsonb_build_object(
                'table', TG_TABLE_NAME,
                'operation', TG_OP
            )
        );
    ELSIF TG_TABLE_NAME = 'environment_variables' THEN
        INSERT INTO config_audit_logs (
            user_id, 
            project_id, 
            config_id,
            variable_id,
            action, 
            resource_type, 
            changes,
            metadata
        ) VALUES (
            COALESCE(current_setting('app.current_user_id', true)::UUID, '00000000-0000-0000-0000-000000000000'::UUID),
            (SELECT project_id FROM environment_configs WHERE id = COALESCE(NEW.config_id, OLD.config_id)),
            COALESCE(NEW.config_id, OLD.config_id),
            COALESCE(NEW.id, OLD.id),
            CASE 
                WHEN TG_OP = 'INSERT' THEN 'create'
                WHEN TG_OP = 'UPDATE' THEN 'update'
                WHEN TG_OP = 'DELETE' THEN 'delete'
            END,
            'variable',
            jsonb_build_object(
                'old', CASE WHEN OLD IS NULL THEN NULL ELSE 
                    jsonb_build_object(
                        'key', OLD.key,
                        'value', CASE WHEN OLD.is_encrypted THEN '***ENCRYPTED***' ELSE OLD.value END,
                        'is_encrypted', OLD.is_encrypted,
                        'is_required', OLD.is_required,
                        'variable_type', OLD.variable_type
                    ) END,
                'new', CASE WHEN NEW IS NULL THEN NULL ELSE
                    jsonb_build_object(
                        'key', NEW.key,
                        'value', CASE WHEN NEW.is_encrypted THEN '***ENCRYPTED***' ELSE NEW.value END,
                        'is_encrypted', NEW.is_encrypted,
                        'is_required', NEW.is_required,
                        'variable_type', NEW.variable_type
                    ) END
            ),
            jsonb_build_object(
                'table', TG_TABLE_NAME,
                'operation', TG_OP
            )
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers for audit logging
DROP TRIGGER IF EXISTS config_audit_trigger ON environment_configs;
CREATE TRIGGER config_audit_trigger 
    AFTER INSERT OR UPDATE OR DELETE ON environment_configs 
    FOR EACH ROW EXECUTE FUNCTION log_config_changes();

DROP TRIGGER IF EXISTS variable_audit_trigger ON environment_variables;
CREATE TRIGGER variable_audit_trigger 
    AFTER INSERT OR UPDATE OR DELETE ON environment_variables 
    FOR EACH ROW EXECUTE FUNCTION log_config_changes();

-- ## Update Triggers for existing tables ##
DROP TRIGGER IF EXISTS update_env_configs_updated_at ON environment_configs;
CREATE TRIGGER update_env_configs_updated_at 
    BEFORE UPDATE ON environment_configs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_env_variables_updated_at ON environment_variables;
CREATE TRIGGER update_env_variables_updated_at 
    BEFORE UPDATE ON environment_variables 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_config_templates_updated_at ON config_templates;
CREATE TRIGGER update_config_templates_updated_at 
    BEFORE UPDATE ON config_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_encryption_keys_updated_at ON encryption_keys;
CREATE TRIGGER update_encryption_keys_updated_at 
    BEFORE UPDATE ON encryption_keys 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ## Insert Configuration Templates ##
-- Node.js/Express template
INSERT INTO config_templates (name, description, category, framework, is_official, template_data) VALUES (
    'Node.js Express Application',
    'Standard environment variables for Node.js Express applications',
    'nodejs',
    'express',
    true,
    '{
        "environments": ["development", "staging", "production"],
        "variables": [
            {
                "key": "NODE_ENV",
                "description": "Node.js environment mode",
                "variable_type": "string",
                "default_value": "development",
                "is_required": true,
                "environments": ["development", "staging", "production"]
            },
            {
                "key": "PORT",
                "description": "Application server port",
                "variable_type": "number",
                "default_value": "3000",
                "is_required": true,
                "environments": ["development", "staging", "production"]
            },
            {
                "key": "DATABASE_URL",
                "description": "PostgreSQL database connection string",
                "variable_type": "url",
                "is_required": true,
                "is_encrypted": true,
                "environments": ["staging", "production"]
            },
            {
                "key": "JWT_SECRET",
                "description": "Secret key for JWT token signing",
                "variable_type": "secret",
                "is_required": true,
                "is_encrypted": true,
                "environments": ["staging", "production"]
            },
            {
                "key": "REDIS_URL",
                "description": "Redis connection string for caching",
                "variable_type": "url",
                "is_required": false,
                "is_encrypted": true,
                "environments": ["staging", "production"]
            }
        ]
    }'
) ON CONFLICT (name) DO NOTHING;

-- React Application template
INSERT INTO config_templates (name, description, category, framework, is_official, template_data) VALUES (
    'React Application',
    'Standard environment variables for React applications',
    'react',
    'create-react-app',
    true,
    '{
        "environments": ["development", "staging", "production"],
        "variables": [
            {
                "key": "REACT_APP_API_URL",
                "description": "Backend API base URL",
                "variable_type": "url",
                "is_required": true,
                "environments": ["development", "staging", "production"]
            },
            {
                "key": "REACT_APP_WEBSOCKET_URL",
                "description": "WebSocket server URL",
                "variable_type": "url",
                "is_required": true,
                "environments": ["development", "staging", "production"]
            },
            {
                "key": "REACT_APP_VERSION",
                "description": "Application version",
                "variable_type": "string",
                "is_required": false,
                "environments": ["development", "staging", "production"]
            },
            {
                "key": "REACT_APP_ENVIRONMENT",
                "description": "Environment identifier for the app",
                "variable_type": "string",
                "is_required": false,
                "environments": ["development", "staging", "production"]
            }
        ]
    }'
) ON CONFLICT (name) DO NOTHING;

-- Python/FastAPI template
INSERT INTO config_templates (name, description, category, framework, is_official, template_data) VALUES (
    'Python FastAPI Application',
    'Standard environment variables for Python FastAPI applications',
    'python',
    'fastapi',
    true,
    '{
        "environments": ["development", "staging", "production"],
        "variables": [
            {
                "key": "PYTHON_ENV",
                "description": "Python environment mode",
                "variable_type": "string",
                "default_value": "development",
                "is_required": true,
                "environments": ["development", "staging", "production"]
            },
            {
                "key": "HOST",
                "description": "Application host",
                "variable_type": "string",
                "default_value": "0.0.0.0",
                "is_required": true,
                "environments": ["development", "staging", "production"]
            },
            {
                "key": "PORT",
                "description": "Application port",
                "variable_type": "number",
                "default_value": "8000",
                "is_required": true,
                "environments": ["development", "staging", "production"]
            },
            {
                "key": "DATABASE_URL",
                "description": "Database connection string",
                "variable_type": "url",
                "is_required": true,
                "is_encrypted": true,
                "environments": ["staging", "production"]
            },
            {
                "key": "SECRET_KEY",
                "description": "Application secret key",
                "variable_type": "secret",
                "is_required": true,
                "is_encrypted": true,
                "environments": ["staging", "production"]
            }
        ]
    }'
) ON CONFLICT (name) DO NOTHING;

-- Database Connection template
INSERT INTO config_templates (name, description, category, framework, is_official, template_data) VALUES (
    'Database Connection',
    'Common database connection environment variables',
    'database',
    'postgresql',
    true,
    '{
        "environments": ["development", "staging", "production"],
        "variables": [
            {
                "key": "DB_HOST",
                "description": "Database server hostname",
                "variable_type": "string",
                "default_value": "localhost",
                "is_required": true,
                "environments": ["development", "staging", "production"]
            },
            {
                "key": "DB_PORT",
                "description": "Database server port",
                "variable_type": "number",
                "default_value": "5432",
                "is_required": true,
                "environments": ["development", "staging", "production"]
            },
            {
                "key": "DB_NAME",
                "description": "Database name",
                "variable_type": "string",
                "is_required": true,
                "environments": ["development", "staging", "production"]
            },
            {
                "key": "DB_USER",
                "description": "Database username",
                "variable_type": "string",
                "is_required": true,
                "environments": ["development", "staging", "production"]
            },
            {
                "key": "DB_PASSWORD",
                "description": "Database password",
                "variable_type": "secret",
                "is_required": true,
                "is_encrypted": true,
                "environments": ["development", "staging", "production"]
            },
            {
                "key": "DB_SSL",
                "description": "Enable SSL for database connection",
                "variable_type": "boolean",
                "default_value": "false",
                "is_required": false,
                "environments": ["staging", "production"]
            }
        ]
    }'
) ON CONFLICT (name) DO NOTHING;

-- Log successful migration
DO $$
BEGIN
    RAISE NOTICE 'Configuration management schema initialized successfully';
    RAISE NOTICE 'Tables created: environment_configs, environment_variables, config_templates, config_audit_logs, encryption_keys';
    RAISE NOTICE 'Configuration templates inserted: Node.js Express, React, Python FastAPI, Database Connection';
    RAISE NOTICE 'Audit logging and encryption support enabled';
END $$;