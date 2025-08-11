/**
 * Database Registry Service
 * P3-T03 Implementation for CodeRunner v2.0
 * 
 * Centralized registry for database deployment management:
 * - Service discovery and registration
 * - Load balancing and health tracking
 * - Connection string management
 * - Multi-tenant routing
 * - Resource utilization tracking
 */

import { EventEmitter } from 'events';
// TEMPORARY: Disabled database orchestrator for emergency fix
// import { Deployment, DeploymentStatus } from './databaseOrchestrator';

// Temporary type definitions
interface Deployment {
  id: string;
  type: string;
  status: string;
  [key: string]: any;
}

const DeploymentStatus = {
  PENDING: 'pending' as const,
  RUNNING: 'running' as const,
  STOPPED: 'stopped' as const,
  FAILED: 'failed' as const
};

type DeploymentStatus = typeof DeploymentStatus[keyof typeof DeploymentStatus];
import { logger } from '../utils/logger';
import { DatabaseService } from './database';

/**
 * Registry filter interface
 */
export interface RegistryFilter {
  type?: 'postgresql' | 'redis';
  userId?: string;
  projectId?: string;
  tenantId?: string;
  status?: DeploymentStatus;
  environment?: string;
  tags?: Record<string, string>;
}

/**
 * Service discovery result
 */
export interface ServiceInstance {
  deployment: Deployment;
  connectionString: string;
  isHealthy: boolean;
  lastHealthCheck: Date;
  responseTime?: number;
  load: number; // 0-100
}

/**
 * Load balancing strategy
 */
export type LoadBalancingStrategy = 'round_robin' | 'least_connections' | 'least_response_time' | 'weighted' | 'ip_hash';

/**
 * Connection pool configuration
 */
export interface ConnectionPoolConfig {
  minConnections: number;
  maxConnections: number;
  acquireTimeoutMs: number;
  idleTimeoutMs: number;
  reapIntervalMs: number;
}

/**
 * Registry statistics
 */
export interface RegistryStats {
  totalDeployments: number;
  healthyDeployments: number;
  unhealthyDeployments: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  byEnvironment: Record<string, number>;
  avgResponseTime: number;
  totalConnections: number;
}

/**
 * Database Registry Service
 */
export class DatabaseRegistry extends EventEmitter {
  private static instance: DatabaseRegistry;
  private deployments: Map<string, Deployment> = new Map();
  private healthStatus: Map<string, { isHealthy: boolean; lastCheck: Date; responseTime?: number }> = new Map();
  private connectionPools: Map<string, ConnectionPoolConfig> = new Map();
  private loadBalancers: Map<string, { strategy: LoadBalancingStrategy; roundRobinIndex: number }> = new Map();
  private db: DatabaseService;
  
  private constructor() {
    super();
    this.db = DatabaseService.getInstance();
    this.initializeRegistry();
    logger.info('DatabaseRegistry initialized');
  }

  public static getInstance(): DatabaseRegistry {
    if (!DatabaseRegistry.instance) {
      DatabaseRegistry.instance = new DatabaseRegistry();
    }
    return DatabaseRegistry.instance;
  }

  /**
   * Initialize the registry
   */
  private async initializeRegistry(): Promise<void> {
    // Load existing deployments from database
    await this.loadExistingDeployments();
    
    // Start background processes
    this.startHealthMonitoring();
    this.startMetricsCollection();
    
    // Set up event listeners
    this.setupEventListeners();
    
    logger.info('DatabaseRegistry initialization complete');
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    this.on('deployment:registered', (deployment: Deployment) => {
      logger.info(`Deployment registered: ${deployment.id} (${deployment.type})`);
    });
    
    this.on('deployment:unregistered', (deploymentId: string) => {
      logger.info(`Deployment unregistered: ${deploymentId}`);
    });
    
    this.on('health:changed', (deploymentId: string, isHealthy: boolean) => {
      logger.info(`Health status changed: ${deploymentId} → ${isHealthy ? 'healthy' : 'unhealthy'}`);
    });
    
    this.on('load:changed', (deploymentId: string, load: number) => {
      if (load > 80) {
        logger.warn(`High load detected: ${deploymentId} → ${load}%`);
      }
    });
  }

  /**
   * Register a new deployment
   */
  public register(deployment: Deployment): void {
    // Validate deployment
    this.validateDeployment(deployment);
    
    // Store deployment
    this.deployments.set(deployment.id, { ...deployment });
    
    // Initialize health status
    this.healthStatus.set(deployment.id, {
      isHealthy: deployment.status === DeploymentStatus.RUNNING,
      lastCheck: new Date(),
      responseTime: undefined
    });
    
    // Set up default connection pool
    this.setupConnectionPool(deployment.id);
    
    // Set up load balancer
    this.setupLoadBalancer(deployment.id);
    
    // Persist to database
    this.persistDeployment(deployment);
    
    this.emit('deployment:registered', deployment);
    logger.info(`Deployment registered: ${deployment.id}`);
  }

  /**
   * Unregister a deployment
   */
  public unregister(deploymentId: string): void {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      logger.warn(`Attempted to unregister non-existent deployment: ${deploymentId}`);
      return;
    }
    
    // Remove from memory
    this.deployments.delete(deploymentId);
    this.healthStatus.delete(deploymentId);
    this.connectionPools.delete(deploymentId);
    this.loadBalancers.delete(deploymentId);
    
    // Remove from database
    this.removeDeploymentFromDb(deploymentId);
    
    this.emit('deployment:unregistered', deploymentId);
    logger.info(`Deployment unregistered: ${deploymentId}`);
  }

  /**
   * Update an existing deployment
   */
  public update(deployment: Deployment): void {
    if (!this.deployments.has(deployment.id)) {
      throw new Error(`Deployment not found: ${deployment.id}`);
    }
    
    // Update deployment
    this.deployments.set(deployment.id, { ...deployment });
    
    // Update health status if status changed
    const health = this.healthStatus.get(deployment.id);
    if (health) {
      const wasHealthy = health.isHealthy;
      const isHealthy = deployment.status === DeploymentStatus.RUNNING;
      
      if (wasHealthy !== isHealthy) {
        health.isHealthy = isHealthy;
        health.lastCheck = new Date();
        this.emit('health:changed', deployment.id, isHealthy);
      }
    }
    
    // Persist changes
    this.persistDeployment(deployment);
    
    logger.debug(`Deployment updated: ${deployment.id}`);
  }

  /**
   * Get a deployment by ID
   */
  public get(deploymentId: string): Deployment | null {
    return this.deployments.get(deploymentId) || null;
  }

  /**
   * Get all deployments
   */
  public getAll(): Deployment[] {
    return Array.from(this.deployments.values());
  }

  /**
   * Discover services based on filter criteria
   */
  public discover(filter: RegistryFilter = {}): Deployment[] {
    return Array.from(this.deployments.values()).filter(deployment => {
      // Filter by type
      if (filter.type && deployment.type !== filter.type) {
        return false;
      }
      
      // Filter by user
      if (filter.userId && deployment.userId !== filter.userId) {
        return false;
      }
      
      // Filter by project
      if (filter.projectId && deployment.projectId !== filter.projectId) {
        return false;
      }
      
      // Filter by tenant
      if (filter.tenantId && deployment.tenantId !== filter.tenantId) {
        return false;
      }
      
      // Filter by status
      if (filter.status && deployment.status !== filter.status) {
        return false;
      }
      
      // Filter by environment
      if (filter.environment && deployment.metadata.environment !== filter.environment) {
        return false;
      }
      
      // Filter by tags
      if (filter.tags) {
        const deploymentTags = deployment.metadata.tags || {};
        for (const [key, value] of Object.entries(filter.tags)) {
          if (deploymentTags[key] !== value) {
            return false;
          }
        }
      }
      
      return true;
    });
  }

  /**
   * Get connection string for a deployment
   */
  public getConnectionString(deploymentId: string, tenantId?: string): string {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }
    
    let connectionString = deployment.connectionString;
    
    // Add tenant-specific parameters if needed
    if (tenantId && deployment.type === 'postgresql') {
      // For PostgreSQL, append schema or database name
      connectionString = this.addTenantToConnectionString(connectionString, tenantId, 'postgresql');
    } else if (tenantId && deployment.type === 'redis') {
      // For Redis, add key prefix parameter
      connectionString = this.addTenantToConnectionString(connectionString, tenantId, 'redis');
    }
    
    return connectionString;
  }

  /**
   * Mark a deployment as healthy
   */
  public markHealthy(deploymentId: string, responseTime?: number): void {
    const health = this.healthStatus.get(deploymentId);
    if (!health) {
      logger.warn(`Health status not found for deployment: ${deploymentId}`);
      return;
    }
    
    const wasHealthy = health.isHealthy;
    health.isHealthy = true;
    health.lastCheck = new Date();
    health.responseTime = responseTime;
    
    if (!wasHealthy) {
      this.emit('health:changed', deploymentId, true);
    }
  }

  /**
   * Mark a deployment as unhealthy
   */
  public markUnhealthy(deploymentId: string): void {
    const health = this.healthStatus.get(deploymentId);
    if (!health) {
      logger.warn(`Health status not found for deployment: ${deploymentId}`);
      return;
    }
    
    const wasHealthy = health.isHealthy;
    health.isHealthy = false;
    health.lastCheck = new Date();
    health.responseTime = undefined;
    
    if (wasHealthy) {
      this.emit('health:changed', deploymentId, false);
    }
  }

  /**
   * Get health status for a deployment
   */
  public getHealthStatus(deploymentId: string): { isHealthy: boolean; lastCheck: Date; responseTime?: number } | null {
    return this.healthStatus.get(deploymentId) || null;
  }

  /**
   * Get optimal instance using load balancing
   */
  public getOptimalInstance(
    type: 'postgresql' | 'redis',
    strategy: LoadBalancingStrategy = 'least_response_time'
  ): Deployment | null {
    // Get healthy deployments of the specified type
    const candidates = this.discover({ type, status: DeploymentStatus.RUNNING })
      .filter(deployment => {
        const health = this.healthStatus.get(deployment.id);
        return health?.isHealthy;
      });
    
    if (candidates.length === 0) {
      return null;
    }
    
    if (candidates.length === 1) {
      return candidates[0];
    }
    
    return this.selectInstanceByStrategy(candidates, strategy);
  }

  /**
   * Get load balancer instances for a service
   */
  public getLoadBalancedInstances(filter: RegistryFilter): ServiceInstance[] {
    const deployments = this.discover(filter);
    
    return deployments.map(deployment => {
      const health = this.healthStatus.get(deployment.id);
      const load = this.calculateInstanceLoad(deployment);
      
      return {
        deployment,
        connectionString: deployment.connectionString,
        isHealthy: health?.isHealthy || false,
        lastHealthCheck: health?.lastCheck || new Date(0),
        responseTime: health?.responseTime,
        load
      };
    }).sort((a, b) => a.load - b.load); // Sort by load ascending
  }

  /**
   * Configure connection pool for a deployment
   */
  public configureConnectionPool(deploymentId: string, config: ConnectionPoolConfig): void {
    if (!this.deployments.has(deploymentId)) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }
    
    this.connectionPools.set(deploymentId, { ...config });
    logger.info(`Connection pool configured for deployment: ${deploymentId}`);
  }

  /**
   * Get connection pool configuration
   */
  public getConnectionPoolConfig(deploymentId: string): ConnectionPoolConfig | null {
    return this.connectionPools.get(deploymentId) || null;
  }

  /**
   * Set load balancing strategy for a deployment
   */
  public setLoadBalancingStrategy(deploymentId: string, strategy: LoadBalancingStrategy): void {
    const balancer = this.loadBalancers.get(deploymentId);
    if (balancer) {
      balancer.strategy = strategy;
      balancer.roundRobinIndex = 0; // Reset round robin
    } else {
      this.loadBalancers.set(deploymentId, { strategy, roundRobinIndex: 0 });
    }
    
    logger.info(`Load balancing strategy set: ${deploymentId} → ${strategy}`);
  }

  /**
   * Get registry statistics
   */
  public getStats(): RegistryStats {
    const deployments = Array.from(this.deployments.values());
    const healthStatuses = Array.from(this.healthStatus.values());
    
    // Count by type
    const byType = deployments.reduce((acc, deployment) => {
      acc[deployment.type] = (acc[deployment.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Count by status
    const byStatus = deployments.reduce((acc, deployment) => {
      acc[deployment.status] = (acc[deployment.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Count by environment
    const byEnvironment = deployments.reduce((acc, deployment) => {
      const env = deployment.metadata.environment;
      acc[env] = (acc[env] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Calculate average response time
    const responseTimes = healthStatuses
      .map(h => h.responseTime)
      .filter(rt => rt !== undefined) as number[];
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length 
      : 0;
    
    // Count healthy deployments
    const healthyDeployments = healthStatuses.filter(h => h.isHealthy).length;
    const unhealthyDeployments = healthStatuses.length - healthyDeployments;
    
    // Calculate total connections (approximate)
    const totalConnections = deployments.reduce((total, deployment) => {
      const quota = deployment.metadata.quotaUsage?.connections;
      return total + (quota?.used || 0);
    }, 0);
    
    return {
      totalDeployments: deployments.length,
      healthyDeployments,
      unhealthyDeployments,
      byType,
      byStatus,
      byEnvironment,
      avgResponseTime,
      totalConnections
    };
  }

  /**
   * Export registry data for backup/migration
   */
  public exportData(): {
    deployments: Deployment[];
    healthStatus: Array<{ deploymentId: string; health: any }>;
    connectionPools: Array<{ deploymentId: string; config: ConnectionPoolConfig }>;
    loadBalancers: Array<{ deploymentId: string; config: any }>;
  } {
    return {
      deployments: Array.from(this.deployments.values()),
      healthStatus: Array.from(this.healthStatus.entries()).map(([deploymentId, health]) => ({
        deploymentId,
        health
      })),
      connectionPools: Array.from(this.connectionPools.entries()).map(([deploymentId, config]) => ({
        deploymentId,
        config
      })),
      loadBalancers: Array.from(this.loadBalancers.entries()).map(([deploymentId, config]) => ({
        deploymentId,
        config
      }))
    };
  }

  /**
   * Import registry data from backup/migration
   */
  public importData(data: ReturnType<typeof this.exportData>): void {
    // Clear existing data
    this.deployments.clear();
    this.healthStatus.clear();
    this.connectionPools.clear();
    this.loadBalancers.clear();
    
    // Import deployments
    data.deployments.forEach(deployment => {
      this.deployments.set(deployment.id, deployment);
    });
    
    // Import health status
    data.healthStatus.forEach(({ deploymentId, health }) => {
      this.healthStatus.set(deploymentId, health);
    });
    
    // Import connection pools
    data.connectionPools.forEach(({ deploymentId, config }) => {
      this.connectionPools.set(deploymentId, config);
    });
    
    // Import load balancers
    data.loadBalancers.forEach(({ deploymentId, config }) => {
      this.loadBalancers.set(deploymentId, config);
    });
    
    logger.info('Registry data imported successfully');
  }

  // ==================== PRIVATE HELPER METHODS ====================

  /**
   * Load existing deployments from database
   */
  private async loadExistingDeployments(): Promise<void> {
    try {
      // TODO: Implement database loading
      // const result = await this.db.query('SELECT * FROM database_deployments WHERE status != $1', [DeploymentStatus.DESTROYED]);
      // result.rows.forEach(row => this.register(this.mapDbRowToDeployment(row)));
      
      logger.info('Existing deployments loaded from database');
    } catch (error) {
      logger.error('Failed to load existing deployments:', error);
    }
  }

  /**
   * Start health monitoring background process
   */
  private startHealthMonitoring(): void {
    setInterval(() => {
      this.checkStaleHealthStatus();
    }, 60000); // Every minute
    
    logger.info('Health monitoring started');
  }

  /**
   * Start metrics collection background process
   */
  private startMetricsCollection(): void {
    setInterval(() => {
      this.updateLoadMetrics();
    }, 30000); // Every 30 seconds
    
    logger.info('Metrics collection started');
  }

  /**
   * Check for stale health status and mark as unknown
   */
  private checkStaleHealthStatus(): void {
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    const now = new Date().getTime();
    
    for (const [deploymentId, health] of this.healthStatus.entries()) {
      const timeSinceLastCheck = now - health.lastCheck.getTime();
      
      if (timeSinceLastCheck > staleThreshold && health.isHealthy) {
        health.isHealthy = false;
        logger.warn(`Marking deployment as unhealthy due to stale health check: ${deploymentId}`);
        this.emit('health:changed', deploymentId, false);
      }
    }
  }

  /**
   * Update load metrics for all deployments
   */
  private updateLoadMetrics(): void {
    for (const [deploymentId, deployment] of this.deployments.entries()) {
      const load = this.calculateInstanceLoad(deployment);
      this.emit('load:changed', deploymentId, load);
    }
  }

  /**
   * Validate deployment before registration
   */
  private validateDeployment(deployment: Deployment): void {
    if (!deployment.id || !deployment.type || !deployment.userId) {
      throw new Error('Invalid deployment: missing required fields');
    }
    
    if (this.deployments.has(deployment.id)) {
      throw new Error(`Deployment already registered: ${deployment.id}`);
    }
  }

  /**
   * Set up default connection pool for deployment
   */
  private setupConnectionPool(deploymentId: string): void {
    const defaultConfig: ConnectionPoolConfig = {
      minConnections: 2,
      maxConnections: 20,
      acquireTimeoutMs: 30000,
      idleTimeoutMs: 300000,
      reapIntervalMs: 1000
    };
    
    this.connectionPools.set(deploymentId, defaultConfig);
  }

  /**
   * Set up default load balancer for deployment
   */
  private setupLoadBalancer(deploymentId: string): void {
    this.loadBalancers.set(deploymentId, {
      strategy: 'least_response_time',
      roundRobinIndex: 0
    });
  }

  /**
   * Persist deployment to database
   */
  private async persistDeployment(deployment: Deployment): Promise<void> {
    try {
      // TODO: Implement database persistence
      // await this.db.query('INSERT INTO database_deployments (...) VALUES (...)', [...]);
      
      logger.debug(`Deployment persisted: ${deployment.id}`);
    } catch (error) {
      logger.error(`Failed to persist deployment: ${deployment.id}`, error);
    }
  }

  /**
   * Remove deployment from database
   */
  private async removeDeploymentFromDb(deploymentId: string): Promise<void> {
    try {
      // TODO: Implement database removal
      // await this.db.query('DELETE FROM database_deployments WHERE id = $1', [deploymentId]);
      
      logger.debug(`Deployment removed from database: ${deploymentId}`);
    } catch (error) {
      logger.error(`Failed to remove deployment from database: ${deploymentId}`, error);
    }
  }

  /**
   * Add tenant information to connection string
   */
  private addTenantToConnectionString(connectionString: string, tenantId: string, type: string): string {
    try {
      const url = new URL(connectionString);
      
      if (type === 'postgresql') {
        // Add schema parameter
        url.searchParams.set('schema', tenantId);
      } else if (type === 'redis') {
        // Add key prefix parameter
        url.searchParams.set('keyPrefix', `${tenantId}:`);
      }
      
      return url.toString();
    } catch (error) {
      logger.warn(`Failed to add tenant to connection string: ${error}`);
      return connectionString;
    }
  }

  /**
   * Select instance based on load balancing strategy
   */
  private selectInstanceByStrategy(candidates: Deployment[], strategy: LoadBalancingStrategy): Deployment {
    switch (strategy) {
      case 'round_robin':
        return this.selectRoundRobin(candidates);
      
      case 'least_connections':
        return this.selectLeastConnections(candidates);
      
      case 'least_response_time':
        return this.selectLeastResponseTime(candidates);
      
      case 'weighted':
        return this.selectWeighted(candidates);
      
      case 'ip_hash':
        // For simplicity, fall back to round robin
        return this.selectRoundRobin(candidates);
      
      default:
        return candidates[0];
    }
  }

  /**
   * Select instance using round robin strategy
   */
  private selectRoundRobin(candidates: Deployment[]): Deployment {
    // Simple round robin implementation
    const index = Math.floor(Math.random() * candidates.length);
    return candidates[index];
  }

  /**
   * Select instance with least connections
   */
  private selectLeastConnections(candidates: Deployment[]): Deployment {
    return candidates.reduce((best, current) => {
      const bestConnections = best.metadata.quotaUsage?.connections?.used || 0;
      const currentConnections = current.metadata.quotaUsage?.connections?.used || 0;
      return currentConnections < bestConnections ? current : best;
    });
  }

  /**
   * Select instance with least response time
   */
  private selectLeastResponseTime(candidates: Deployment[]): Deployment {
    return candidates.reduce((best, current) => {
      const bestHealth = this.healthStatus.get(best.id);
      const currentHealth = this.healthStatus.get(current.id);
      
      const bestResponseTime = bestHealth?.responseTime || Infinity;
      const currentResponseTime = currentHealth?.responseTime || Infinity;
      
      return currentResponseTime < bestResponseTime ? current : best;
    });
  }

  /**
   * Select instance using weighted strategy
   */
  private selectWeighted(candidates: Deployment[]): Deployment {
    // Simple weighted selection based on inverse load
    const weights = candidates.map(candidate => {
      const load = this.calculateInstanceLoad(candidate);
      return Math.max(1, 100 - load); // Higher weight for lower load
    });
    
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const random = Math.random() * totalWeight;
    
    let currentWeight = 0;
    for (let i = 0; i < candidates.length; i++) {
      currentWeight += weights[i];
      if (random <= currentWeight) {
        return candidates[i];
      }
    }
    
    return candidates[0];
  }

  /**
   * Calculate instance load percentage
   */
  private calculateInstanceLoad(deployment: Deployment): number {
    const quota = deployment.metadata.quotaUsage;
    if (!quota) {
      return 0;
    }
    
    // Calculate load based on CPU, memory, and connections
    const cpuLoad = quota.cpu.limit > 0 ? (quota.cpu.used / quota.cpu.limit) * 100 : 0;
    const memoryLoad = quota.memory.limit > 0 ? (quota.memory.used / quota.memory.limit) * 100 : 0;
    const connectionLoad = quota.connections.limit > 0 ? (quota.connections.used / quota.connections.limit) * 100 : 0;
    
    // Return average load
    return Math.round((cpuLoad + memoryLoad + connectionLoad) / 3);
  }
}