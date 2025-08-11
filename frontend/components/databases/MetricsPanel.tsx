'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { 
  Activity, 
  Cpu, 
  MemoryStick, 
  HardDrive, 
  Network, 
  Database, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  RefreshCw,
  Clock,
  Zap,
  AlertTriangle,
  CheckCircle
} from 'lucide-react'
import { DatabaseDeployment, DatabaseMetrics } from '@/lib/store/databaseStore'

interface MetricsPanelProps {
  deployment: DatabaseDeployment
  metrics?: DatabaseMetrics
}

// Mock historical data for charts (in a real app, this would come from the API)
const generateMockHistory = (current: number, points: number = 24) => {
  const history = []
  const variation = current * 0.3 // 30% variation
  
  for (let i = points; i >= 0; i--) {
    const time = new Date(Date.now() - i * 5 * 60 * 1000) // 5-minute intervals
    const randomVariation = (Math.random() - 0.5) * variation
    const value = Math.max(0, Math.min(100, current + randomVariation))
    history.push({ time, value })
  }
  
  return history
}

const MiniChart = ({ data, color = '#f97316' }: { data: Array<{time: Date, value: number}>, color?: string }) => {
  const maxValue = Math.max(...data.map(d => d.value))
  const minValue = Math.min(...data.map(d => d.value))
  const range = maxValue - minValue || 1

  return (
    <div className="h-12 flex items-end justify-between gap-1">
      {data.slice(-12).map((point, index) => (
        <div
          key={index}
          className="bg-orange-500/20 rounded-sm min-w-[2px]"
          style={{
            height: `${((point.value - minValue) / range) * 100}%`,
            backgroundColor: color,
            opacity: 0.7
          }}
        />
      ))}
    </div>
  )
}

export default function MetricsPanel({ deployment, metrics }: MetricsPanelProps) {
  const [refreshTime, setRefreshTime] = useState(new Date())
  const [historicalData, setHistoricalData] = useState<{
    cpu: Array<{time: Date, value: number}>
    memory: Array<{time: Date, value: number}>
    connections: Array<{time: Date, value: number}>
    qps: Array<{time: Date, value: number}>
  }>({
    cpu: [],
    memory: [],
    connections: [],
    qps: []
  })

  // Generate mock historical data when metrics change
  useEffect(() => {
    if (metrics) {
      setHistoricalData({
        cpu: generateMockHistory(metrics.cpu_usage_percent),
        memory: generateMockHistory(metrics.memory_usage_percent),
        connections: generateMockHistory((metrics.connections_active / metrics.connections_max) * 100),
        qps: generateMockHistory(Math.min(100, metrics.queries_per_second * 2))
      })
      setRefreshTime(new Date())
    }
  }, [metrics])

  const getTrend = (data: Array<{value: number}>) => {
    if (data.length < 2) return 'stable'
    const recent = data.slice(-3)
    const avg = recent.reduce((sum, point) => sum + point.value, 0) / recent.length
    const prev = data[data.length - 4]?.value || avg
    
    if (avg > prev * 1.05) return 'up'
    if (avg < prev * 0.95) return 'down'
    return 'stable'
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="w-4 h-4 text-red-400" />
      case 'down': return <TrendingDown className="w-4 h-4 text-green-400" />
      default: return <Minus className="w-4 h-4 text-neutral-400" />
    }
  }

  const getHealthStatus = (value: number, thresholds: {warning: number, critical: number}) => {
    if (value >= thresholds.critical) return { status: 'critical', color: 'text-red-400', icon: AlertTriangle }
    if (value >= thresholds.warning) return { status: 'warning', color: 'text-yellow-400', icon: AlertTriangle }
    return { status: 'healthy', color: 'text-green-400', icon: CheckCircle }
  }

  if (!metrics) {
    return (
      <div className="space-y-6">
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Database className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Metrics Available</h3>
              <p className="text-neutral-400">
                {deployment.status === 'running' 
                  ? 'Waiting for metrics data...' 
                  : 'Database must be running to collect metrics'
                }
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const cpuHealth = getHealthStatus(metrics.cpu_usage_percent, { warning: 70, critical: 90 })
  const memoryHealth = getHealthStatus(metrics.memory_usage_percent, { warning: 80, critical: 95 })
  const storageHealth = getHealthStatus(metrics.storage_usage_percent, { warning: 85, critical: 95 })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Performance Metrics</h2>
          <p className="text-sm text-neutral-400 mt-1">
            Real-time database performance monitoring
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-400">
            Last updated: {refreshTime.toLocaleTimeString()}
          </span>
          <Button variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* CPU Usage */}
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-blue-400" />
                <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
              </div>
              {getTrendIcon(getTrend(historicalData.cpu))}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{metrics.cpu_usage_percent.toFixed(1)}%</span>
                <div className={cpuHealth.color}>
                  <cpuHealth.icon className="w-5 h-5" />
                </div>
              </div>
              <Progress value={metrics.cpu_usage_percent} className="h-2" />
              <MiniChart data={historicalData.cpu} color="#3b82f6" />
            </div>
          </CardContent>
        </Card>

        {/* Memory Usage */}
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MemoryStick className="w-5 h-5 text-green-400" />
                <CardTitle className="text-sm font-medium">Memory</CardTitle>
              </div>
              {getTrendIcon(getTrend(historicalData.memory))}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{metrics.memory_usage_percent.toFixed(1)}%</span>
                <div className={memoryHealth.color}>
                  <memoryHealth.icon className="w-5 h-5" />
                </div>
              </div>
              <Progress value={metrics.memory_usage_percent} className="h-2" />
              <MiniChart data={historicalData.memory} color="#10b981" />
            </div>
          </CardContent>
        </Card>

        {/* Storage Usage */}
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-purple-400" />
                <CardTitle className="text-sm font-medium">Storage</CardTitle>
              </div>
              <Badge variant="secondary" className="text-xs">
                {deployment.storage.used}{deployment.storage.unit}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{metrics.storage_usage_percent.toFixed(1)}%</span>
                <div className={storageHealth.color}>
                  <storageHealth.icon className="w-5 h-5" />
                </div>
              </div>
              <Progress value={metrics.storage_usage_percent} className="h-2" />
              <div className="text-xs text-neutral-400">
                {deployment.storage.used}{deployment.storage.unit} / {deployment.storage.total}{deployment.storage.unit}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Connections */}
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Network className="w-5 h-5 text-orange-400" />
                <CardTitle className="text-sm font-medium">Connections</CardTitle>
              </div>
              {getTrendIcon(getTrend(historicalData.connections))}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{metrics.connections_active}</span>
                <Badge variant="outline" className="text-xs">
                  Max: {metrics.connections_max}
                </Badge>
              </div>
              <Progress value={(metrics.connections_active / metrics.connections_max) * 100} className="h-2" />
              <MiniChart data={historicalData.connections} color="#f97316" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Query Performance */}
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              Query Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-neutral-400">Queries/Second</div>
                <div className="text-2xl font-bold">{metrics.queries_per_second}</div>
              </div>
              <div>
                <div className="text-sm text-neutral-400">Slow Queries</div>
                <div className="text-2xl font-bold text-yellow-400">{metrics.slow_queries_count}</div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Query Throughput (24h)</span>
              </div>
              <MiniChart data={historicalData.qps} color="#eab308" />
            </div>
          </CardContent>
        </Card>

        {/* System Health */}
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-400" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">CPU Health</span>
                <Badge variant={cpuHealth.status === 'healthy' ? 'default' : 'destructive'} className="text-xs">
                  {cpuHealth.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Memory Health</span>
                <Badge variant={memoryHealth.status === 'healthy' ? 'default' : 'destructive'} className="text-xs">
                  {memoryHealth.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Storage Health</span>
                <Badge variant={storageHealth.status === 'healthy' ? 'default' : 'destructive'} className="text-xs">
                  {storageHealth.status}
                </Badge>
              </div>
              {metrics.replication_lag_ms !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">Replication Lag</span>
                  <span className="text-sm font-mono">
                    {metrics.replication_lag_ms}ms
                  </span>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-neutral-800">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-neutral-400" />
                <span className="text-neutral-400">Last metric update:</span>
                <span>{new Date(metrics.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts Section */}
      {(cpuHealth.status !== 'healthy' || memoryHealth.status !== 'healthy' || storageHealth.status !== 'healthy') && (
        <Card className="bg-yellow-500/10 border-yellow-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-400">
              <AlertTriangle className="w-5 h-5" />
              Performance Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {cpuHealth.status !== 'healthy' && (
                <div className="text-sm text-yellow-400">
                  ⚠️ High CPU usage detected ({metrics.cpu_usage_percent.toFixed(1)}%)
                </div>
              )}
              {memoryHealth.status !== 'healthy' && (
                <div className="text-sm text-yellow-400">
                  ⚠️ High memory usage detected ({metrics.memory_usage_percent.toFixed(1)}%)
                </div>
              )}
              {storageHealth.status !== 'healthy' && (
                <div className="text-sm text-yellow-400">
                  ⚠️ Low storage space remaining ({(100 - metrics.storage_usage_percent).toFixed(1)}% free)
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}