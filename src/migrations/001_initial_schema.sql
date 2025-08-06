-- CodeRunner Database Schema v1.0
-- This file creates the initial database schema for CodeRunner

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ## Table: users (User Information) ##
-- Stores information about users of the CodeRunner service
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL, -- Store hashed password, never plaintext
    plan_type VARCHAR(50) NOT NULL DEFAULT 'free', -- e.g., 'free', 'personal', 'team'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index: Speed up email lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_plan_type ON users(plan_type);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- ## Table: projects (User Projects) ##
-- Stores metadata for user-created projects. One project can have multiple deployments.
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- When user is deleted, all projects are deleted
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index: Speed up user project lookups
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);
CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);

-- ## Enum: deployment_status ##
-- Define deployment status values
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deployment_status') THEN
        CREATE TYPE deployment_status AS ENUM (
            'PENDING',      -- Queued and waiting for deployment
            'PROVISIONING', -- Creating sandboxes and resources
            'BUILDING',     -- Installing dependencies, compiling code
            'RUNNING',      -- Successfully deployed and running
            'STOPPED',      -- Manually stopped by user
            'FAILED',       -- Error occurred during deployment
            'DESTROYED'     -- Deployment has been destroyed
        );
    END IF;
END $$;

-- ## Table: deployments (Deployment Instances) ##
-- Stores each specific deployment instance of a project. This is the core table of the system.
CREATE TABLE IF NOT EXISTS deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE, -- When project is deleted, all deployments are deleted

    -- Application sandbox information
    app_sandbox_id VARCHAR(255) UNIQUE, -- AgentSphere returned application sandbox ID
    public_url VARCHAR(255) UNIQUE,     -- Public access URL for the application

    -- Database sandbox information (can be NULL since not all apps need databases)
    db_sandbox_id VARCHAR(255) UNIQUE,  -- AgentSphere returned database sandbox ID
    db_connection_info JSONB,           -- Store encrypted database connection info like host, port, user, password

    -- Status and configuration
    status deployment_status NOT NULL DEFAULT 'PENDING',
    runtime_type VARCHAR(50),           -- e.g., 'nodejs', 'python', 'manifest'
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes: Speed up project deployment lookups and status queries
CREATE INDEX IF NOT EXISTS idx_deployments_project_id ON deployments(project_id);
CREATE INDEX IF NOT EXISTS idx_deployments_status ON deployments(status);
CREATE INDEX IF NOT EXISTS idx_deployments_app_sandbox_id ON deployments(app_sandbox_id);
CREATE INDEX IF NOT EXISTS idx_deployments_created_at ON deployments(created_at);
CREATE INDEX IF NOT EXISTS idx_deployments_runtime_type ON deployments(runtime_type);

-- ## Triggers: Automatically update updated_at timestamp ##
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for all tables
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at 
    BEFORE UPDATE ON projects 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_deployments_updated_at ON deployments;
CREATE TRIGGER update_deployments_updated_at 
    BEFORE UPDATE ON deployments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ## Additional Constraints ##
-- Ensure email addresses are properly formatted
ALTER TABLE users ADD CONSTRAINT check_email_format 
    CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Ensure plan types are valid
ALTER TABLE users ADD CONSTRAINT check_plan_type 
    CHECK (plan_type IN ('free', 'personal', 'team', 'enterprise', 'system'));

-- Ensure project names are not empty
ALTER TABLE projects ADD CONSTRAINT check_project_name_not_empty 
    CHECK (LENGTH(TRIM(name)) > 0);

-- Ensure URLs are properly formatted when present
ALTER TABLE deployments ADD CONSTRAINT check_public_url_format 
    CHECK (public_url IS NULL OR public_url ~ '^https?://');

-- ## Performance Optimizations ##
-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_deployments_project_status ON deployments(project_id, status);
CREATE INDEX IF NOT EXISTS idx_projects_user_created ON projects(user_id, created_at DESC);

-- ## Security ##
-- Enable Row Level Security (can be configured later)
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;

-- ## Insert Initial Data ##
-- Create a system user for internal operations (optional)
INSERT INTO users (id, email, password_hash, plan_type) 
VALUES (
    '00000000-0000-0000-0000-000000000000'::UUID,
    'system@coderunner.internal', 
    'SYSTEM_USER_NO_LOGIN',
    'system'
) ON CONFLICT (email) DO NOTHING;

-- Log successful migration
DO $$
BEGIN
    RAISE NOTICE 'CodeRunner database schema v1.0 initialized successfully';
    RAISE NOTICE 'Tables created: users, projects, deployments';
    RAISE NOTICE 'Indexes and triggers configured';
END $$;