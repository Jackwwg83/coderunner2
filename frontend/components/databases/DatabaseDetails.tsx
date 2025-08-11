'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  ArrowLeft, 
  Copy, 
  Database, 
  Settings, 
  Trash2, 
  RefreshCw,
  Monitor,
  Users,
  Archive,
  Activity,
  Server,
  HardDrive,
  Cpu,
  MemoryStick,
  Network,
  AlertCircle,
  CheckCircle,
  Clock,
  ExternalLink
} from 'lucide-react'
import { useDatabaseStore, DatabaseDeployment, DatabaseMetrics, DatabaseTenant, DatabaseBackup } from '@/lib/store/databaseStore'
import TenantManager from './TenantManager'
import BackupManager from './BackupManager'
import MetricsPanel from './MetricsPanel'

interface DatabaseDetailsProps {
  deployment: DatabaseDeployment
  onBack: () => void
}

export default function DatabaseDetails({ deployment, onBack }: DatabaseDetailsProps) {
  const {
    metrics,
    tenants,
    backups,
    subscribeToMetrics,
    unsubscribeFromMetrics,
    fetchTenants,
    fetchBackups
  } = useDatabaseStore()

  const [activeTab, setActiveTab] = useState('overview')

  const deploymentMetrics = metrics.get(deployment.id)
  const deploymentTenants = tenants.get(deployment.id) || []
  const deploymentBackups = backups.get(deployment.id) || []

  useEffect(() => {
    // Subscribe to real-time metrics
    if (deployment.status === 'running') {
      subscribeToMetrics(deployment.id)
      fetchTenants(deployment.id)
      fetchBackups(deployment.id)
    }

    return () => {
      unsubscribeFromMetrics(deployment.id)
    }
  }, [deployment.id, deployment.status, subscribeToMetrics, unsubscribeFromMetrics, fetchTenants, fetchBackups])

  const getStatusIcon = (status: DatabaseDeployment['status']) => {
    switch (status) {
      case 'running': return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'creating': return <Clock className="w-5 h-5 text-blue-500 animate-spin" />
      case 'maintenance': return <AlertCircle className="w-5 h-5 text-yellow-500" />
      case 'failed': return <AlertCircle className="w-5 h-5 text-red-500" />
      case 'stopped': return <AlertCircle className="w-5 h-5 text-gray-500" />
      case 'deleting': return <Clock className="w-5 h-5 text-red-400 animate-spin" />
      default: return <AlertCircle className="w-5 h-5 text-gray-500" />
    }
  }

  const getTypeIcon = (type: DatabaseDeployment['type']) => {
    switch (type) {
      case 'postgresql': return '🐘'
      case 'redis': return '🔴'
      case 'mongodb': return '🍃'
      case 'mysql': return '🐬'
      case 'influxdb': return '📊'
      default: return '💾'
    }
  }

  const copyConnectionString = (connectionString: string) => {
    navigator.clipboard.writeText(connectionString)
    // TODO: Add toast notification
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="hover:bg-neutral-800"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Deployments
        </Button>
        
        <div className="flex items-center gap-3 flex-1">
          <span className="text-3xl">{getTypeIcon(deployment.type)}</span>
          <div>
            <h1 className="text-2xl font-bold font-mono">{deployment.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              {getStatusIcon(deployment.status)}
              <span className="text-sm text-neutral-400 capitalize">
                {deployment.type} • {deployment.region}
              </span>
              <Badge variant="secondary" className="text-xs">
                {deployment.status}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
          <Button variant="outline" size="sm" className="text-red-400 border-red-500/50 hover:bg-red-500/10">
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Monitor className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="metrics" className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Metrics
          </TabsTrigger>
          <TabsTrigger value="tenants" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Tenants ({deploymentTenants.length})
          </TabsTrigger>
          <TabsTrigger value="backups" className="flex items-center gap-2">
            <Archive className="w-4 h-4" />
            Backups ({deploymentBackups.length})
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            Logs
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Connection Info */}
            <Card className="bg-neutral-900 border-neutral-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Database className="w-5 h-5" />
                  Connection
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-neutral-400 mb-2">Endpoint</p>
                  <div className="flex items-center gap-2 p-2 bg-neutral-800 rounded font-mono text-sm">
                    <span className="flex-1">{deployment.endpoint}:{deployment.port}</span>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => copyConnectionString(`${deployment.endpoint}:${deployment.port}`)}
                      className="h-6 w-6 p-0"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                
                {deployment.status === 'running' && (
                  <div>
                    <p className="text-sm text-neutral-400 mb-2">Connection String</p>
                    <div className="flex items-center gap-2 p-2 bg-neutral-800 rounded font-mono text-sm">
                      <span className="flex-1 truncate">{deployment.connection_string}</span>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => copyConnectionString(deployment.connection_string)}
                        className="h-6 w-6 p-0"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                )}
                
                <Button className="w-full bg-orange-500 hover:bg-orange-600 text-black" disabled={deployment.status !== 'running'}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Connect
                </Button>
              </CardContent>
            </Card>

            {/* Resource Usage */}
            <Card className="bg-neutral-900 border-neutral-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Server className="w-5 h-5" />
                  Resources
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Cpu className="w-4 h-4 text-blue-400" />
                  <div className="flex-1">
                    <div className="flex justify-between text-sm">
                      <span>CPU</span>
                      <span>{deployment.resource_usage.cpu_cores} cores</span>
                    </div>
                    {deploymentMetrics && (
                      <Progress value={deploymentMetrics.cpu_usage_percent} className="h-2 mt-1" />
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <MemoryStick className="w-4 h-4 text-green-400" />
                  <div className="flex-1">
                    <div className="flex justify-between text-sm">
                      <span>Memory</span>
                      <span>{(deployment.resource_usage.memory_mb / 1024).toFixed(1)} GB</span>
                    </div>
                    {deploymentMetrics && (
                      <Progress value={deploymentMetrics.memory_usage_percent} className="h-2 mt-1" />
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <HardDrive className="w-4 h-4 text-purple-400" />
                  <div className="flex-1">
                    <div className="flex justify-between text-sm">
                      <span>Storage</span>
                      <span>{deployment.storage.used}{deployment.storage.unit} / {deployment.storage.total}{deployment.storage.unit}</span>
                    </div>
                    <Progress value={(deployment.storage.used / deployment.storage.total) * 100} className="h-2 mt-1" />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Network className="w-4 h-4 text-yellow-400" />
                  <div className="flex-1">
                    <div className="flex justify-between text-sm">
                      <span>Connections</span>
                      <span>{deployment.connections.active} / {deployment.connections.max}</span>
                    </div>
                    <Progress value={(deployment.connections.active / deployment.connections.max) * 100} className="h-2 mt-1" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Deployment Info */}
            <Card className="bg-neutral-900 border-neutral-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Database className="w-5 h-5" />
                  Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Instance ID</span>
                  <span className="font-mono text-xs bg-neutral-800 px-2 py-1 rounded">
                    {deployment.instance_id}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Template ID</span>
                  <span className="font-mono text-xs bg-neutral-800 px-2 py-1 rounded">
                    {deployment.template_id}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Created</span>
                  <span>{new Date(deployment.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Updated</span>
                  <span>{new Date(deployment.updated_at).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Deployment Time</span>
                  <span>{Math.round(deployment.deployment_time / 1000)}s</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Metrics Tab */}
        <TabsContent value="metrics">
          <MetricsPanel 
            deployment={deployment}
            metrics={deploymentMetrics}
          />
        </TabsContent>

        {/* Tenants Tab */}
        <TabsContent value="tenants">
          <TenantManager
            deploymentId={deployment.id}
            tenants={deploymentTenants}
          />
        </TabsContent>

        {/* Backups Tab */}
        <TabsContent value="backups">
          <BackupManager
            deploymentId={deployment.id}
            backups={deploymentBackups}
          />
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs">
          <Card className="bg-neutral-900 border-neutral-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Database Logs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-black rounded-lg p-4 font-mono text-sm">
                <div className="text-green-400 mb-2">[INFO] Database started successfully</div>
                <div className="text-blue-400 mb-2">[DEBUG] Connection pool initialized with 10 connections</div>
                <div className="text-yellow-400 mb-2">[WARN] High CPU usage detected: 85%</div>
                <div className="text-neutral-400 mb-2">[INFO] Backup completed successfully</div>
                <div className="text-red-400">[ERROR] Query timeout after 30 seconds</div>
              </div>
              <div className="flex justify-between items-center mt-4">
                <span className="text-sm text-neutral-400">
                  Showing last 100 entries
                </span>
                <Button variant="outline" size="sm">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}