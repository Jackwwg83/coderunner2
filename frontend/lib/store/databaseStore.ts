import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { apiHelpers } from '../api'

export interface DatabaseDeployment {
  id: string
  name: string
  type: 'postgresql' | 'mysql' | 'mongodb' | 'redis' | 'influxdb'
  status: 'creating' | 'running' | 'stopped' | 'maintenance' | 'failed' | 'deleting'
  template_id: string
  instance_id: string
  connection_string: string
  admin_connection_string?: string
  endpoint: string
  port: number
  region: string
  storage: {
    used: number
    total: number
    unit: 'GB' | 'MB'
  }
  connections: {
    active: number
    max: number
  }
  deployment_time: number
  resource_usage: {
    cpu_cores: number
    memory_mb: number
    storage_gb: number
    network_throughput: number
  }
  created_at: Date
  updated_at: Date
}

export interface DatabaseTemplate {
  id: string
  name: string
  type: 'postgresql' | 'mysql' | 'mongodb' | 'redis' | 'influxdb'
  version: string
  description: string
  configuration: any
  environment: 'development' | 'staging' | 'production'
  status: 'pending' | 'deploying' | 'deployed' | 'failed' | 'destroyed'
  created_at: Date
  updated_at: Date
}

export interface DatabaseTenant {
  id: string
  deployment_id: string
  tenant_id: string
  schema_name?: string
  database_name?: string
  isolation_type: 'schema' | 'database' | 'row'
  resource_limits: {
    max_connections: number
    storage_quota_mb: number
    cpu_quota_percent: number
  }
  status: 'active' | 'suspended' | 'migrating' | 'deleting'
  created_at: Date
  updated_at: Date
}

export interface DatabaseBackup {
  id: string
  deployment_id: string
  backup_id: string
  type: 'full' | 'incremental' | 'differential'
  size_bytes: number
  status: 'creating' | 'completed' | 'failed' | 'restoring'
  encryption_enabled: boolean
  compression: 'none' | 'gzip' | 'lz4'
  storage_location: string
  created_at: Date
  expires_at: Date
}

export interface DatabaseMetrics {
  deployment_id: string
  timestamp: Date
  cpu_usage_percent: number
  memory_usage_percent: number
  storage_usage_percent: number
  connections_active: number
  connections_max: number
  queries_per_second: number
  slow_queries_count: number
  replication_lag_ms?: number
}

export interface DeploymentConfig {
  templateId: string
  name: string
  environment: 'development' | 'staging' | 'production'
  region: string
  resources: {
    cpu_cores: number
    memory_mb: number
    storage_gb: number
  }
  configuration: Record<string, any>
}

export interface TenantConfig {
  tenant_id: string
  schema_name?: string
  database_name?: string
  isolation_type: 'schema' | 'database' | 'row'
  resource_limits: {
    max_connections: number
    storage_quota_mb: number
    cpu_quota_percent: number
  }
}

interface DatabaseStore {
  // State
  deployments: DatabaseDeployment[]
  templates: DatabaseTemplate[]
  selectedDeployment: DatabaseDeployment | null
  tenants: Map<string, DatabaseTenant[]>
  backups: Map<string, DatabaseBackup[]>
  metrics: Map<string, DatabaseMetrics>
  loading: boolean
  error: string | null

  // WebSocket connections
  wsConnections: Map<string, WebSocket>

  // Actions
  fetchDeployments: () => Promise<void>
  fetchTemplates: () => Promise<void>
  deployDatabase: (config: DeploymentConfig) => Promise<void>
  deleteDeployment: (id: string) => Promise<void>
  setSelectedDeployment: (deployment: DatabaseDeployment | null) => void
  
  // Tenant management
  fetchTenants: (deploymentId: string) => Promise<void>
  createTenant: (deploymentId: string, config: TenantConfig) => Promise<void>
  deleteTenant: (deploymentId: string, tenantId: string) => Promise<void>
  
  // Backup management
  fetchBackups: (deploymentId: string) => Promise<void>
  createBackup: (deploymentId: string, type: 'full' | 'incremental') => Promise<void>
  restoreBackup: (deploymentId: string, backupId: string) => Promise<void>
  deleteBackup: (deploymentId: string, backupId: string) => Promise<void>
  
  // Real-time metrics
  subscribeToMetrics: (deploymentId: string) => void
  unsubscribeFromMetrics: (deploymentId: string) => void
  
  // Utility actions
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void
}


export const useDatabaseStore = create<DatabaseStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      deployments: [],
      templates: [],
      selectedDeployment: null,
      tenants: new Map(),
      backups: new Map(),
      metrics: new Map(),
      loading: false,
      error: null,
      wsConnections: new Map(),

      // Actions
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),
      
      setSelectedDeployment: (deployment) => set({ selectedDeployment: deployment }),

      fetchDeployments: async () => {
        try {
          set({ loading: true, error: null })
          const response = await apiHelpers.databases.listDeployments()
          set({ deployments: response.data.deployments || [], loading: false })
        } catch (error) {
          console.error('Failed to fetch deployments:', error)
          set({ error: error instanceof Error ? error.message : 'Failed to fetch deployments', loading: false })
        }
      },

      fetchTemplates: async () => {
        try {
          set({ loading: true, error: null })
          const response = await apiHelpers.databases.listTemplates()
          set({ templates: response.data.templates || [], loading: false })
        } catch (error) {
          console.error('Failed to fetch templates:', error)
          set({ error: error instanceof Error ? error.message : 'Failed to fetch templates', loading: false })
        }
      },

      deployDatabase: async (config) => {
        try {
          set({ loading: true, error: null })
          await apiHelpers.databases.deploy(config)
          
          // Refresh deployments after successful deployment
          await get().fetchDeployments()
          
          set({ loading: false })
        } catch (error) {
          console.error('Failed to deploy database:', error)
          set({ error: error instanceof Error ? error.message : 'Failed to deploy database', loading: false })
        }
      },

      deleteDeployment: async (id) => {
        try {
          set({ loading: true, error: null })
          await apiHelpers.databases.deleteDeployment(id)
          
          // Remove from local state
          set((state) => ({
            deployments: state.deployments.filter(d => d.id !== id),
            selectedDeployment: state.selectedDeployment?.id === id ? null : state.selectedDeployment,
            loading: false
          }))
        } catch (error) {
          console.error('Failed to delete deployment:', error)
          set({ error: error instanceof Error ? error.message : 'Failed to delete deployment', loading: false })
        }
      },

      fetchTenants: async (deploymentId) => {
        try {
          const response = await apiHelpers.databases.listTenants(deploymentId)
          set((state) => ({
            tenants: new Map(state.tenants.set(deploymentId, response.data.tenants || []))
          }))
        } catch (error) {
          console.error('Failed to fetch tenants:', error)
          set({ error: error instanceof Error ? error.message : 'Failed to fetch tenants' })
        }
      },

      createTenant: async (deploymentId, config) => {
        try {
          set({ loading: true, error: null })
          await apiHelpers.databases.createTenant(deploymentId, config)
          
          // Refresh tenants
          await get().fetchTenants(deploymentId)
          
          set({ loading: false })
        } catch (error) {
          console.error('Failed to create tenant:', error)
          set({ error: error instanceof Error ? error.message : 'Failed to create tenant', loading: false })
        }
      },

      deleteTenant: async (deploymentId, tenantId) => {
        try {
          set({ loading: true, error: null })
          await apiHelpers.databases.deleteTenant(deploymentId, tenantId)
          
          // Refresh tenants
          await get().fetchTenants(deploymentId)
          
          set({ loading: false })
        } catch (error) {
          console.error('Failed to delete tenant:', error)
          set({ error: error instanceof Error ? error.message : 'Failed to delete tenant', loading: false })
        }
      },

      fetchBackups: async (deploymentId) => {
        try {
          const response = await apiHelpers.databases.listBackups(deploymentId)
          set((state) => ({
            backups: new Map(state.backups.set(deploymentId, response.data.backups || []))
          }))
        } catch (error) {
          console.error('Failed to fetch backups:', error)
          set({ error: error instanceof Error ? error.message : 'Failed to fetch backups' })
        }
      },

      createBackup: async (deploymentId, type) => {
        try {
          set({ loading: true, error: null })
          await apiHelpers.databases.createBackup(deploymentId, { type })
          
          // Refresh backups
          await get().fetchBackups(deploymentId)
          
          set({ loading: false })
        } catch (error) {
          console.error('Failed to create backup:', error)
          set({ error: error instanceof Error ? error.message : 'Failed to create backup', loading: false })
        }
      },

      restoreBackup: async (deploymentId, backupId) => {
        try {
          set({ loading: true, error: null })
          await apiHelpers.databases.restoreBackup(deploymentId, backupId)
          set({ loading: false })
        } catch (error) {
          console.error('Failed to restore backup:', error)
          set({ error: error instanceof Error ? error.message : 'Failed to restore backup', loading: false })
        }
      },

      deleteBackup: async (deploymentId, backupId) => {
        try {
          set({ loading: true, error: null })
          await apiHelpers.databases.deleteBackup(deploymentId, backupId)
          
          // Refresh backups
          await get().fetchBackups(deploymentId)
          
          set({ loading: false })
        } catch (error) {
          console.error('Failed to delete backup:', error)
          set({ error: error instanceof Error ? error.message : 'Failed to delete backup', loading: false })
        }
      },

      subscribeToMetrics: (deploymentId) => {
        const wsUrl = `${process.env.NEXT_PUBLIC_API_URL?.replace('http', 'ws') || 'ws://localhost:8080'}/api/websocket`
        const ws = new WebSocket(wsUrl)
        
        ws.onopen = () => {
          ws.send(JSON.stringify({
            type: 'subscribe',
            topic: `database:${deploymentId}:metrics`
          }))
        }
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            if (data.type === 'database:metrics') {
              set((state) => ({
                metrics: new Map(state.metrics.set(deploymentId, data.payload))
              }))
            }
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error)
          }
        }
        
        ws.onerror = (error) => {
          console.error('WebSocket error:', error)
        }
        
        ws.onclose = () => {
          // Auto-reconnect after 5 seconds
          setTimeout(() => {
            if (get().wsConnections.has(deploymentId)) {
              get().subscribeToMetrics(deploymentId)
            }
          }, 5000)
        }
        
        set((state) => ({
          wsConnections: new Map(state.wsConnections.set(deploymentId, ws))
        }))
      },

      unsubscribeFromMetrics: (deploymentId) => {
        const ws = get().wsConnections.get(deploymentId)
        if (ws) {
          ws.close()
          set((state) => {
            const newConnections = new Map(state.wsConnections)
            newConnections.delete(deploymentId)
            return { wsConnections: newConnections }
          })
        }
      },
    }),
    {
      name: 'database-store',
      partialize: (state) => ({
        deployments: state.deployments,
        templates: state.templates,
        selectedDeployment: state.selectedDeployment,
      }),
    }
  )
)