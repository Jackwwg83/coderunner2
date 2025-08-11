"use client"

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ArrowLeft, Copy, ExternalLink, Pause, Play, RefreshCw, Settings, Trash2, Plus, Eye, Activity, FileText, Filter, Download, Loader2, AlertTriangle, Check, Zap } from 'lucide-react'
import { useDeploymentsStore } from '@/lib/stores/deployments.store'
import { useAuthStore } from '@/lib/stores/auth.store'
import { DeploymentLog } from '@/lib/websocket'
import { toast } from 'sonner'

export default function DeploymentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const deploymentId = params.id as string
  
  const [activeTab, setActiveTab] = useState('overview')
  const [logLevel, setLogLevel] = useState<string>('all')
  const [logSearch, setLogSearch] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const [isControlling, setIsControlling] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{action: 'start' | 'stop' | 'restart', open: boolean}>({action: 'start', open: false})
  const logsEndRef = useRef<HTMLDivElement>(null)

  const {
    currentDeployment,
    logs,
    isLoading,
    error,
    isWebSocketConnected,
    wsError,
    fetchDeployment,
    connectWebSocket,
    subscribeToDeployment,
    unsubscribeFromDeployment,
    fetchDeploymentLogs,
    controlDeployment
  } = useDeploymentsStore()

  const { token, isAuthenticated } = useAuthStore()

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll])

  // Initialize deployment data and WebSocket connection
  useEffect(() => {
    if (!isAuthenticated || !token) {
      router.push('/auth')
      return
    }

    const initializeDeployment = async () => {
      try {
        // Fetch deployment details
        await fetchDeployment(deploymentId)
        
        // Connect WebSocket if not already connected
        if (!isWebSocketConnected) {
          await connectWebSocket(token)
        }

        // Subscribe to this deployment's events
        subscribeToDeployment(deploymentId)
        
        // Fetch historical logs
        await fetchDeploymentLogs(deploymentId)
        
      } catch (error) {
        console.error('Failed to initialize deployment:', error)
        toast.error('Failed to load deployment details')
      }
    }

    initializeDeployment()

    // Cleanup subscription on unmount
    return () => {
      unsubscribeFromDeployment(deploymentId)
    }
  }, [deploymentId, token, isAuthenticated])

  const deploymentLogs = logs.get(deploymentId) || []

  // Filter logs based on level and search
  const filteredLogs = deploymentLogs.filter(log => {
    const levelMatch = logLevel === 'all' || log.level === logLevel
    const searchMatch = logSearch === '' || 
      log.message.toLowerCase().includes(logSearch.toLowerCase()) ||
      log.source.toLowerCase().includes(logSearch.toLowerCase())
    return levelMatch && searchMatch
  })

  const getLogColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error': return 'text-red-400'
      case 'warn': return 'text-yellow-400'
      case 'info': return 'text-blue-400'
      case 'debug': return 'text-purple-400'
      case 'trace': return 'text-gray-400'
      default: return 'text-neutral-400'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-green-400 bg-green-500'
      case 'deploying': return 'text-blue-400 bg-blue-500'
      case 'stopped': return 'text-gray-400 bg-gray-500'
      case 'failed': return 'text-red-400 bg-red-500'
      default: return 'text-gray-400 bg-gray-500'
    }
  }

  const copyUrl = () => {
    if (currentDeployment?.publicUrl) {
      navigator.clipboard.writeText(currentDeployment.publicUrl)
      toast.success('URL copied to clipboard')
    }
  }

  const handleControl = async (action: 'start' | 'stop' | 'restart') => {
    setIsControlling(true)
    try {
      await controlDeployment(deploymentId, action)
      toast.success(`Deployment ${action === 'restart' ? 'restarted' : action + 'ed'} successfully`, {
        description: `The deployment is now ${action === 'stop' ? 'stopping' : action === 'start' ? 'starting' : 'restarting'}`,
        duration: 3000
      })
      setConfirmAction({action: 'start', open: false})
    } catch (error: any) {
      toast.error(`Failed to ${action} deployment`, {
        description: error.message || 'An unexpected error occurred',
        duration: 5000
      })
    } finally {
      setIsControlling(false)
    }
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'restart': return RefreshCw
      case 'start': return Play
      case 'stop': return Pause
      default: return RefreshCw
    }
  }

  const getActionColor = (action: string) => {
    switch (action) {
      case 'restart': return 'border-orange-600 text-orange-400 hover:bg-orange-900/20'
      case 'start': return 'border-green-600 text-green-400 hover:bg-green-900/20'
      case 'stop': return 'border-red-600 text-red-400 hover:bg-red-900/20'
      default: return 'border-neutral-700'
    }
  }

  const downloadLogs = () => {
    const logText = filteredLogs
      .map(log => `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.source}] ${log.message}`)
      .join('\n')
    
    const blob = new Blob([logText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `deployment-${deploymentId}-logs-${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toast.success('Logs downloaded successfully', {
      description: `${filteredLogs.length} log entries exported`,
      duration: 3000
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading deployment...</span>
        </div>
      </div>
    )
  }

  if (error || !currentDeployment) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Deployment not found</h1>
          <p className="text-neutral-400 mb-4">{error || 'The requested deployment could not be loaded.'}</p>
          <Button onClick={() => router.push('/deployments')}>
            Back to Deployments
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-neutral-800 p-6">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="ghost" size="sm" className="hover:bg-neutral-800" onClick={() => router.push('/deployments')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold font-mono">{currentDeployment.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${getStatusColor(currentDeployment.status).split(' ')[1]}`} />
                <span className={getStatusColor(currentDeployment.status).split(' ')[0]}>{currentDeployment.status}</span>
              </div>
              <Badge variant="secondary">{currentDeployment.runtimeType}</Badge>
              <span className="text-neutral-400">•</span>
              <span className="text-neutral-400">Created: {new Date(currentDeployment.createdAt).toLocaleDateString()}</span>
              {wsError && (
                <>
                  <span className="text-neutral-400">•</span>
                  <span className="text-red-400 text-sm">WebSocket: {wsError}</span>
                </>
              )}
              {isWebSocketConnected && (
                <>
                  <span className="text-neutral-400">•</span>
                  <span className="text-green-400 text-sm">Live updates active</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-6">
          {[
            { id: 'overview', label: 'Overview', icon: Eye },
            { id: 'logs', label: 'Logs', icon: FileText },
            { id: 'metrics', label: 'Metrics', icon: Activity },
            { id: 'settings', label: 'Settings', icon: Settings }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-orange-500/20 text-orange-400'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Deployment Info */}
            <Card className="bg-neutral-900 border-neutral-800">
              <CardHeader>
                <CardTitle>Deployment Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-neutral-400 mb-1">URL</p>
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-blue-400 flex-1">{currentDeployment.publicUrl || 'Not available'}</p>
                    {currentDeployment.publicUrl && (
                      <>
                        <Button size="sm" variant="outline" onClick={copyUrl} className="border-neutral-700">
                          <Copy className="w-3 h-3" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="border-neutral-700" 
                          onClick={() => window.open(currentDeployment.publicUrl, '_blank')}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-neutral-400 mb-1">Created</p>
                  <p>{new Date(currentDeployment.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-400 mb-1">Runtime</p>
                  <p>{currentDeployment.runtimeType}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-400 mb-1">Status</p>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(currentDeployment.status).split(' ')[1]}`} />
                    <span className={getStatusColor(currentDeployment.status).split(' ')[0]}>{currentDeployment.status}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="bg-neutral-900 border-neutral-800">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Dialog open={confirmAction.open} onOpenChange={(open) => setConfirmAction({...confirmAction, open})}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        className={getActionColor('restart')}
                        onClick={() => setConfirmAction({action: 'restart', open: true})}
                        disabled={isLoading || isControlling}
                      >
                        {isControlling && confirmAction.action === 'restart' ? 
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 
                          <RefreshCw className="w-4 h-4 mr-2" />
                        }
                        Restart
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="border-neutral-800">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-orange-400" />
                          Confirm Restart
                        </DialogTitle>
                        <DialogDescription>
                          Are you sure you want to restart <span className="font-mono text-white">{currentDeployment.name}</span>? 
                          This will temporarily interrupt service during the restart process.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button 
                          variant="outline" 
                          className="border-neutral-700"
                          onClick={() => setConfirmAction({action: 'start', open: false})}
                        >
                          Cancel
                        </Button>
                        <Button 
                          className="bg-orange-600 hover:bg-orange-700 text-white"
                          onClick={() => handleControl('restart')}
                          disabled={isControlling}
                        >
                          {isControlling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                          Restart Deployment
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        className={getActionColor('stop')}
                        disabled={isLoading || isControlling || currentDeployment.status === 'stopped'}
                      >
                        {isControlling ? 
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 
                          <Pause className="w-4 h-4 mr-2" />
                        }
                        Stop
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="border-neutral-800">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-red-400" />
                          Confirm Stop
                        </DialogTitle>
                        <DialogDescription>
                          Are you sure you want to stop <span className="font-mono text-white">{currentDeployment.name}</span>? 
                          This will make your deployment unavailable until you start it again.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button variant="outline" className="border-neutral-700">
                          Cancel
                        </Button>
                        <Button 
                          className="bg-red-600 hover:bg-red-700 text-white"
                          onClick={() => handleControl('stop')}
                          disabled={isControlling}
                        >
                          {isControlling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Pause className="w-4 h-4 mr-2" />}
                          Stop Deployment
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                {currentDeployment.status === 'stopped' && (
                  <Button 
                    variant="outline" 
                    className={`w-full ${getActionColor('start')}`}
                    onClick={() => handleControl('start')}
                    disabled={isLoading || isControlling}
                  >
                    {isControlling ? 
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 
                      <Play className="w-4 h-4 mr-2" />
                    }
                    Start Deployment
                  </Button>
                )}
                
                {currentDeployment.publicUrl && (
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" className="border-neutral-700 hover:bg-neutral-800" onClick={copyUrl}>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy URL
                    </Button>
                    <Button 
                      variant="outline" 
                      className="border-neutral-700 hover:bg-neutral-800" 
                      onClick={() => window.open(currentDeployment.publicUrl, '_blank')}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Visit Site
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Resource Usage */}
            <Card className="bg-neutral-900 border-neutral-800 lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    Resource Usage
                  </CardTitle>
                  {isWebSocketConnected && (
                    <div className="flex items-center gap-1 text-sm text-green-400">
                      <Zap className="w-4 h-4" />
                      Real-time
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          (currentDeployment.cpu || 0) > 80 ? 'bg-red-400' :
                          (currentDeployment.cpu || 0) > 60 ? 'bg-yellow-400' : 'bg-green-400'
                        }`} />
                        CPU Usage
                      </span>
                      <span className="font-mono font-medium">{currentDeployment.cpu || 0}%</span>
                    </div>
                    <Progress 
                      value={currentDeployment.cpu || 0} 
                      className="h-3" 
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          (currentDeployment.memory || 0) > 80 ? 'bg-red-400' :
                          (currentDeployment.memory || 0) > 60 ? 'bg-yellow-400' : 'bg-green-400'
                        }`} />
                        Memory Usage
                      </span>
                      <span className="font-mono font-medium">{currentDeployment.memory || 0}%</span>
                    </div>
                    <Progress 
                      value={currentDeployment.memory || 0} 
                      className="h-3" 
                    />
                  </div>
                </div>
                {currentDeployment.network && (
                  <div className="mt-6 pt-4 border-t border-neutral-800">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Network In</span>
                        <span className="font-mono">{currentDeployment.network.in} B/s</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Network Out</span>
                        <span className="font-mono">{currentDeployment.network.out} B/s</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === 'logs' && (
          <Card className="bg-neutral-900 border-neutral-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle>Application Logs</CardTitle>
                  <Badge variant="secondary" className="bg-neutral-800 text-neutral-300">
                    {filteredLogs.length} entries
                  </Badge>
                  {isWebSocketConnected && (
                    <div className="flex items-center gap-1 text-sm text-green-400">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                      Live
                    </div>
                  )}
                  {wsError && (
                    <div className="flex items-center gap-1 text-sm text-red-400">
                      <div className="w-2 h-2 bg-red-400 rounded-full" />
                      Offline
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="border-neutral-700"
                    onClick={downloadLogs}
                    disabled={filteredLogs.length === 0}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Export
                  </Button>
                  <Button 
                    size="sm" 
                    variant={autoScroll ? "default" : "outline"}
                    className={autoScroll ? "bg-orange-500 hover:bg-orange-600 text-black" : "border-neutral-700"}
                    onClick={() => setAutoScroll(!autoScroll)}
                  >
                    <Check className={`w-4 h-4 mr-1 ${autoScroll ? 'block' : 'hidden'}`} />
                    Auto-scroll
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-4 mt-4">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-neutral-400" />
                  <select 
                    value={logLevel}
                    onChange={(e) => setLogLevel(e.target.value)}
                    className="bg-neutral-800 border border-neutral-700 rounded px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
                  >
                    <option value="all">All Levels</option>
                    <option value="info">INFO</option>
                    <option value="warn">WARN</option>
                    <option value="error">ERROR</option>
                    <option value="debug">DEBUG</option>
                    <option value="trace">TRACE</option>
                  </select>
                </div>
                <Input
                  placeholder="Search logs..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className="flex-1 max-w-xs bg-neutral-800 border-neutral-700 focus:border-orange-500"
                />
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-neutral-500">
                    Showing {filteredLogs.length} of {deploymentLogs.length}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-black rounded-lg border border-neutral-800 font-mono text-sm max-h-[500px] overflow-y-auto relative">
                {filteredLogs.length === 0 ? (
                  <div className="text-neutral-500 text-center py-12">
                    <FileText className="w-8 h-8 mx-auto mb-3 opacity-50" />
                    <p className="font-sans">
                      {deploymentLogs.length === 0 ? 'No logs available yet' : 'No logs match the current filters'}
                    </p>
                    {deploymentLogs.length === 0 && (
                      <p className="text-xs text-neutral-600 mt-2 font-sans">
                        {isWebSocketConnected ? 'Waiting for log entries...' : 'Connect to see live logs'}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="p-4 space-y-1">
                    {filteredLogs.map((log, index) => (
                      <div 
                        key={`${log.id || index}`} 
                        className="group flex gap-3 py-1.5 px-2 -mx-2 rounded hover:bg-neutral-900/30 transition-colors"
                      >
                        <span className="text-neutral-500 shrink-0 text-xs min-w-[75px] pt-0.5">
                          {new Date(log.timestamp).toLocaleTimeString('en-US', { 
                            hour12: false,
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </span>
                        <span className={`shrink-0 font-medium min-w-[55px] text-xs pt-0.5 ${getLogColor(log.level)}`}>
                          {log.level.toUpperCase().padEnd(5)}
                        </span>
                        <span className="text-neutral-400 shrink-0 min-w-[70px] text-xs pt-0.5 opacity-75">
                          {log.source.padEnd(8)}
                        </span>
                        <span className="text-neutral-200 break-all leading-relaxed group-hover:text-white transition-colors">
                          {log.message}
                        </span>
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                )}
                
                {/* Auto-scroll indicator */}
                {autoScroll && filteredLogs.length > 0 && (
                  <div className="absolute bottom-2 right-2">
                    <div className="bg-orange-500/10 border border-orange-500/20 rounded-full p-1">
                      <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Metrics Tab */}
        {activeTab === 'metrics' && (
          <div className="space-y-6">
            <div className="flex gap-4">
              <Button size="sm" variant="outline" className="border-orange-500 text-orange-400">1H</Button>
              <Button size="sm" variant="outline" className="border-neutral-700">24H</Button>
              <Button size="sm" variant="outline" className="border-neutral-700">7D</Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-neutral-900 border-neutral-800">
                <CardHeader>
                  <CardTitle>CPU Usage</CardTitle>
                  <p className="text-neutral-400">Current: {currentDeployment.cpu || 0}%</p>
                </CardHeader>
                <CardContent>
                  <div className="h-48 bg-neutral-800 rounded-lg flex items-center justify-center">
                    <p className="text-neutral-400">📈 CPU Chart (Coming soon)</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-neutral-900 border-neutral-800">
                <CardHeader>
                  <CardTitle>Memory Usage</CardTitle>
                  <p className="text-neutral-400">Current: {currentDeployment.memory || 0}%</p>
                </CardHeader>
                <CardContent>
                  <div className="h-48 bg-neutral-800 rounded-lg flex items-center justify-center">
                    <p className="text-neutral-400">📊 Memory Chart (Coming soon)</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-neutral-900 border-neutral-800 lg:col-span-2">
                <CardHeader>
                  <CardTitle>Network I/O</CardTitle>
                  <p className="text-neutral-400">
                    In: {currentDeployment.network?.in || 0} bytes/s • Out: {currentDeployment.network?.out || 0} bytes/s
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="h-48 bg-neutral-800 rounded-lg flex items-center justify-center">
                    <p className="text-neutral-400">📉 Network Chart (Coming soon)</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <Card className="bg-neutral-900 border-neutral-800">
              <CardHeader>
                <CardTitle>Deployment Settings</CardTitle>
                <p className="text-neutral-400">Settings and configuration will be available in future updates</p>
              </CardHeader>
              <CardContent>
                <div className="h-48 bg-neutral-800 rounded-lg flex items-center justify-center">
                  <p className="text-neutral-400">Settings panel coming soon</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}