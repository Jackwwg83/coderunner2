'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Activity, ChevronDown, Database, DockIcon as Deployment, Eye, FileText, MoreVertical, Play, Plus, Search, Server, Settings, Square, Trash2, Users, Zap } from 'lucide-react'
import { useDeploymentsStore } from '@/lib/stores/deployments.store'
import { useAuthStore } from '@/lib/stores/auth.store'
import { toast } from 'sonner'

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const router = useRouter()
  
  const { isAuthenticated, checkAuth, user } = useAuthStore()
  const { deployments, fetchDeployments, isLoading, error, controlDeployment } = useDeploymentsStore()
  
  useEffect(() => {
    checkAuth()
  }, [])
  
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth')
    } else {
      router.push('/deployments')
    }
  }, [isAuthenticated, router])
  
  useEffect(() => {
    if (error) {
      toast.error(error)
    }
  }, [error])

  const handleDeploymentControl = async (id: string, action: 'start' | 'stop' | 'restart') => {
    try {
      await controlDeployment(id, action)
      toast.success(`Deployment ${action}ed successfully`)
    } catch (error) {
      toast.error(`Failed to ${action} deployment`)
    }
  }

  const mockDeployments = [
    {
      id: 1,
      name: 'tactical-api',
      status: 'running',
      type: 'Node.js',
      url: 'https://tactical-api.coderunner.io',
      lastDeploy: '2 hours ago',
      cpu: 45,
      memory: 68
    },
    {
      id: 2,
      name: 'command-center',
      status: 'running',
      type: 'React',
      url: 'https://command-center.coderunner.io',
      lastDeploy: '5 hours ago',
      cpu: 23,
      memory: 34
    },
    {
      id: 3,
      name: 'data-processor',
      status: 'stopped',
      type: 'Python',
      url: 'https://data-processor.coderunner.io',
      lastDeploy: '1 day ago',
      cpu: 0,
      memory: 0
    },
    {
      id: 4,
      name: 'auth-service',
      status: 'deploying',
      type: 'Manifest',
      url: 'https://auth-service.coderunner.io',
      lastDeploy: 'deploying...',
      cpu: 78,
      memory: 45
    }
  ]

  const filteredDeployments = deployments.filter(d => 
    d.name?.toLowerCase().includes(searchQuery.toLowerCase())
  )
  
  const activeDeployments = deployments.filter(d => d.status === 'running').length
  const totalProjects = deployments.length
  
  const stats = [
    { label: 'Active Deployments', value: activeDeployments.toString(), icon: Server, color: 'text-green-400' },
    { label: 'Total Projects', value: totalProjects.toString(), icon: FileText, color: 'text-blue-400' },
    { label: 'Team Members', value: '4', icon: Users, color: 'text-purple-400' },
    { label: 'Databases', value: '2', icon: Database, color: 'text-orange-400' }
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-500'
      case 'stopped': return 'bg-red-500'
      case 'deploying': return 'bg-yellow-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'running': return 'Running'
      case 'stopped': return 'Stopped'
      case 'deploying': return 'Deploying'
      default: return 'Unknown'
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Sidebar */}
      <div className={`fixed left-0 top-0 h-full bg-neutral-900 border-r border-neutral-800 transition-all duration-300 ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>
        <div className="p-4">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-black" />
            </div>
            {!sidebarCollapsed && <span className="font-bold text-xl">CodeRunner</span>}
          </div>
          
          <nav className="space-y-2">
            <a href="/deployments" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-orange-500/20 text-orange-400">
              <Server className="w-5 h-5" />
              {!sidebarCollapsed && <span>Deployments</span>}
            </a>
            <a href="/projects" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-neutral-800 transition-colors">
              <FileText className="w-5 h-5" />
              {!sidebarCollapsed && <span>Projects</span>}
            </a>
            <a href="/databases" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-neutral-800 transition-colors">
              <Database className="w-5 h-5" />
              {!sidebarCollapsed && <span>Databases</span>}
            </a>
            <a href="/team" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-neutral-800 transition-colors">
              <Users className="w-5 h-5" />
              {!sidebarCollapsed && <span>Team</span>}
            </a>
            <a href="/billing" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-neutral-800 transition-colors">
              <Activity className="w-5 h-5" />
              {!sidebarCollapsed && <span>Billing</span>}
            </a>
            <a href="/settings" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-neutral-800 transition-colors">
              <Settings className="w-5 h-5" />
              {!sidebarCollapsed && <span>Settings</span>}
            </a>
          </nav>
        </div>
        
        <button 
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute bottom-4 left-4 p-2 rounded-lg hover:bg-neutral-800 transition-colors"
        >
          <ChevronDown className={`w-5 h-5 transition-transform ${sidebarCollapsed ? 'rotate-90' : '-rotate-90'}`} />
        </button>
      </div>

      {/* Main Content */}
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
        {/* Header */}
        <header className="border-b border-neutral-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Deployments</h1>
              <p className="text-neutral-400 mt-1">Manage your deployed applications</p>
            </div>
            <Button className="bg-orange-500 hover:bg-orange-600 text-black font-medium">
              <Plus className="w-4 h-4 mr-2" />
              New Deployment
            </Button>
          </div>
        </header>

        {/* Stats Cards */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {stats.map((stat, index) => (
              <Card key={index} className="bg-neutral-900 border-neutral-800">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-neutral-400 text-sm">{stat.label}</p>
                      <p className="text-2xl font-bold mt-1">{stat.value}</p>
                    </div>
                    <stat.icon className={`w-8 h-8 ${stat.color}`} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Search and Filter */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <Input
                placeholder="Search deployments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-neutral-900 border-neutral-700 focus:border-orange-500"
              />
            </div>
            <Button variant="outline" className="border-neutral-700 hover:bg-neutral-800">
              All Status <ChevronDown className="w-4 h-4 ml-2" />
            </Button>
          </div>

          {/* Deployments Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {deployments.map((deployment) => (
              <Card key={deployment.id} className="bg-neutral-900 border-neutral-800 hover:border-neutral-700 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-mono">{deployment.name}</CardTitle>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(deployment.status)}`} />
                    <span className="text-sm text-neutral-400">{getStatusText(deployment.status)}</span>
                    <Badge variant="secondary" className="text-xs">{deployment.type}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs text-neutral-400 mb-1">URL</p>
                    <p className="text-sm font-mono text-blue-400 truncate">{deployment.url}</p>
                  </div>
                  
                  <div>
                    <p className="text-xs text-neutral-400 mb-1">Last Deploy</p>
                    <p className="text-sm">{deployment.lastDeploy}</p>
                  </div>

                  {deployment.status === 'running' && (
                    <div className="space-y-2">
                      <div>
                        <div className="flex justify-between text-xs text-neutral-400 mb-1">
                          <span>CPU</span>
                          <span>{deployment.cpu}%</span>
                        </div>
                        <Progress value={deployment.cpu} className="h-1" />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs text-neutral-400 mb-1">
                          <span>Memory</span>
                          <span>{deployment.memory}%</span>
                        </div>
                        <Progress value={deployment.memory} className="h-1" />
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" className="flex-1 border-neutral-700 hover:bg-neutral-800">
                      <Eye className="w-3 h-3 mr-1" />
                      View
                    </Button>
                    {deployment.status === 'running' ? (
                      <Button size="sm" variant="outline" className="border-red-700 text-red-400 hover:bg-red-900/20">
                        <Square className="w-3 h-3" />
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="border-green-700 text-green-400 hover:bg-green-900/20">
                        <Play className="w-3 h-3" />
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="border-red-700 text-red-400 hover:bg-red-900/20">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
