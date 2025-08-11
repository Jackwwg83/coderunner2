'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Database, FileText, MoreVertical, Plus, Search, Settings, Users, Zap } from 'lucide-react'

export default function ProjectsPage() {
  const [searchQuery, setSearchQuery] = useState('')

  const projects = [
    {
      id: 1,
      name: 'E-commerce API',
      description: 'RESTful API for online store with payment integration',
      deployments: 3,
      databases: 2,
      members: 4,
      status: 'active',
      lastActivity: '2 hours ago',
      tech: ['Node.js', 'PostgreSQL', 'Redis']
    },
    {
      id: 2,
      name: 'Blog Platform',
      description: 'Modern blog platform with CMS capabilities',
      deployments: 1,
      databases: 1,
      members: 1,
      status: 'active',
      lastActivity: '1 day ago',
      tech: ['Next.js', 'MongoDB']
    },
    {
      id: 3,
      name: 'Analytics Dashboard',
      description: 'Real-time analytics and reporting dashboard',
      deployments: 2,
      databases: 1,
      members: 3,
      status: 'inactive',
      lastActivity: '1 week ago',
      tech: ['React', 'InfluxDB', 'Python']
    },
    {
      id: 4,
      name: 'Mobile App Backend',
      description: 'Backend services for iOS and Android applications',
      deployments: 4,
      databases: 3,
      members: 6,
      status: 'active',
      lastActivity: '30 minutes ago',
      tech: ['Go', 'PostgreSQL', 'Redis', 'Docker']
    }
  ]

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-64 bg-neutral-900 border-r border-neutral-800">
        <div className="p-4">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-black" />
            </div>
            <span className="font-bold text-xl">CodeRunner</span>
          </div>
          
          <nav className="space-y-2">
            <a href="/" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-neutral-800 transition-colors">
              <Database className="w-5 h-5" />
              <span>Deployments</span>
            </a>
            <a href="/projects" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-orange-500/20 text-orange-400">
              <FileText className="w-5 h-5" />
              <span>Projects</span>
            </a>
            <a href="/databases" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-neutral-800 transition-colors">
              <Database className="w-5 h-5" />
              <span>Databases</span>
            </a>
            <a href="/team" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-neutral-800 transition-colors">
              <Users className="w-5 h-5" />
              <span>Team</span>
            </a>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-64">
        {/* Header */}
        <header className="border-b border-neutral-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Projects</h1>
              <p className="text-neutral-400 mt-1">Organize and manage your applications</p>
            </div>
            <Button className="bg-orange-500 hover:bg-orange-600 text-black font-medium">
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </div>
        </header>

        <div className="p-6">
          {/* Search */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <Input
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-neutral-900 border-neutral-700 focus:border-orange-500"
              />
            </div>
          </div>

          {/* Projects Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredProjects.map((project) => (
              <Card key={project.id} className="bg-neutral-900 border-neutral-800 hover:border-neutral-700 transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <CardTitle className="text-xl">{project.name}</CardTitle>
                        <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                          {project.status}
                        </Badge>
                      </div>
                      <p className="text-neutral-400 text-sm">{project.description}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-blue-400">{project.deployments}</p>
                      <p className="text-xs text-neutral-400">Deployments</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-400">{project.databases}</p>
                      <p className="text-xs text-neutral-400">Databases</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-purple-400">{project.members}</p>
                      <p className="text-xs text-neutral-400">Members</p>
                    </div>
                  </div>

                  {/* Tech Stack */}
                  <div>
                    <p className="text-sm text-neutral-400 mb-2">Tech Stack</p>
                    <div className="flex flex-wrap gap-2">
                      {project.tech.map((tech, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {tech}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Last Activity */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-400">Last activity: {project.lastActivity}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" className="flex-1 bg-orange-500 hover:bg-orange-600 text-black">
                      Manage
                    </Button>
                    <Button size="sm" variant="outline" className="border-neutral-700 hover:bg-neutral-800">
                      <Settings className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredProjects.length === 0 && (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No projects found</h3>
              <p className="text-neutral-400 mb-4">
                {searchQuery ? 'Try adjusting your search terms' : 'Create your first project to get started'}
              </p>
              <Button className="bg-orange-500 hover:bg-orange-600 text-black">
                <Plus className="w-4 h-4 mr-2" />
                New Project
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
