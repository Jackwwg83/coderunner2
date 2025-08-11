"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Plus, Search, Eye, ExternalLink, Play, Pause, RefreshCw, Loader2, Activity, Calendar, Zap } from 'lucide-react'
import { useDeploymentsStore } from '@/lib/stores/deployments.store'
import { useAuthStore } from '@/lib/stores/auth.store'
import { toast } from 'sonner'

export default function DeploymentsPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')

  const {
    deployments,
    isLoading,
    error,
    isWebSocketConnected,
    fetchDeployments,
    controlDeployment
  } = useDeploymentsStore()

  const { isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth')
      return
    }

    fetchDeployments()
  }, [isAuthenticated])

  const filteredDeployments = deployments.filter(deployment => {
    const matchesSearch = deployment.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         deployment.description?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = selectedStatus === 'all' || deployment.status === selectedStatus
    return matchesSearch && matchesStatus
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-green-400 bg-green-500/10 border-green-500/20'
      case 'deploying': return 'text-blue-400 bg-blue-500/10 border-blue-500/20'
      case 'stopped': return 'text-gray-400 bg-gray-500/10 border-gray-500/20'
      case 'failed': return 'text-red-400 bg-red-500/10 border-red-500/20'
      default: return 'text-gray-400 bg-gray-500/10 border-gray-500/20'
    }
  }

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-400'
      case 'deploying': return 'bg-blue-400 animate-pulse'
      case 'stopped': return 'bg-gray-400'
      case 'failed': return 'bg-red-400'
      default: return 'bg-gray-400'
    }
  }

  const handleQuickAction = async (deploymentId: string, action: 'start' | 'stop' | 'restart') => {
    try {
      await controlDeployment(deploymentId, action)
      toast.success(`Deployment ${action === 'restart' ? 'restarted' : action + 'ed'} successfully`)
    } catch (error: any) {
      toast.error(`Failed to ${action} deployment`, {
        description: error.message
      })
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading deployments...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-neutral-800 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Deployments</h1>
            <p className="text-neutral-400 mt-1">Manage and monitor your deployed applications</p>
          </div>
          <div className="flex items-center gap-4">
            {isWebSocketConnected && (
              <div className="flex items-center gap-2 text-sm text-green-400">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                Real-time updates active
              </div>
            )}
            <Button 
              className="bg-orange-600 hover:bg-orange-700 text-white"
              onClick={() => router.push('/deploy/new')}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Deployment
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-neutral-400" />
            <Input
              placeholder="Search deployments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 bg-neutral-900 border-neutral-700 focus:border-orange-500"
            />
          </div>
          <select 
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          >
            <option value="all">All Status</option>
            <option value="running">Running</option>
            <option value="deploying">Deploying</option>
            <option value="stopped">Stopped</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-700/30 rounded-lg text-red-400">
            <p>{error}</p>
          </div>
        )}

        {filteredDeployments.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="w-16 h-16 mx-auto mb-4 text-neutral-600" />
            <h3 className="text-xl font-medium mb-2">
              {deployments.length === 0 ? 'No deployments yet' : 'No deployments match your filters'}
            </h3>
            <p className="text-neutral-400 mb-6">
              {deployments.length === 0 ? 
                'Get started by creating your first deployment' : 
                'Try adjusting your search or filters'}
            </p>
            {deployments.length === 0 && (
              <Button 
                className="bg-orange-600 hover:bg-orange-700 text-white"
                onClick={() => router.push('/deploy/new')}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Deployment
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDeployments.map((deployment) => (
              <Card key={deployment.id} className="bg-neutral-900 border-neutral-800 hover:border-neutral-700 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg font-mono truncate">{deployment.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <div className={`w-2 h-2 rounded-full ${getStatusDot(deployment.status)}`} />
                        <Badge className={getStatusColor(deployment.status)} variant="outline">
                          {deployment.status}
                        </Badge>
                        <Badge variant="secondary" className="bg-neutral-800">
                          {deployment.runtimeType}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  {deployment.description && (
                    <p className="text-sm text-neutral-400 mt-2 line-clamp-2">
                      {deployment.description}
                    </p>
                  )}
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Metrics */}
                  {(deployment.cpu || deployment.memory) && (
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1">
                        <Activity className="w-3 h-3 text-neutral-500" />
                        <span className="text-neutral-500">CPU: {deployment.cpu || 0}%</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Zap className="w-3 h-3 text-neutral-500" />
                        <span className="text-neutral-500">MEM: {deployment.memory || 0}%</span>
                      </div>
                    </div>
                  )}

                  {/* URL */}
                  {deployment.publicUrl && (
                    <div className="flex items-center gap-2">
                      <ExternalLink className="w-3 h-3 text-neutral-500 shrink-0" />
                      <span className="text-xs text-blue-400 truncate font-mono">
                        {deployment.publicUrl}
                      </span>
                    </div>
                  )}

                  {/* Created date */}
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3 h-3 text-neutral-500" />
                    <span className="text-xs text-neutral-500">
                      Created {new Date(deployment.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 border-neutral-700 hover:bg-neutral-800"
                      onClick={() => router.push(`/deployments/${deployment.id}`)}
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      View
                    </Button>
                    
                    {deployment.status === 'running' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-orange-600 text-orange-400 hover:bg-orange-900/20"
                        onClick={() => handleQuickAction(deployment.id, 'restart')}
                      >
                        <RefreshCw className="w-3 h-3" />
                      </Button>
                    )}
                    
                    {deployment.status === 'stopped' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-green-600 text-green-400 hover:bg-green-900/20"
                        onClick={() => handleQuickAction(deployment.id, 'start')}
                      >
                        <Play className="w-3 h-3" />
                      </Button>
                    )}
                    
                    {deployment.status === 'running' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-red-600 text-red-400 hover:bg-red-900/20"
                        onClick={() => handleQuickAction(deployment.id, 'stop')}
                      >
                        <Pause className="w-3 h-3" />
                      </Button>
                    )}

                    {deployment.publicUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-neutral-700 hover:bg-neutral-800"
                        onClick={() => window.open(deployment.publicUrl, '_blank')}
                      >
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Summary stats */}
        {deployments.length > 0 && (
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
            {['running', 'deploying', 'stopped', 'failed'].map(status => {
              const count = deployments.filter(d => d.status === status).length
              return (
                <div key={status} className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 text-center">
                  <div className={`text-2xl font-bold ${getStatusColor(status).split(' ')[0]}`}>
                    {count}
                  </div>
                  <div className="text-sm text-neutral-400 capitalize">{status}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}