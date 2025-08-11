-- Migration 005: Auto-scaling and Resource Optimization System
-- This migration adds tables for auto-scaling policies, events, resource usage tracking, and cost optimization

-- Scaling Policies Table
CREATE TABLE scaling_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id VARCHAR(100) NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    policy_type VARCHAR(50) NOT NULL CHECK (policy_type IN ('threshold', 'multi_metric', 'predictive', 'scheduled')),
    
    -- Policy configuration stored as JSON
    policy_config JSONB NOT NULL,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Indexes
    UNIQUE(deployment_id, name)
);

-- Index for efficient policy lookups
CREATE INDEX idx_scaling_policies_deployment ON scaling_policies(deployment_id);
CREATE INDEX idx_scaling_policies_enabled ON scaling_policies(deployment_id, is_enabled);

-- Scaling Events Table
CREATE TABLE scaling_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id VARCHAR(100) NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
    policy_id UUID REFERENCES scaling_policies(id) ON DELETE SET NULL,
    
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('scale_up', 'scale_down', 'policy_change', 'manual_override')),
    from_instances INTEGER NOT NULL,
    to_instances INTEGER NOT NULL,
    reason TEXT NOT NULL,
    
    -- Snapshot of metrics that triggered the scaling event
    metrics_snapshot JSONB,
    
    -- Event timing
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Indexes for efficient queries
    INDEX (deployment_id, created_at DESC),
    INDEX (policy_id, created_at DESC)
);

-- Resource Usage Tracking Table
CREATE TABLE resource_usage (
    id BIGSERIAL PRIMARY KEY,
    deployment_id VARCHAR(100) NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
    
    -- Resource metrics
    cpu_usage DECIMAL(5,2) NOT NULL,           -- Percentage (0-100)
    memory_usage DECIMAL(5,2) NOT NULL,        -- Percentage (0-100)
    network_io BIGINT NOT NULL DEFAULT 0,      -- Bytes per second
    disk_io BIGINT NOT NULL DEFAULT 0,         -- Bytes per second
    
    -- Cost tracking
    cost_estimate DECIMAL(10,4) NOT NULL DEFAULT 0, -- Dollars per hour
    
    -- Timestamp
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Indexes for efficient queries
    INDEX (deployment_id, timestamp DESC),
    INDEX (timestamp) -- For cleanup operations
);

-- Partition resource_usage table by month for better performance
-- This helps with data retention and query performance
CREATE TABLE resource_usage_y2024m01 PARTITION OF resource_usage
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE resource_usage_y2024m02 PARTITION OF resource_usage
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

CREATE TABLE resource_usage_y2024m03 PARTITION OF resource_usage
    FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');

CREATE TABLE resource_usage_y2024m04 PARTITION OF resource_usage
    FOR VALUES FROM ('2024-04-01') TO ('2024-05-01');

CREATE TABLE resource_usage_y2024m05 PARTITION OF resource_usage
    FOR VALUES FROM ('2024-05-01') TO ('2024-06-01');

CREATE TABLE resource_usage_y2024m06 PARTITION OF resource_usage
    FOR VALUES FROM ('2024-06-01') TO ('2024-07-01');

CREATE TABLE resource_usage_y2024m07 PARTITION OF resource_usage
    FOR VALUES FROM ('2024-07-01') TO ('2024-08-01');

CREATE TABLE resource_usage_y2024m08 PARTITION OF resource_usage
    FOR VALUES FROM ('2024-08-01') TO ('2024-09-01');

CREATE TABLE resource_usage_y2024m09 PARTITION OF resource_usage
    FOR VALUES FROM ('2024-09-01') TO ('2024-10-01');

CREATE TABLE resource_usage_y2024m10 PARTITION OF resource_usage
    FOR VALUES FROM ('2024-10-01') TO ('2024-11-01');

CREATE TABLE resource_usage_y2024m11 PARTITION OF resource_usage
    FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');

CREATE TABLE resource_usage_y2024m12 PARTITION OF resource_usage
    FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');

-- Optimization Recommendations Table
CREATE TABLE optimization_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id VARCHAR(100) NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
    
    recommendation_type VARCHAR(100) NOT NULL CHECK (recommendation_type IN (
        'right_sizing', 'schedule_optimization', 'cost_reduction', 'performance_improvement'
    )),
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    
    -- Recommendation content
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    
    -- Impact analysis
    impact_data JSONB NOT NULL, -- costSavings, performanceImprovement, efficiency
    
    -- Implementation details  
    implementation_data JSONB NOT NULL, -- effort, risk, steps
    
    -- Status tracking
    is_implemented BOOLEAN NOT NULL DEFAULT false,
    implemented_at TIMESTAMPTZ,
    implementation_notes TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Indexes
    INDEX (deployment_id, created_at DESC),
    INDEX (deployment_id, recommendation_type),
    INDEX (deployment_id, is_implemented)
);

-- Cost Analytics Table (for aggregated cost data)
CREATE TABLE cost_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id VARCHAR(100) NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
    
    -- Time period
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    
    -- Cost breakdown
    total_cost DECIMAL(12,4) NOT NULL,
    compute_cost DECIMAL(12,4) NOT NULL DEFAULT 0,
    storage_cost DECIMAL(12,4) NOT NULL DEFAULT 0,
    network_cost DECIMAL(12,4) NOT NULL DEFAULT 0,
    other_cost DECIMAL(12,4) NOT NULL DEFAULT 0,
    
    -- Utilization metrics
    avg_cpu_usage DECIMAL(5,2) NOT NULL DEFAULT 0,
    avg_memory_usage DECIMAL(5,2) NOT NULL DEFAULT 0,
    avg_network_io BIGINT NOT NULL DEFAULT 0,
    avg_disk_io BIGINT NOT NULL DEFAULT 0,
    
    -- Efficiency score (0-1)
    efficiency_score DECIMAL(3,2) NOT NULL DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Indexes
    INDEX (deployment_id, period_start DESC),
    UNIQUE(deployment_id, period_start, period_end)
);

-- Budget Configuration Table
CREATE TABLE budget_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id VARCHAR(100) NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
    
    -- Budget limits
    monthly_limit DECIMAL(12,2) NOT NULL,
    
    -- Alert thresholds (percentages)
    warning_threshold DECIMAL(5,2) NOT NULL DEFAULT 75.00,
    critical_threshold DECIMAL(5,2) NOT NULL DEFAULT 90.00,
    
    -- Configuration
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    alert_emails TEXT[], -- Array of email addresses for alerts
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(deployment_id)
);

-- Instance Tracking Table (for auto-scaling)
CREATE TABLE deployment_instances (
    deployment_id VARCHAR(100) PRIMARY KEY REFERENCES deployments(id) ON DELETE CASCADE,
    current_instances INTEGER NOT NULL DEFAULT 1,
    target_instances INTEGER NOT NULL DEFAULT 1,
    last_scaling_action TIMESTAMPTZ,
    last_scaling_reason TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Functions for automatic partition creation
CREATE OR REPLACE FUNCTION create_monthly_partition(table_name text, year integer, month integer)
RETURNS void AS $$
DECLARE
    partition_name text;
    start_date text;
    end_date text;
BEGIN
    partition_name := format('%s_y%sm%02d', table_name, year, month);
    start_date := format('%s-%02d-01', year, month);
    
    -- Calculate end date (first day of next month)
    IF month = 12 THEN
        end_date := format('%s-01-01', year + 1);
    ELSE
        end_date := format('%s-%02d-01', year, month + 1);
    END IF;
    
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
                   partition_name, table_name, start_date, end_date);
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old resource usage data
CREATE OR REPLACE FUNCTION cleanup_old_resource_usage()
RETURNS void AS $$
BEGIN
    -- Delete resource usage data older than 3 months
    DELETE FROM resource_usage 
    WHERE timestamp < NOW() - INTERVAL '3 months';
    
    -- Log cleanup
    INSERT INTO deployment_logs (deployment_id, level, message, metadata)
    SELECT 
        'system' as deployment_id,
        'info' as level,
        'Resource usage cleanup completed' as message,
        jsonb_build_object('cleaned_at', NOW()) as metadata;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to tables with updated_at columns
CREATE TRIGGER update_scaling_policies_updated_at
    BEFORE UPDATE ON scaling_policies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_optimization_recommendations_updated_at
    BEFORE UPDATE ON optimization_recommendations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_budget_configs_updated_at
    BEFORE UPDATE ON budget_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deployment_instances_updated_at
    BEFORE UPDATE ON deployment_instances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Views for common queries

-- Active scaling policies view
CREATE VIEW active_scaling_policies AS
SELECT 
    p.*,
    d.name as deployment_name,
    d.status as deployment_status
FROM scaling_policies p
JOIN deployments d ON p.deployment_id = d.id
WHERE p.is_enabled = true;

-- Recent scaling events view
CREATE VIEW recent_scaling_events AS
SELECT 
    e.*,
    d.name as deployment_name,
    p.name as policy_name
FROM scaling_events e
JOIN deployments d ON e.deployment_id = d.id
LEFT JOIN scaling_policies p ON e.policy_id = p.id
WHERE e.created_at >= NOW() - INTERVAL '7 days'
ORDER BY e.created_at DESC;

-- Resource usage summary view
CREATE VIEW resource_usage_summary AS
SELECT 
    deployment_id,
    DATE_TRUNC('hour', timestamp) as hour,
    AVG(cpu_usage) as avg_cpu_usage,
    AVG(memory_usage) as avg_memory_usage,
    AVG(network_io) as avg_network_io,
    AVG(disk_io) as avg_disk_io,
    AVG(cost_estimate) as avg_hourly_cost
FROM resource_usage
WHERE timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY deployment_id, DATE_TRUNC('hour', timestamp)
ORDER BY deployment_id, hour DESC;

-- Cost analytics summary view
CREATE VIEW monthly_cost_summary AS
SELECT 
    deployment_id,
    DATE_TRUNC('month', period_start) as month,
    SUM(total_cost) as monthly_cost,
    AVG(efficiency_score) as avg_efficiency,
    COUNT(*) as analytics_count
FROM cost_analytics
GROUP BY deployment_id, DATE_TRUNC('month', period_start)
ORDER BY deployment_id, month DESC;

-- Comments for documentation
COMMENT ON TABLE scaling_policies IS 'Auto-scaling policies configuration for deployments';
COMMENT ON TABLE scaling_events IS 'Historical record of scaling events and their triggers';
COMMENT ON TABLE resource_usage IS 'Real-time resource usage tracking for cost and optimization analysis';
COMMENT ON TABLE optimization_recommendations IS 'AI-generated recommendations for cost and performance optimization';
COMMENT ON TABLE cost_analytics IS 'Aggregated cost analytics and utilization metrics';
COMMENT ON TABLE budget_configs IS 'Budget limits and alerting configuration for deployments';
COMMENT ON TABLE deployment_instances IS 'Current instance count tracking for auto-scaling';

-- Insert some default data

-- Default budget config for existing deployments (if any)
INSERT INTO budget_configs (deployment_id, monthly_limit, is_enabled)
SELECT id, 100.00, false -- Default $100 limit, disabled by default
FROM deployments
ON CONFLICT (deployment_id) DO NOTHING;

-- Initialize instance tracking for existing deployments
INSERT INTO deployment_instances (deployment_id, current_instances, target_instances)
SELECT id, 1, 1 -- Start with 1 instance
FROM deployments
ON CONFLICT (deployment_id) DO NOTHING;

-- Create initial monthly partitions for the next 6 months
SELECT create_monthly_partition('resource_usage', 2025, 1);
SELECT create_monthly_partition('resource_usage', 2025, 2);
SELECT create_monthly_partition('resource_usage', 2025, 3);
SELECT create_monthly_partition('resource_usage', 2025, 4);
SELECT create_monthly_partition('resource_usage', 2025, 5);
SELECT create_monthly_partition('resource_usage', 2025, 6);