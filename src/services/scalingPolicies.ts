import { DatabaseService } from './database';
import { AutoScalingService, ScalingPolicy, MetricThreshold } from './autoScaling';
import { logger } from '../utils/logger';

export interface PolicyTemplate {
  id: string;
  name: string;
  description: string;
  category: 'general' | 'web' | 'api' | 'batch' | 'ml';
  metrics: MetricThreshold[];
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  cooldownPeriod: number;
  minInstances: number;
  maxInstances: number;
  tags: string[];
}

export interface PolicyValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
}

/**
 * ScalingPoliciesService - Management of scaling policies and templates
 * 
 * Features:
 * - Predefined policy templates for different workloads
 * - Policy validation and recommendations
 * - Policy version management
 * - Template customization and sharing
 * - Best practices enforcement
 */
export class ScalingPoliciesService {
  private static instance: ScalingPoliciesService;
  private db: DatabaseService;
  private autoScaling: AutoScalingService;

  // Predefined policy templates
  private policyTemplates: Map<string, PolicyTemplate> = new Map();

  private constructor() {
    this.db = DatabaseService.getInstance();
    this.autoScaling = AutoScalingService.getInstance();
    this.initializePolicyTemplates();
    
    logger.info('📋 ScalingPoliciesService initialized with policy templates');
  }

  public static getInstance(): ScalingPoliciesService {
    if (!ScalingPoliciesService.instance) {
      ScalingPoliciesService.instance = new ScalingPoliciesService();
    }
    return ScalingPoliciesService.instance;
  }

  /**
   * Initialize predefined policy templates
   */
  private initializePolicyTemplates(): void {
    // Web Application Template
    this.policyTemplates.set('web-app-balanced', {
      id: 'web-app-balanced',
      name: 'Web Application - Balanced',
      description: 'Balanced scaling policy optimized for web applications with moderate traffic',
      category: 'web',
      metrics: [
        { metric: 'cpu', threshold: 0.7, comparison: 'gt', weight: 0.4 },
        { metric: 'memory', threshold: 0.75, comparison: 'gt', weight: 0.25 },
        { metric: 'response_time', threshold: 0.5, comparison: 'gt', weight: 0.25 },
        { metric: 'error_rate', threshold: 0.02, comparison: 'gt', weight: 0.1 }
      ],
      scaleUpThreshold: 0.7,
      scaleDownThreshold: 0.3,
      cooldownPeriod: 300,
      minInstances: 2,
      maxInstances: 10,
      tags: ['web', 'balanced', 'moderate-traffic']
    });

    // API Service Template
    this.policyTemplates.set('api-performance', {
      id: 'api-performance',
      name: 'API Service - Performance Focused',
      description: 'High-performance scaling for API services with strict SLA requirements',
      category: 'api',
      metrics: [
        { metric: 'response_time', threshold: 0.3, comparison: 'gt', weight: 0.5 },
        { metric: 'cpu', threshold: 0.6, comparison: 'gt', weight: 0.3 },
        { metric: 'error_rate', threshold: 0.01, comparison: 'gt', weight: 0.2 }
      ],
      scaleUpThreshold: 0.6,
      scaleDownThreshold: 0.4,
      cooldownPeriod: 180,
      minInstances: 3,
      maxInstances: 20,
      tags: ['api', 'performance', 'low-latency']
    });

    // Batch Processing Template
    this.policyTemplates.set('batch-cost-optimized', {
      id: 'batch-cost-optimized',
      name: 'Batch Processing - Cost Optimized',
      description: 'Cost-efficient scaling for batch processing workloads',
      category: 'batch',
      metrics: [
        { metric: 'cpu', threshold: 0.85, comparison: 'gt', weight: 0.6 },
        { metric: 'memory', threshold: 0.9, comparison: 'gt', weight: 0.4 }
      ],
      scaleUpThreshold: 0.8,
      scaleDownThreshold: 0.2,
      cooldownPeriod: 600,
      minInstances: 1,
      maxInstances: 5,
      tags: ['batch', 'cost-optimized', 'non-interactive']
    });

    // Machine Learning Template
    this.policyTemplates.set('ml-gpu-optimized', {
      id: 'ml-gpu-optimized',
      name: 'Machine Learning - GPU Optimized',
      description: 'Optimized for ML workloads with GPU requirements',
      category: 'ml',
      metrics: [
        { metric: 'cpu', threshold: 0.75, comparison: 'gt', weight: 0.3 },
        { metric: 'memory', threshold: 0.8, comparison: 'gt', weight: 0.4 },
        { metric: 'requests', threshold: 0.6, comparison: 'gt', weight: 0.3 }
      ],
      scaleUpThreshold: 0.75,
      scaleDownThreshold: 0.25,
      cooldownPeriod: 900, // Longer cooldown for expensive GPU instances
      minInstances: 1,
      maxInstances: 8,
      tags: ['ml', 'gpu', 'compute-intensive']
    });

    // Development Environment Template
    this.policyTemplates.set('dev-minimal', {
      id: 'dev-minimal',
      name: 'Development - Minimal Resources',
      description: 'Minimal scaling for development environments',
      category: 'general',
      metrics: [
        { metric: 'cpu', threshold: 0.9, comparison: 'gt', weight: 0.7 },
        { metric: 'memory', threshold: 0.95, comparison: 'gt', weight: 0.3 }
      ],
      scaleUpThreshold: 0.9,
      scaleDownThreshold: 0.1,
      cooldownPeriod: 1200, // 20 minutes
      minInstances: 1,
      maxInstances: 2,
      tags: ['development', 'minimal', 'cost-effective']
    });

    // High-Traffic Web App Template
    this.policyTemplates.set('web-app-aggressive', {
      id: 'web-app-aggressive',
      name: 'Web Application - High Traffic',
      description: 'Aggressive scaling for high-traffic web applications',
      category: 'web',
      metrics: [
        { metric: 'cpu', threshold: 0.6, comparison: 'gt', weight: 0.35 },
        { metric: 'memory', threshold: 0.65, comparison: 'gt', weight: 0.25 },
        { metric: 'response_time', threshold: 0.4, comparison: 'gt', weight: 0.25 },
        { metric: 'requests', threshold: 0.5, comparison: 'gt', weight: 0.15 }
      ],
      scaleUpThreshold: 0.6,
      scaleDownThreshold: 0.4,
      cooldownPeriod: 120,
      minInstances: 5,
      maxInstances: 50,
      tags: ['web', 'high-traffic', 'aggressive']
    });

    logger.info(`📚 Initialized ${this.policyTemplates.size} policy templates`);
  }

  /**
   * Get all available policy templates
   */
  public getPolicyTemplates(category?: string): PolicyTemplate[] {
    const templates = Array.from(this.policyTemplates.values());
    
    if (category) {
      return templates.filter(template => template.category === category);
    }
    
    return templates;
  }

  /**
   * Get specific policy template
   */
  public getPolicyTemplate(templateId: string): PolicyTemplate | null {
    return this.policyTemplates.get(templateId) || null;
  }

  /**
   * Create scaling policy from template
   */
  public async createPolicyFromTemplate(
    templateId: string,
    deploymentId: string,
    customizations?: Partial<ScalingPolicy>
  ): Promise<ScalingPolicy> {
    const template = this.getPolicyTemplate(templateId);
    if (!template) {
      throw new Error(`Policy template '${templateId}' not found`);
    }

    // Create policy from template
    const policyData = {
      deploymentId,
      name: customizations?.name || `${template.name} - ${deploymentId}`,
      metrics: customizations?.metrics || template.metrics,
      scaleUpThreshold: customizations?.scaleUpThreshold ?? template.scaleUpThreshold,
      scaleDownThreshold: customizations?.scaleDownThreshold ?? template.scaleDownThreshold,
      cooldownPeriod: customizations?.cooldownPeriod ?? template.cooldownPeriod,
      minInstances: customizations?.minInstances ?? template.minInstances,
      maxInstances: customizations?.maxInstances ?? template.maxInstances,
      isEnabled: customizations?.isEnabled ?? true
    };

    // Validate policy
    const validation = this.validateScalingPolicy(policyData);
    if (!validation.isValid) {
      throw new Error(`Policy validation failed: ${validation.errors.join(', ')}`);
    }

    // Create policy using auto-scaling service
    const policy = await this.autoScaling.createScalingPolicy(policyData);
    
    logger.info(`✅ Created scaling policy from template '${templateId}' for deployment ${deploymentId}`);
    
    return policy;
  }

  /**
   * Validate scaling policy configuration
   */
  public validateScalingPolicy(policyData: Omit<ScalingPolicy, 'id' | 'createdAt' | 'updatedAt'>): PolicyValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Basic validation
    if (!policyData.name?.trim()) {
      errors.push('Policy name is required');
    }

    if (!policyData.deploymentId?.trim()) {
      errors.push('Deployment ID is required');
    }

    if (!policyData.metrics || policyData.metrics.length === 0) {
      errors.push('At least one metric threshold is required');
    }

    // Threshold validation
    if (policyData.scaleUpThreshold <= policyData.scaleDownThreshold) {
      errors.push('Scale-up threshold must be greater than scale-down threshold');
    }

    if (policyData.scaleUpThreshold > 1 || policyData.scaleUpThreshold < 0) {
      errors.push('Scale-up threshold must be between 0 and 1');
    }

    if (policyData.scaleDownThreshold > 1 || policyData.scaleDownThreshold < 0) {
      errors.push('Scale-down threshold must be between 0 and 1');
    }

    // Instance count validation
    if (policyData.minInstances < 1) {
      errors.push('Minimum instances must be at least 1');
    }

    if (policyData.maxInstances < policyData.minInstances) {
      errors.push('Maximum instances must be greater than or equal to minimum instances');
    }

    if (policyData.maxInstances > 100) {
      warnings.push('Maximum instances is very high (>100), ensure this is intentional');
    }

    // Cooldown validation
    if (policyData.cooldownPeriod < 60) {
      warnings.push('Cooldown period is less than 60 seconds, which may cause scaling oscillation');
    }

    if (policyData.cooldownPeriod > 3600) {
      warnings.push('Cooldown period is greater than 1 hour, which may reduce responsiveness');
    }

    // Metrics validation
    if (policyData.metrics) {
      const totalWeight = policyData.metrics.reduce((sum, metric) => sum + metric.weight, 0);
      
      if (Math.abs(totalWeight - 1.0) > 0.01) {
        warnings.push(`Total metric weights (${totalWeight.toFixed(2)}) should sum to approximately 1.0`);
      }

      // Check for duplicate metrics
      const metricTypes = policyData.metrics.map(m => m.metric);
      const uniqueMetrics = new Set(metricTypes);
      if (metricTypes.length !== uniqueMetrics.size) {
        warnings.push('Duplicate metric types detected');
      }

      // Validate individual metrics
      for (const metric of policyData.metrics) {
        if (metric.weight < 0 || metric.weight > 1) {
          errors.push(`Metric weight for ${metric.metric} must be between 0 and 1`);
        }

        if (metric.threshold < 0 || metric.threshold > 1) {
          errors.push(`Metric threshold for ${metric.metric} must be between 0 and 1`);
        }
      }
    }

    // Generate recommendations
    if (policyData.scaleUpThreshold - policyData.scaleDownThreshold < 0.2) {
      recommendations.push('Consider increasing the gap between scale-up and scale-down thresholds to prevent oscillation');
    }

    if (policyData.maxInstances / policyData.minInstances > 10) {
      recommendations.push('Large scaling range detected. Consider using multiple scaling policies for different load levels');
    }

    if (policyData.metrics && policyData.metrics.length === 1) {
      recommendations.push('Consider adding additional metrics for more robust scaling decisions');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      recommendations
    };
  }

  /**
   * Get scaling policy recommendations based on workload type
   */
  public getRecommendedTemplates(workloadType: string, requirements?: {
    priority: 'cost' | 'performance' | 'balanced';
    trafficPattern: 'steady' | 'spiky' | 'batch';
    maxInstances?: number;
  }): PolicyTemplate[] {
    let templates = this.getPolicyTemplates();

    // Filter by workload type
    const workloadMappings: Record<string, string[]> = {
      'web': ['web-app-balanced', 'web-app-aggressive'],
      'api': ['api-performance', 'web-app-balanced'],
      'batch': ['batch-cost-optimized', 'dev-minimal'],
      'ml': ['ml-gpu-optimized', 'batch-cost-optimized'],
      'development': ['dev-minimal']
    };

    const recommendedIds = workloadMappings[workloadType] || [];
    templates = templates.filter(t => recommendedIds.includes(t.id));

    // Apply requirements filter
    if (requirements) {
      if (requirements.priority === 'cost') {
        templates = templates.filter(t => 
          t.tags.includes('cost-optimized') || 
          t.tags.includes('minimal')
        );
      } else if (requirements.priority === 'performance') {
        templates = templates.filter(t => 
          t.tags.includes('performance') || 
          t.tags.includes('aggressive')
        );
      }

      if (requirements.trafficPattern === 'spiky') {
        templates = templates.filter(t => 
          t.cooldownPeriod <= 300 && 
          t.scaleUpThreshold <= 0.7
        );
      } else if (requirements.trafficPattern === 'steady') {
        templates = templates.filter(t => 
          t.cooldownPeriod >= 300
        );
      }

      if (requirements.maxInstances) {
        templates = templates.filter(t => 
          t.maxInstances <= requirements.maxInstances!
        );
      }
    }

    return templates.sort((a, b) => {
      // Prioritize balanced templates
      if (a.tags.includes('balanced') && !b.tags.includes('balanced')) return -1;
      if (!a.tags.includes('balanced') && b.tags.includes('balanced')) return 1;
      return 0;
    });
  }

  /**
   * Clone and customize an existing policy
   */
  public async clonePolicy(
    sourcePolicyId: string,
    targetDeploymentId: string,
    customizations: Partial<ScalingPolicy>
  ): Promise<ScalingPolicy> {
    // Get source policy
    const sourcePolicy = await this.autoScaling.getScalingPolicy(sourcePolicyId);
    if (!sourcePolicy) {
      throw new Error(`Source policy '${sourcePolicyId}' not found`);
    }

    // Create new policy with customizations
    const policyData = {
      deploymentId: targetDeploymentId,
      name: customizations.name || `${sourcePolicy.name} (Copy)`,
      metrics: customizations.metrics || sourcePolicy.metrics,
      scaleUpThreshold: customizations.scaleUpThreshold ?? sourcePolicy.scaleUpThreshold,
      scaleDownThreshold: customizations.scaleDownThreshold ?? sourcePolicy.scaleDownThreshold,
      cooldownPeriod: customizations.cooldownPeriod ?? sourcePolicy.cooldownPeriod,
      minInstances: customizations.minInstances ?? sourcePolicy.minInstances,
      maxInstances: customizations.maxInstances ?? sourcePolicy.maxInstances,
      isEnabled: customizations.isEnabled ?? sourcePolicy.isEnabled
    };

    // Validate and create
    const validation = this.validateScalingPolicy(policyData);
    if (!validation.isValid) {
      throw new Error(`Policy validation failed: ${validation.errors.join(', ')}`);
    }

    const policy = await this.autoScaling.createScalingPolicy(policyData);
    
    logger.info(`📋 Cloned scaling policy from ${sourcePolicyId} to ${targetDeploymentId}`);
    
    return policy;
  }

  /**
   * Get policy performance analytics
   */
  public async getPolicyAnalytics(deploymentId: string): Promise<{
    scalingEvents: number;
    avgScalingTime: number;
    effectivenessScore: number;
    recommendations: string[];
  }> {
    try {
      const result = await this.db.query(`
        SELECT 
          COUNT(*) as total_events,
          AVG(EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (ORDER BY created_at)))) as avg_time_between_events
        FROM scaling_events 
        WHERE deployment_id = $1 
          AND created_at >= NOW() - INTERVAL '7 days'
      `, [deploymentId]);

      const scalingEvents = parseInt(result.rows[0]?.total_events || '0');
      const avgScalingTime = parseFloat(result.rows[0]?.avg_time_between_events || '0');

      // Calculate effectiveness score based on scaling frequency and timing
      let effectivenessScore = 1.0;
      const recommendations: string[] = [];

      if (scalingEvents > 50) {
        effectivenessScore -= 0.3;
        recommendations.push('High scaling frequency detected. Consider increasing cooldown periods.');
      }

      if (avgScalingTime < 300) { // Less than 5 minutes between events
        effectivenessScore -= 0.2;
        recommendations.push('Scaling oscillation detected. Review threshold settings.');
      }

      effectivenessScore = Math.max(effectivenessScore, 0);

      return {
        scalingEvents,
        avgScalingTime,
        effectivenessScore,
        recommendations
      };
    } catch (error) {
      logger.error('Failed to get policy analytics:', error);
      return {
        scalingEvents: 0,
        avgScalingTime: 0,
        effectivenessScore: 0,
        recommendations: ['Unable to analyze policy performance']
      };
    }
  }
}