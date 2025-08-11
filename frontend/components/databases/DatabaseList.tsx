'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { 
  Copy, 
  Database, 
  MoreVertical, 
  Search, 
  Settings, 
  Trash2, 
  ExternalLink,
  Play,
  Square,
  AlertTriangle,
  Loader2
} from 'lucide-react'
import { useDatabaseStore, DatabaseDeployment } from '@/lib/store/databaseStore'

interface DatabaseListProps {
  onSelect: (deployment: DatabaseDeployment) => void
}

export default function DatabaseList({ onSelect }: DatabaseListProps) {
  const {
    deployments,
    loading,
    error,
    fetchDeployments,
    deleteDeployment,
    clearError
  } = useDatabaseStore()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    fetchDeployments()
  }, [fetchDeployments])

  const getStatusColor = (status: DatabaseDeployment['status']) => {
    switch (status) {
      case 'running': return 'bg-green-500'
      case 'creating': return 'bg-blue-500 animate-pulse'
      case 'maintenance': return 'bg-yellow-500'
      case 'failed': return 'bg-red-500'
      case 'stopped': return 'bg-gray-500'
      case 'deleting': return 'bg-red-400 animate-pulse'
      default: return 'bg-gray-500'
    }
  }

  const getStatusText = (status: DatabaseDeployment['status']) => {
    switch (status) {
      case 'running': return 'Running'
      case 'creating': return 'Creating...'
      case 'maintenance': return 'Maintenance'
      case 'failed': return 'Failed'
      case 'stopped': return 'Stopped'
      case 'deleting': return 'Deleting...'
      default: return 'Unknown'
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

  const copyConnectionString = (connectionString: string, event: React.MouseEvent) => {
    event.stopPropagation()
    navigator.clipboard.writeText(connectionString)
    // TODO: Add toast notification
  }

  const handleDelete = async (deployment: DatabaseDeployment, event: React.MouseEvent) => {
    event.stopPropagation()
    if (!confirm(`Are you sure you want to delete ${deployment.name}? This action cannot be undone.`)) {
      return
    }
    
    setActionLoading(deployment.id)
    try {
      await deleteDeployment(deployment.id)
    } finally {
      setActionLoading(null)
    }
  }

  const filteredDeployments = deployments.filter(deployment =>
    deployment.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    deployment.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    deployment.region.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-red-400 mb-2">Failed to load deployments</h3>
          <p className="text-neutral-400 mb-4">{error}</p>
          <div className="flex gap-2 justify-center">
            <Button
              onClick={() => {
                clearError()
                fetchDeployments()
              }}
              variant="outline"
              className="border-red-500 hover:bg-red-500/10"
            >
              Try Again
            </Button>
            <Button
              onClick={clearError}
              variant="ghost"
            >
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <Input
          placeholder="Search databases..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-neutral-900 border-neutral-700 focus:border-orange-500"
        />
      </div>

      {/* Loading State */}
      {loading && deployments.length === 0 && (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-orange-500 animate-spin mx-auto mb-4" />
            <p className="text-neutral-400">Loading deployments...</p>
          </div>
        </div>
      )}

      {/* Deployments Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredDeployments.map((deployment) => (
          <Card 
            key={deployment.id} 
            className="bg-neutral-900 border-neutral-800 hover:border-orange-500/50 transition-all duration-200 cursor-pointer group"
            onClick={() => onSelect(deployment)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getTypeIcon(deployment.type)}</span>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-lg font-mono truncate">
                      {deployment.name}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(deployment.status)}`} />
                      <span className="text-sm text-neutral-400 capitalize">
                        {deployment.type}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {deployment.region}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelect(deployment)
                    }}
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => handleDelete(deployment, e)}
                    disabled={actionLoading === deployment.id}
                  >
                    {actionLoading === deployment.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4 text-red-400" />
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Status */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-400">Status</span>
                <span className={`font-medium ${
                  deployment.status === 'running' ? 'text-green-400' :
                  deployment.status === 'failed' ? 'text-red-400' :
                  deployment.status === 'creating' || deployment.status === 'deleting' ? 'text-blue-400' :
                  'text-yellow-400'
                }`}>
                  {getStatusText(deployment.status)}
                </span>
              </div>

              {/* Storage Usage */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-neutral-400">Storage</span>
                  <span>
                    {deployment.storage.used}{deployment.storage.unit} / {deployment.storage.total}{deployment.storage.unit}
                  </span>
                </div>
                <Progress 
                  value={(deployment.storage.used / deployment.storage.total) * 100} 
                  className="h-2" 
                />
              </div>

              {/* Connections */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-neutral-400">Connections</span>
                  <span>
                    {deployment.connections.active} / {deployment.connections.max}
                  </span>
                </div>
                <Progress 
                  value={(deployment.connections.active / deployment.connections.max) * 100} 
                  className="h-2" 
                />
              </div>

              {/* Resources */}
              <div className="text-sm">
                <div className="flex justify-between mb-1">
                  <span className="text-neutral-400">CPU</span>
                  <span>{deployment.resource_usage.cpu_cores} cores</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span className="text-neutral-400">Memory</span>
                  <span>{(deployment.resource_usage.memory_mb / 1024).toFixed(1)} GB</span>
                </div>
              </div>

              {/* Connection String (for running databases only) */}
              {deployment.status === 'running' && (
                <div>
                  <p className="text-sm text-neutral-400 mb-2">Connection String</p>
                  <div className="flex items-center gap-2 p-2 bg-neutral-800 rounded font-mono text-xs">
                    <span className="flex-1 truncate">{deployment.connection_string}</span>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={(e) => copyConnectionString(deployment.connection_string, e)}
                      className="h-6 w-6 p-0 hover:bg-neutral-700"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Created Date */}
              <div className="flex items-center justify-between text-sm pt-2 border-t border-neutral-800">
                <span className="text-neutral-400">
                  Created: {new Date(deployment.created_at).toLocaleDateString()}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredDeployments.length === 0 && !loading && (
        <div className="text-center py-12">
          <Database className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">
            {searchQuery ? 'No databases found' : 'No database deployments'}
          </h3>
          <p className="text-neutral-400 mb-4">
            {searchQuery 
              ? 'Try adjusting your search terms' 
              : 'Deploy your first database to get started'
            }
          </p>
        </div>
      )}
    </div>
  )
}