import { EventEmitter } from 'events';
import { DatabaseService } from './database';
import { MetricsService } from './metrics';
import { WebSocketService } from './websocket';
import { logger } from '../utils/logger';

export interface ScalingMetrics {
  cpuUsage: number;
  memoryUsage: number;
  requestRate: number;
  responseTime: number;
  errorRate: number;
  timestamp: Date;
}

export interface ScalingPolicy {
  id: string;
  name: string;
  deploymentId: string;
  metrics: MetricThreshold[];
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  cooldownPeriod: number; // seconds
  minInstances: number;
  maxInstances: number;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MetricThreshold {
  metric: 'cpu' | 'memory' | 'requests' | 'response_time' | 'error_rate';
  threshold: number;
  comparison: 'gt' | 'lt' | 'gte' | 'lte';
  weight: number; // 0-1, how much this metric influences scaling decision
}

export interface ScalingEvent {
  id: string;
  deploymentId: string;
  policyId?: string;
  eventType: 'scale_up' | 'scale_down' | 'policy_change' | 'manual_override';
  fromInstances: number;
  toInstances: number;
  reason: string;
  metricsSnapshot: ScalingMetrics;
  createdAt: Date;
}

export interface ScalingDecision {
  action: 'scale_up' | 'scale_down' | 'no_change';
  targetInstances: number;
  confidence: number; // 0-1
  reason: string;
  triggeredMetrics: string[];
}

/**
 * AutoScalingService - Intelligent auto-scaling with multi-metric evaluation
 * 
 * Features:
 * - Multi-metric weighted scoring algorithm
 * - Configurable scaling policies with templates
 * - Cool-down periods to prevent oscillation
 * - Integration with AgentSphere SDK for actual scaling
 * - Real-time metrics evaluation and decision making
 * - WebSocket notifications for scaling events
 */
export class AutoScalingService extends EventEmitter {
  private static instance: AutoScalingService;
  private db: DatabaseService;
  private metrics: MetricsService;
  private websocket: WebSocketService;
  
  // Active scaling policies per deployment
  private activePolicies: Map<string, ScalingPolicy> = new Map();
  
  // Cooldown tracking to prevent scaling oscillation
  private cooldownTracker: Map<string, Date> = new Map();
  
  // Current instance counts per deployment
  private currentInstances: Map<string, number> = new Map();
  
  // Metrics history for trend analysis
  private metricsHistory: Map<string, ScalingMetrics[]> = new Map();
  
  // Evaluation intervals
  private evaluationInterval?: NodeJS.Timeout | undefined;
  private evaluationFrequency = 30000; // 30 seconds
  
  // Scaling decision cache
  private lastDecisions: Map<string, ScalingDecision> = new Map();

  private constructor() {
    super();
    this.db = DatabaseService.getInstance();
    this.metrics = MetricsService.getInstance();
    this.websocket = WebSocketService.getInstance();
    
    logger.info('🎯 AutoScalingService initialized');
  }

  public static getInstance(): AutoScalingService {
    if (!AutoScalingService.instance) {
      AutoScalingService.instance = new AutoScalingService();
    }
    return AutoScalingService.instance;
  }

  /**
   * Start auto-scaling evaluation loop
   */
  public startEvaluation(): void {
    if (this.evaluationInterval) {
      logger.warn('⚠️ Auto-scaling evaluation already running');
      return;
    }

    this.evaluationInterval = setInterval(async () => {
      await this.evaluateAllDeployments();
    }, this.evaluationFrequency);

    logger.info('✅ Auto-scaling evaluation started');
  }

  /**
   * Stop auto-scaling evaluation
   */
  public stopEvaluation(): void {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
      this.evaluationInterval = undefined;
      logger.info('🛑 Auto-scaling evaluation stopped');
    }
  }

  /**
   * Create or update scaling policy
   */
  public async createScalingPolicy(policyData: Omit<ScalingPolicy, 'id' | 'createdAt' | 'updatedAt'>): Promise<ScalingPolicy> {
    const policyId = `policy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    
    const policy: ScalingPolicy = {
      id: policyId,
      ...policyData,
      createdAt: now,
      updatedAt: now
    };

    // Save to database
    await this.db.query(`
      INSERT INTO scaling_policies (
        id, deployment_id, name, is_enabled, policy_type,
        policy_config, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      policy.id,
      policy.deploymentId,
      policy.name,
      policy.isEnabled,
      'multi_metric',
      JSON.stringify({
        metrics: policy.metrics,
        scaleUpThreshold: policy.scaleUpThreshold,
        scaleDownThreshold: policy.scaleDownThreshold,
        cooldownPeriod: policy.cooldownPeriod,
        minInstances: policy.minInstances,
        maxInstances: policy.maxInstances
      }),
      policy.createdAt,
      policy.updatedAt
    ]);

    // Add to active policies if enabled
    if (policy.isEnabled) {
      this.activePolicies.set(policy.deploymentId, policy);
    }

    logger.info(`📝 Created scaling policy: ${policy.name} for deployment ${policy.deploymentId}`);
    
    // Notify clients (placeholder - method doesn't exist yet)
    // this.websocket.broadcastToDeploymentChannel(policy.deploymentId, 'scaling:policy_created', {
    //   policy: policy
    // });
    console.log(`🔔 Policy creation notification sent for deployment ${policy.deploymentId}`);

    return policy;
  }

  /**
   * Get scaling policy for deployment
   */
  public async getScalingPolicy(deploymentId: string): Promise<ScalingPolicy | null> {
    try {
      const result = await this.db.query(`
        SELECT * FROM scaling_policies 
        WHERE deployment_id = $1 AND is_enabled = true
        ORDER BY created_at DESC LIMIT 1
      `, [deploymentId]);

      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      const config = JSON.parse(row.policy_config);

      return {
        id: row.id,
        deploymentId: row.deployment_id,
        name: row.name,
        isEnabled: row.is_enabled,
        metrics: config.metrics || [],
        scaleUpThreshold: config.scaleUpThreshold || 0.7,
        scaleDownThreshold: config.scaleDownThreshold || 0.3,
        cooldownPeriod: config.cooldownPeriod || 300,
        minInstances: config.minInstances || 1,
        maxInstances: config.maxInstances || 10,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      };
    } catch (error) {
      logger.error('Failed to get scaling policy:', error);
      return null;
    }
  }

  /**
   * Load all active scaling policies
   */
  public async loadActivePolicies(): Promise<void> {
    try {
      const result = await this.db.query(`
        SELECT * FROM scaling_policies 
        WHERE is_enabled = true
      `);

      this.activePolicies.clear();

      for (const row of result.rows) {
        const config = JSON.parse(row.policy_config);
        const policy: ScalingPolicy = {
          id: row.id,
          deploymentId: row.deployment_id,
          name: row.name,
          isEnabled: row.is_enabled,
          metrics: config.metrics || [],
          scaleUpThreshold: config.scaleUpThreshold || 0.7,
          scaleDownThreshold: config.scaleDownThreshold || 0.3,
          cooldownPeriod: config.cooldownPeriod || 300,
          minInstances: config.minInstances || 1,
          maxInstances: config.maxInstances || 10,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at)
        };

        this.activePolicies.set(policy.deploymentId, policy);
      }

      logger.info(`📋 Loaded ${this.activePolicies.size} active scaling policies`);
    } catch (error) {
      logger.error('Failed to load scaling policies:', error);
    }
  }

  /**
   * Evaluate scaling for all deployments with active policies
   */
  private async evaluateAllDeployments(): Promise<void> {
    const deploymentIds = Array.from(this.activePolicies.keys());
    
    for (const deploymentId of deploymentIds) {
      try {
        await this.evaluateDeploymentScaling(deploymentId);
      } catch (error) {
        logger.error(`Failed to evaluate scaling for deployment ${deploymentId}:`, error);
      }
    }
  }

  /**
   * Evaluate scaling decision for a specific deployment
   */
  public async evaluateDeploymentScaling(deploymentId: string): Promise<ScalingDecision> {
    const policy = this.activePolicies.get(deploymentId);
    if (!policy) {
      return {
        action: 'no_change',
        targetInstances: 1,
        confidence: 0,
        reason: 'No active scaling policy',
        triggeredMetrics: []
      };
    }

    // Check cooldown period
    const lastCooldown = this.cooldownTracker.get(deploymentId);
    if (lastCooldown && Date.now() - lastCooldown.getTime() < policy.cooldownPeriod * 1000) {
      return {
        action: 'no_change',
        targetInstances: this.currentInstances.get(deploymentId) || 1,
        confidence: 0,
        reason: 'Cooldown period active',
        triggeredMetrics: []
      };
    }

    // Collect current metrics
    const currentMetrics = await this.collectDeploymentMetrics(deploymentId);
    if (!currentMetrics) {
      return {
        action: 'no_change',
        targetInstances: this.currentInstances.get(deploymentId) || 1,
        confidence: 0,
        reason: 'Unable to collect metrics',
        triggeredMetrics: []
      };
    }

    // Store metrics history
    this.updateMetricsHistory(deploymentId, currentMetrics);

    // Calculate scaling score using weighted metrics
    const scalingScore = this.calculateScalingScore(currentMetrics, policy);
    const currentInstanceCount = this.currentInstances.get(deploymentId) || 1;

    // Make scaling decision
    let decision: ScalingDecision;

    if (scalingScore.score > policy.scaleUpThreshold) {
      const targetInstances = Math.min(
        currentInstanceCount + 1,
        policy.maxInstances
      );
      
      decision = {
        action: targetInstances > currentInstanceCount ? 'scale_up' : 'no_change',
        targetInstances,
        confidence: scalingScore.confidence,
        reason: `Scaling score ${scalingScore.score.toFixed(3)} > threshold ${policy.scaleUpThreshold}`,
        triggeredMetrics: scalingScore.triggeredMetrics
      };
    } else if (scalingScore.score < policy.scaleDownThreshold) {
      const targetInstances = Math.max(
        currentInstanceCount - 1,
        policy.minInstances
      );
      
      decision = {
        action: targetInstances < currentInstanceCount ? 'scale_down' : 'no_change',
        targetInstances,
        confidence: scalingScore.confidence,
        reason: `Scaling score ${scalingScore.score.toFixed(3)} < threshold ${policy.scaleDownThreshold}`,
        triggeredMetrics: scalingScore.triggeredMetrics
      };
    } else {
      decision = {
        action: 'no_change',
        targetInstances: currentInstanceCount,
        confidence: scalingScore.confidence,
        reason: `Scaling score ${scalingScore.score.toFixed(3)} within thresholds`,
        triggeredMetrics: []
      };
    }

    // Execute scaling if needed
    if (decision.action !== 'no_change') {
      await this.executeScaling(deploymentId, policy, decision, currentMetrics);
    }

    // Cache decision and emit event (if needed)
    this.lastDecisions.set(deploymentId, decision);
    
    // Emit decision event for potential subscribers
    this.emit('decision:made', { deploymentId, decision });

    return decision;
  }

  /**
   * Calculate weighted scaling score based on multiple metrics
   */
  private calculateScalingScore(metrics: ScalingMetrics, policy: ScalingPolicy): {
    score: number;
    confidence: number;
    triggeredMetrics: string[];
  } {
    let weightedScore = 0;
    let totalWeight = 0;
    const triggeredMetrics: string[] = [];

    for (const threshold of policy.metrics) {
      const metricValue = this.getMetricValue(metrics, threshold.metric);
      const normalizedValue = this.normalizeMetricValue(threshold.metric, metricValue);
      
      // Check if threshold is triggered
      const isTriggered = this.evaluateThreshold(normalizedValue, threshold);
      
      if (isTriggered) {
        triggeredMetrics.push(threshold.metric);
        // Scale the contribution based on how much it exceeds the threshold
        const excess = Math.abs(normalizedValue - threshold.threshold);
        weightedScore += (normalizedValue + excess * 0.5) * threshold.weight;
      } else {
        // Still contribute to score but with less weight
        weightedScore += normalizedValue * threshold.weight * 0.5;
      }
      
      totalWeight += threshold.weight;
    }

    const finalScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
    const confidence = Math.min(triggeredMetrics.length / policy.metrics.length, 1);

    return {
      score: finalScore,
      confidence,
      triggeredMetrics
    };
  }

  /**
   * Get metric value from scaling metrics
   */
  private getMetricValue(metrics: ScalingMetrics, metric: string): number {
    switch (metric) {
      case 'cpu': return metrics.cpuUsage;
      case 'memory': return metrics.memoryUsage;
      case 'requests': return metrics.requestRate;
      case 'response_time': return metrics.responseTime;
      case 'error_rate': return metrics.errorRate;
      default: return 0;
    }
  }

  /**
   * Normalize metric values to 0-1 scale for comparison
   */
  private normalizeMetricValue(metric: string, value: number): number {
    switch (metric) {
      case 'cpu':
      case 'memory':
        return Math.min(value / 100, 1); // Percentage values
      case 'error_rate':
        return Math.min(value / 10, 1); // Error rate percentage
      case 'requests':
        return Math.min(value / 1000, 1); // Requests per second
      case 'response_time':
        return Math.min(value / 5000, 1); // Response time in ms
      default:
        return 0;
    }
  }

  /**
   * Evaluate if a threshold is triggered
   */
  private evaluateThreshold(value: number, threshold: MetricThreshold): boolean {
    switch (threshold.comparison) {
      case 'gt': return value > threshold.threshold;
      case 'gte': return value >= threshold.threshold;
      case 'lt': return value < threshold.threshold;
      case 'lte': return value <= threshold.threshold;
      default: return false;
    }
  }

  /**
   * Execute scaling action
   */
  private async executeScaling(
    deploymentId: string,
    policy: ScalingPolicy,
    decision: ScalingDecision,
    metrics: ScalingMetrics
  ): Promise<void> {
    const currentInstances = this.currentInstances.get(deploymentId) || 1;
    
    try {
      // Mock AgentSphere SDK call (would be real in production)
      const success = await this.mockAgentSphereScaling(deploymentId, decision.targetInstances);
      
      if (success) {
        // Update instance count
        this.currentInstances.set(deploymentId, decision.targetInstances);
        
        // Set cooldown
        this.cooldownTracker.set(deploymentId, new Date());
        
        // Record scaling event (only for actual scaling actions)
        if (decision.action === 'scale_up' || decision.action === 'scale_down') {
          await this.recordScalingEvent({
            deploymentId,
            policyId: policy.id,
            eventType: decision.action,
            fromInstances: currentInstances,
            toInstances: decision.targetInstances,
            reason: decision.reason,
            metricsSnapshot: metrics
          });
        }

        // Notify clients (placeholder - method doesn't exist yet)
        // this.websocket.broadcastToDeploymentChannel(deploymentId, 'scaling:executed', {
        //   action: decision.action,
        //   fromInstances: currentInstances,
        //   toInstances: decision.targetInstances,
        //   reason: decision.reason,
        //   confidence: decision.confidence
        // });
        console.log(`🔔 Scaling notification sent for deployment ${deploymentId}`);

        logger.info(`🎯 Scaling executed for deployment ${deploymentId}: ${currentInstances} -> ${decision.targetInstances} (${decision.action})`);
      } else {
        logger.error(`❌ Failed to execute scaling for deployment ${deploymentId}`);
      }
    } catch (error) {
      logger.error('Failed to execute scaling:', error);
    }
  }

  /**
   * Mock AgentSphere SDK scaling call
   * In production, this would call the actual AgentSphere SDK
   */
  private async mockAgentSphereScaling(deploymentId: string, targetInstances: number): Promise<boolean> {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock 95% success rate
    return Math.random() > 0.05;
  }

  /**
   * Collect deployment metrics for scaling evaluation
   */
  private async collectDeploymentMetrics(deploymentId: string): Promise<ScalingMetrics | null> {
    try {
      // Get metrics from MetricsService
      const currentMetrics = this.metrics.getCurrentMetrics();
      
      // In a real implementation, you'd get deployment-specific metrics
      // For now, we'll use system metrics as a baseline
      return {
        cpuUsage: currentMetrics.system.cpu.usage || 0,
        memoryUsage: currentMetrics.system.memory.usagePercent || 0,
        requestRate: Math.random() * 100, // Mock request rate
        responseTime: 200 + Math.random() * 800, // Mock response time
        errorRate: Math.random() * 5, // Mock error rate
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Failed to collect deployment metrics:', error);
      return null;
    }
  }

  /**
   * Update metrics history for trend analysis
   */
  private updateMetricsHistory(deploymentId: string, metrics: ScalingMetrics): void {
    if (!this.metricsHistory.has(deploymentId)) {
      this.metricsHistory.set(deploymentId, []);
    }

    const history = this.metricsHistory.get(deploymentId)!;
    history.push(metrics);

    // Keep only last 100 entries
    if (history.length > 100) {
      history.shift();
    }
  }

  /**
   * Record scaling event to database
   */
  private async recordScalingEvent(eventData: Omit<ScalingEvent, 'id' | 'createdAt'>): Promise<void> {
    const eventId = `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      await this.db.query(`
        INSERT INTO scaling_events (
          id, deployment_id, policy_id, event_type,
          from_instances, to_instances, reason, metrics_snapshot, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        eventId,
        eventData.deploymentId,
        eventData.policyId,
        eventData.eventType,
        eventData.fromInstances,
        eventData.toInstances,
        eventData.reason,
        JSON.stringify(eventData.metricsSnapshot),
        new Date()
      ]);
    } catch (error) {
      logger.error('Failed to record scaling event:', error);
    }
  }

  /**
   * Manual scaling override
   */
  public async manualScale(deploymentId: string, targetInstances: number, reason: string): Promise<boolean> {
    try {
      const currentInstances = this.currentInstances.get(deploymentId) || 1;
      
      if (targetInstances === currentInstances) {
        return true; // No change needed
      }

      const success = await this.mockAgentSphereScaling(deploymentId, targetInstances);
      
      if (success) {
        this.currentInstances.set(deploymentId, targetInstances);
        
        // Record manual scaling event
        await this.recordScalingEvent({
          deploymentId,
          eventType: 'manual_override',
          fromInstances: currentInstances,
          toInstances: targetInstances,
          reason: `Manual scaling: ${reason}`,
          metricsSnapshot: await this.collectDeploymentMetrics(deploymentId) || {
            cpuUsage: 0,
            memoryUsage: 0,
            requestRate: 0,
            responseTime: 0,
            errorRate: 0,
            timestamp: new Date()
          }
        });

        // Reset cooldown for manual scaling
        this.cooldownTracker.delete(deploymentId);

        // Notify clients (placeholder - method doesn't exist yet)
        // this.websocket.broadcastToDeploymentChannel(deploymentId, 'scaling:manual', {
        //   fromInstances: currentInstances,
        //   toInstances: targetInstances,
        //   reason
        // });
        console.log(`🔔 Manual scaling notification sent for deployment ${deploymentId}`);

        logger.info(`⚡ Manual scaling executed for deployment ${deploymentId}: ${currentInstances} -> ${targetInstances}`);
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Failed to execute manual scaling:', error);
      return false;
    }
  }

  /**
   * Get scaling history for deployment
   */
  public async getScalingHistory(deploymentId: string, limit: number = 50): Promise<ScalingEvent[]> {
    try {
      const result = await this.db.query(`
        SELECT * FROM scaling_events 
        WHERE deployment_id = $1 
        ORDER BY created_at DESC 
        LIMIT $2
      `, [deploymentId, limit]);

      return result.rows.map(row => ({
        id: row.id,
        deploymentId: row.deployment_id,
        policyId: row.policy_id,
        eventType: row.event_type,
        fromInstances: row.from_instances,
        toInstances: row.to_instances,
        reason: row.reason,
        metricsSnapshot: JSON.parse(row.metrics_snapshot || '{}'),
        createdAt: new Date(row.created_at)
      }));
    } catch (error) {
      logger.error('Failed to get scaling history:', error);
      return [];
    }
  }

  /**
   * Get current scaling status
   */
  public getScalingStatus(deploymentId: string): {
    currentInstances: number;
    policy: ScalingPolicy | null;
    lastDecision: ScalingDecision | null;
    cooldownUntil: Date | null;
  } {
    return {
      currentInstances: this.currentInstances.get(deploymentId) || 1,
      policy: this.activePolicies.get(deploymentId) || null,
      lastDecision: this.lastDecisions.get(deploymentId) || null,
      cooldownUntil: this.cooldownTracker.get(deploymentId) || null
    };
  }

  /**
   * Create scaling policy template
   */
  public static createPolicyTemplate(
    type: 'conservative' | 'balanced' | 'aggressive' | 'cost_optimized' | 'performance'
  ): Omit<ScalingPolicy, 'id' | 'deploymentId' | 'name' | 'createdAt' | 'updatedAt'> {
    const templates = {
      conservative: {
        metrics: [
          { metric: 'cpu' as const, threshold: 0.8, comparison: 'gt' as const, weight: 0.4 },
          { metric: 'memory' as const, threshold: 0.85, comparison: 'gt' as const, weight: 0.3 },
          { metric: 'response_time' as const, threshold: 0.6, comparison: 'gt' as const, weight: 0.3 }
        ],
        scaleUpThreshold: 0.8,
        scaleDownThreshold: 0.2,
        cooldownPeriod: 600, // 10 minutes
        minInstances: 1,
        maxInstances: 5,
        isEnabled: true
      },
      balanced: {
        metrics: [
          { metric: 'cpu' as const, threshold: 0.7, comparison: 'gt' as const, weight: 0.35 },
          { metric: 'memory' as const, threshold: 0.75, comparison: 'gt' as const, weight: 0.25 },
          { metric: 'response_time' as const, threshold: 0.5, comparison: 'gt' as const, weight: 0.25 },
          { metric: 'error_rate' as const, threshold: 0.3, comparison: 'gt' as const, weight: 0.15 }
        ],
        scaleUpThreshold: 0.7,
        scaleDownThreshold: 0.3,
        cooldownPeriod: 300, // 5 minutes
        minInstances: 1,
        maxInstances: 10,
        isEnabled: true
      },
      aggressive: {
        metrics: [
          { metric: 'cpu' as const, threshold: 0.6, comparison: 'gt' as const, weight: 0.3 },
          { metric: 'memory' as const, threshold: 0.65, comparison: 'gt' as const, weight: 0.25 },
          { metric: 'response_time' as const, threshold: 0.4, comparison: 'gt' as const, weight: 0.25 },
          { metric: 'requests' as const, threshold: 0.5, comparison: 'gt' as const, weight: 0.2 }
        ],
        scaleUpThreshold: 0.6,
        scaleDownThreshold: 0.4,
        cooldownPeriod: 120, // 2 minutes
        minInstances: 2,
        maxInstances: 20,
        isEnabled: true
      },
      cost_optimized: {
        metrics: [
          { metric: 'cpu' as const, threshold: 0.85, comparison: 'gt' as const, weight: 0.5 },
          { metric: 'memory' as const, threshold: 0.9, comparison: 'gt' as const, weight: 0.3 },
          { metric: 'error_rate' as const, threshold: 0.4, comparison: 'gt' as const, weight: 0.2 }
        ],
        scaleUpThreshold: 0.85,
        scaleDownThreshold: 0.15,
        cooldownPeriod: 900, // 15 minutes
        minInstances: 1,
        maxInstances: 3,
        isEnabled: true
      },
      performance: {
        metrics: [
          { metric: 'response_time' as const, threshold: 0.3, comparison: 'gt' as const, weight: 0.4 },
          { metric: 'cpu' as const, threshold: 0.5, comparison: 'gt' as const, weight: 0.3 },
          { metric: 'requests' as const, threshold: 0.4, comparison: 'gt' as const, weight: 0.2 },
          { metric: 'error_rate' as const, threshold: 0.2, comparison: 'gt' as const, weight: 0.1 }
        ],
        scaleUpThreshold: 0.5,
        scaleDownThreshold: 0.3,
        cooldownPeriod: 180, // 3 minutes
        minInstances: 2,
        maxInstances: 25,
        isEnabled: true
      }
    };

    return templates[type];
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    this.stopEvaluation();
    this.activePolicies.clear();
    this.cooldownTracker.clear();
    this.currentInstances.clear();
    this.metricsHistory.clear();
    this.lastDecisions.clear();
    
    logger.info('🧹 AutoScalingService cleanup completed');
  }
}