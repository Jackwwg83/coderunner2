import { EventEmitter } from 'events';
import { DatabaseService } from './database';
import { MetricsService } from './metrics';
import { AutoScalingService, ScalingMetrics } from './autoScaling';
import { WebSocketService } from './websocket';
import { logger } from '../utils/logger';

export interface ResourceUsage {
  deploymentId: string;
  timestamp: Date;
  cpuUsage: number; // percentage
  memoryUsage: number; // percentage
  networkIO: number; // bytes/second
  diskIO: number; // bytes/second
  costEstimate: number; // dollars per hour
}

export interface CostAnalytics {
  deploymentId: string;
  periodStart: Date;
  periodEnd: Date;
  totalCost: number;
  costBreakdown: {
    compute: number;
    storage: number;
    network: number;
    other: number;
  };
  utilizationMetrics: {
    avgCpuUsage: number;
    avgMemoryUsage: number;
    avgNetworkIO: number;
    avgDiskIO: number;
  };
  efficiency: number; // 0-1, how efficiently resources are used
}

export interface OptimizationRecommendation {
  id: string;
  deploymentId: string;
  type: 'right_sizing' | 'schedule_optimization' | 'cost_reduction' | 'performance_improvement';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: {
    costSavings: number; // dollars per month
    performanceImprovement: number; // percentage
    efficiency: number; // percentage improvement
  };
  implementation: {
    effort: 'low' | 'medium' | 'high';
    risk: 'low' | 'medium' | 'high';
    steps: string[];
  };
  createdAt: Date;
  isImplemented: boolean;
}

export interface BudgetConfig {
  deploymentId: string;
  monthlyLimit: number; // dollars
  alertThresholds: {
    warning: number; // percentage of limit
    critical: number; // percentage of limit
  };
  isEnabled: boolean;
}

export interface ResourceRightsizing {
  currentSpecs: {
    cpu: number; // cores
    memory: number; // GB
    storage: number; // GB
  };
  recommendedSpecs: {
    cpu: number;
    memory: number;
    storage: number;
  };
  utilizationAnalysis: {
    cpuUtilization: number; // average percentage
    memoryUtilization: number;
    storageUtilization: number;
  };
  costImpact: {
    currentCost: number; // per hour
    recommendedCost: number;
    savings: number; // per hour
  };
}

/**
 * ResourceOptimizerService - Intelligent resource optimization and cost management
 * 
 * Features:
 * - Real-time resource usage tracking
 * - Cost analytics and forecasting
 * - Automated optimization recommendations
 * - Budget management and alerting
 * - Right-sizing analysis
 * - Performance vs cost optimization
 */
export class ResourceOptimizerService extends EventEmitter {
  private static instance: ResourceOptimizerService;
  private db: DatabaseService;
  private metrics: MetricsService;
  private autoScaling: AutoScalingService;
  private websocket: WebSocketService;

  // Resource tracking
  private resourceUsageHistory: Map<string, ResourceUsage[]> = new Map();
  
  // Cost tracking
  private costAnalytics: Map<string, CostAnalytics> = new Map();
  
  // Budget management
  private budgetConfigs: Map<string, BudgetConfig> = new Map();
  
  // Optimization engine
  private analysisInterval?: NodeJS.Timeout | undefined;
  private analysisFrequency = 300000; // 5 minutes
  
  // Resource pricing (mock rates - would be dynamic in production)
  private readonly resourcePricing = {
    cpu: 0.05, // dollars per core per hour
    memory: 0.01, // dollars per GB per hour  
    storage: 0.001, // dollars per GB per hour
    network: 0.00001, // dollars per MB transferred
  };

  private constructor() {
    super();
    this.db = DatabaseService.getInstance();
    this.metrics = MetricsService.getInstance();
    this.autoScaling = AutoScalingService.getInstance();
    this.websocket = WebSocketService.getInstance();
    
    logger.info('💰 ResourceOptimizerService initialized');
  }

  public static getInstance(): ResourceOptimizerService {
    if (!ResourceOptimizerService.instance) {
      ResourceOptimizerService.instance = new ResourceOptimizerService();
    }
    return ResourceOptimizerService.instance;
  }

  /**
   * Start resource optimization analysis
   */
  public startOptimization(): void {
    if (this.analysisInterval) {
      logger.warn('⚠️ Resource optimization already running');
      return;
    }

    this.analysisInterval = setInterval(async () => {
      await this.performOptimizationAnalysis();
    }, this.analysisFrequency);

    logger.info('✅ Resource optimization analysis started');
  }

  /**
   * Stop resource optimization analysis
   */
  public stopOptimization(): void {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = undefined;
      logger.info('🛑 Resource optimization analysis stopped');
    }
  }

  /**
   * Track resource usage for a deployment
   */
  public async trackResourceUsage(deploymentId: string): Promise<void> {
    try {
      // Get current metrics from scaling service
      const scalingMetrics = await this.collectScalingMetrics(deploymentId);
      if (!scalingMetrics) return;

      // Get system metrics
      const systemMetrics = this.metrics.getCurrentMetrics();
      
      // Calculate cost estimate
      const costEstimate = this.calculateHourlyCost(deploymentId, {
        cpuUsage: scalingMetrics.cpuUsage,
        memoryUsage: scalingMetrics.memoryUsage
      });

      const resourceUsage: ResourceUsage = {
        deploymentId,
        timestamp: new Date(),
        cpuUsage: scalingMetrics.cpuUsage,
        memoryUsage: scalingMetrics.memoryUsage,
        networkIO: Math.random() * 1000000, // Mock network I/O
        diskIO: Math.random() * 500000, // Mock disk I/O
        costEstimate
      };

      // Store in memory for quick access
      if (!this.resourceUsageHistory.has(deploymentId)) {
        this.resourceUsageHistory.set(deploymentId, []);
      }
      const history = this.resourceUsageHistory.get(deploymentId)!;
      history.push(resourceUsage);

      // Keep only last 288 entries (24 hours at 5-minute intervals)
      if (history.length > 288) {
        history.shift();
      }

      // Store in database
      await this.storeResourceUsage(resourceUsage);

      // Check budget alerts
      await this.checkBudgetAlerts(deploymentId, resourceUsage);

    } catch (error) {
      logger.error('Failed to track resource usage:', error);
    }
  }

  /**
   * Store resource usage in database
   */
  private async storeResourceUsage(usage: ResourceUsage): Promise<void> {
    try {
      await this.db.query(`
        INSERT INTO resource_usage (
          deployment_id, cpu_usage, memory_usage, network_io,
          disk_io, cost_estimate, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        usage.deploymentId,
        usage.cpuUsage,
        usage.memoryUsage,
        usage.networkIO,
        usage.diskIO,
        usage.costEstimate,
        usage.timestamp
      ]);
    } catch (error) {
      logger.error('Failed to store resource usage:', error);
    }
  }

  /**
   * Calculate hourly cost for deployment
   */
  private calculateHourlyCost(deploymentId: string, metrics: {
    cpuUsage: number;
    memoryUsage: number;
  }): number {
    // Get current instance count from auto-scaling service
    const scalingStatus = this.autoScaling.getScalingStatus(deploymentId);
    const instanceCount = scalingStatus.currentInstances;

    // Mock resource specs per instance
    const specsPerInstance = {
      cpu: 2, // 2 cores
      memory: 4, // 4 GB
      storage: 20 // 20 GB
    };

    // Calculate cost based on actual usage
    const cpuCost = (specsPerInstance.cpu * instanceCount) * (metrics.cpuUsage / 100) * this.resourcePricing.cpu;
    const memoryCost = (specsPerInstance.memory * instanceCount) * (metrics.memoryUsage / 100) * this.resourcePricing.memory;
    const storageCost = (specsPerInstance.storage * instanceCount) * this.resourcePricing.storage;

    return cpuCost + memoryCost + storageCost;
  }

  /**
   * Generate cost analytics for a deployment
   */
  public async generateCostAnalytics(
    deploymentId: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<CostAnalytics> {
    try {
      const result = await this.db.query(`
        SELECT 
          AVG(cpu_usage) as avg_cpu,
          AVG(memory_usage) as avg_memory,
          AVG(network_io) as avg_network,
          AVG(disk_io) as avg_disk,
          SUM(cost_estimate) as total_cost_per_hour,
          COUNT(*) as data_points
        FROM resource_usage 
        WHERE deployment_id = $1 
          AND timestamp >= $2 
          AND timestamp <= $3
      `, [deploymentId, startDate, endDate]);

      if (result.rows.length === 0) {
        throw new Error('No resource usage data found');
      }

      const row = result.rows[0];
      const hoursInPeriod = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
      const totalCost = (parseFloat(row.total_cost_per_hour) || 0) * (hoursInPeriod / (parseInt(row.data_points) || 1));

      const analytics: CostAnalytics = {
        deploymentId,
        periodStart: startDate,
        periodEnd: endDate,
        totalCost,
        costBreakdown: {
          compute: totalCost * 0.7, // Mock breakdown
          storage: totalCost * 0.15,
          network: totalCost * 0.1,
          other: totalCost * 0.05
        },
        utilizationMetrics: {
          avgCpuUsage: parseFloat(row.avg_cpu) || 0,
          avgMemoryUsage: parseFloat(row.avg_memory) || 0,
          avgNetworkIO: parseFloat(row.avg_network) || 0,
          avgDiskIO: parseFloat(row.avg_disk) || 0
        },
        efficiency: this.calculateEfficiency({
          avgCpuUsage: parseFloat(row.avg_cpu) || 0,
          avgMemoryUsage: parseFloat(row.avg_memory) || 0,
          avgNetworkIO: parseFloat(row.avg_network) || 0,
          avgDiskIO: parseFloat(row.avg_disk) || 0
        })
      };

      // Cache analytics
      this.costAnalytics.set(deploymentId, analytics);

      return analytics;
    } catch (error) {
      logger.error('Failed to generate cost analytics:', error);
      throw error;
    }
  }

  /**
   * Calculate resource efficiency score
   */
  private calculateEfficiency(metrics: {
    avgCpuUsage: number;
    avgMemoryUsage: number;
    avgNetworkIO: number;
    avgDiskIO: number;
  }): number {
    // Efficiency is based on how well resources are utilized
    // Ideal utilization is around 70-80% for most resources
    const idealUtilization = 75;
    const tolerance = 15;

    const cpuEfficiency = Math.max(0, 1 - Math.abs(metrics.avgCpuUsage - idealUtilization) / 100);
    const memoryEfficiency = Math.max(0, 1 - Math.abs(metrics.avgMemoryUsage - idealUtilization) / 100);
    
    // Network and disk are less critical for efficiency score
    const overallEfficiency = (cpuEfficiency * 0.5) + (memoryEfficiency * 0.3) + 0.2;
    
    return Math.min(overallEfficiency, 1);
  }

  /**
   * Generate optimization recommendations
   */
  public async generateOptimizationRecommendations(deploymentId: string): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    try {
      // Get recent cost analytics
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (7 * 24 * 60 * 60 * 1000)); // Last 7 days
      const analytics = await this.generateCostAnalytics(deploymentId, startDate, endDate);

      // Right-sizing recommendations
      if (analytics.utilizationMetrics.avgCpuUsage < 30) {
        recommendations.push({
          id: `rec_${Date.now()}_cpu_downsize`,
          deploymentId,
          type: 'right_sizing',
          priority: 'medium',
          title: 'CPU Over-provisioning Detected',
          description: `CPU utilization is only ${analytics.utilizationMetrics.avgCpuUsage.toFixed(1)}%. Consider reducing CPU allocation.`,
          impact: {
            costSavings: analytics.totalCost * 0.3 * 30, // 30% savings monthly
            performanceImprovement: 0,
            efficiency: 25
          },
          implementation: {
            effort: 'low',
            risk: 'low',
            steps: [
              'Monitor CPU usage for another week to confirm trend',
              'Reduce CPU allocation by 25-50%',
              'Monitor performance after change',
              'Adjust further if needed'
            ]
          },
          createdAt: new Date(),
          isImplemented: false
        });
      }

      if (analytics.utilizationMetrics.avgMemoryUsage < 40) {
        recommendations.push({
          id: `rec_${Date.now()}_memory_downsize`,
          deploymentId,
          type: 'right_sizing',
          priority: 'medium',
          title: 'Memory Over-provisioning Detected',
          description: `Memory utilization is only ${analytics.utilizationMetrics.avgMemoryUsage.toFixed(1)}%. Consider reducing memory allocation.`,
          impact: {
            costSavings: analytics.totalCost * 0.2 * 30, // 20% savings monthly
            performanceImprovement: 0,
            efficiency: 20
          },
          implementation: {
            effort: 'low',
            risk: 'medium',
            steps: [
              'Analyze memory usage patterns',
              'Reduce memory allocation by 20-30%',
              'Monitor for memory pressure',
              'Set up memory alerts'
            ]
          },
          createdAt: new Date(),
          isImplemented: false
        });
      }

      // Performance recommendations
      if (analytics.utilizationMetrics.avgCpuUsage > 85) {
        recommendations.push({
          id: `rec_${Date.now()}_cpu_upsize`,
          deploymentId,
          type: 'performance_improvement',
          priority: 'high',
          title: 'CPU Bottleneck Detected',
          description: `CPU utilization is ${analytics.utilizationMetrics.avgCpuUsage.toFixed(1)}%. Performance may be degraded.`,
          impact: {
            costSavings: -analytics.totalCost * 0.3 * 30, // Cost increase
            performanceImprovement: 40,
            efficiency: -10
          },
          implementation: {
            effort: 'low',
            risk: 'low',
            steps: [
              'Increase CPU allocation by 25-50%',
              'Monitor performance improvement',
              'Enable auto-scaling for future spikes',
              'Consider application optimization'
            ]
          },
          createdAt: new Date(),
          isImplemented: false
        });
      }

      // Cost optimization recommendations
      if (analytics.efficiency < 0.6) {
        recommendations.push({
          id: `rec_${Date.now()}_efficiency_improve`,
          deploymentId,
          type: 'cost_reduction',
          priority: 'high',
          title: 'Low Resource Efficiency Detected',
          description: `Resource efficiency is only ${(analytics.efficiency * 100).toFixed(1)}%. Significant cost savings possible.`,
          impact: {
            costSavings: analytics.totalCost * (1 - analytics.efficiency) * 30,
            performanceImprovement: 0,
            efficiency: (1 - analytics.efficiency) * 100
          },
          implementation: {
            effort: 'medium',
            risk: 'medium',
            steps: [
              'Implement resource monitoring and alerting',
              'Enable aggressive auto-scaling policies',
              'Consider scheduled scaling for predictable workloads',
              'Optimize application resource usage'
            ]
          },
          createdAt: new Date(),
          isImplemented: false
        });
      }

      // Store recommendations in database
      for (const rec of recommendations) {
        await this.storeOptimizationRecommendation(rec);
      }

      logger.info(`💡 Generated ${recommendations.length} optimization recommendations for deployment ${deploymentId}`);

      return recommendations;
    } catch (error) {
      logger.error('Failed to generate optimization recommendations:', error);
      return [];
    }
  }

  /**
   * Store optimization recommendation in database
   */
  private async storeOptimizationRecommendation(recommendation: OptimizationRecommendation): Promise<void> {
    try {
      await this.db.query(`
        INSERT INTO optimization_recommendations (
          id, deployment_id, recommendation_type, priority,
          title, description, impact_data, implementation_data,
          created_at, is_implemented
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        recommendation.id,
        recommendation.deploymentId,
        recommendation.type,
        recommendation.priority,
        recommendation.title,
        recommendation.description,
        JSON.stringify(recommendation.impact),
        JSON.stringify(recommendation.implementation),
        recommendation.createdAt,
        recommendation.isImplemented
      ]);
    } catch (error) {
      logger.error('Failed to store optimization recommendation:', error);
    }
  }

  /**
   * Set budget configuration for deployment
   */
  public async setBudgetConfig(config: BudgetConfig): Promise<void> {
    this.budgetConfigs.set(config.deploymentId, config);
    
    // Store in database (would be implemented with proper schema)
    logger.info(`💵 Budget configuration set for deployment ${config.deploymentId}: $${config.monthlyLimit}/month`);
  }

  /**
   * Check budget alerts
   */
  private async checkBudgetAlerts(deploymentId: string, usage: ResourceUsage): Promise<void> {
    const budgetConfig = this.budgetConfigs.get(deploymentId);
    if (!budgetConfig || !budgetConfig.isEnabled) return;

    // Calculate current month's spending
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    try {
      const result = await this.db.query(`
        SELECT SUM(cost_estimate) as total_spent_per_hour, COUNT(*) as hours
        FROM resource_usage 
        WHERE deployment_id = $1 AND timestamp >= $2
      `, [deploymentId, monthStart]);

      if (result.rows.length === 0) return;

      const totalSpentPerHour = parseFloat(result.rows[0].total_spent_per_hour) || 0;
      const hours = parseInt(result.rows[0].hours) || 0;
      const totalSpent = totalSpentPerHour * hours;
      
      const spendingPercentage = (totalSpent / budgetConfig.monthlyLimit) * 100;

      // Check thresholds
      if (spendingPercentage >= budgetConfig.alertThresholds.critical) {
        await this.sendBudgetAlert(deploymentId, 'critical', spendingPercentage, totalSpent, budgetConfig.monthlyLimit);
      } else if (spendingPercentage >= budgetConfig.alertThresholds.warning) {
        await this.sendBudgetAlert(deploymentId, 'warning', spendingPercentage, totalSpent, budgetConfig.monthlyLimit);
      }
    } catch (error) {
      logger.error('Failed to check budget alerts:', error);
    }
  }

  /**
   * Send budget alert
   */
  private async sendBudgetAlert(
    deploymentId: string,
    level: 'warning' | 'critical',
    percentage: number,
    spent: number,
    limit: number
  ): Promise<void> {
    const message = `Budget alert: Deployment ${deploymentId} has spent $${spent.toFixed(2)} (${percentage.toFixed(1)}%) of monthly limit $${limit}`;
    
    logger.warn(`🚨 ${message}`);
    
    // Send WebSocket notification (placeholder - method doesn't exist yet)
    // this.websocket.broadcastToDeploymentChannel(deploymentId, 'budget:alert', {
    //   level,
    //   percentage,
    //   spent,
    //   limit,
    //   message
    // });
    console.log(`💰 Budget alert sent for deployment ${deploymentId}: ${message}`);
  }

  /**
   * Get resource usage for deployment
   */
  public getResourceUsage(deploymentId: string): ResourceUsage[] {
    return this.resourceUsageHistory.get(deploymentId) || [];
  }

  /**
   * Get cost analytics for deployment
   */
  public getCostAnalytics(deploymentId: string): CostAnalytics | null {
    return this.costAnalytics.get(deploymentId) || null;
  }

  /**
   * Collect scaling metrics (helper method)
   */
  private async collectScalingMetrics(deploymentId: string): Promise<ScalingMetrics | null> {
    // In a real implementation, this would get deployment-specific metrics
    const systemMetrics = this.metrics.getCurrentMetrics();
    
    return {
      cpuUsage: systemMetrics.system.cpu.usage || Math.random() * 100,
      memoryUsage: systemMetrics.system.memory.usagePercent || Math.random() * 100,
      requestRate: Math.random() * 100,
      responseTime: 200 + Math.random() * 800,
      errorRate: Math.random() * 5,
      timestamp: new Date()
    };
  }

  /**
   * Perform optimization analysis for all deployments
   */
  private async performOptimizationAnalysis(): Promise<void> {
    // Get all active deployments
    try {
      const result = await this.db.query(`
        SELECT DISTINCT deployment_id 
        FROM resource_usage 
        WHERE timestamp >= NOW() - INTERVAL '1 hour'
      `);

      for (const row of result.rows) {
        await this.trackResourceUsage(row.deployment_id);
      }
    } catch (error) {
      logger.error('Failed to perform optimization analysis:', error);
    }
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    this.stopOptimization();
    this.resourceUsageHistory.clear();
    this.costAnalytics.clear();
    this.budgetConfigs.clear();
    
    logger.info('🧹 ResourceOptimizerService cleanup completed');
  }
}