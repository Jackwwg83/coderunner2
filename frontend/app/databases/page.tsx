'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Database, FileText, Plus, Users, Zap } from 'lucide-react'
import DatabaseList from '@/components/databases/DatabaseList'
import DatabaseDetails from '@/components/databases/DatabaseDetails'
import DeploymentForm from '@/components/databases/DeploymentForm'
import { DatabaseDeployment } from '@/lib/store/databaseStore'

export default function DatabasesPage() {
  const [currentView, setCurrentView] = useState<'list' | 'details' | 'deploy'>('list')
  const [selectedDeployment, setSelectedDeployment] = useState<DatabaseDeployment | null>(null)

  const handleSelectDeployment = (deployment: DatabaseDeployment) => {
    setSelectedDeployment(deployment)
    setCurrentView('details')
  }

  const handleBackToList = () => {
    setCurrentView('list')
    setSelectedDeployment(null)
  }

  const handleShowDeployForm = () => {
    setCurrentView('deploy')
  }

  const handleDeploySuccess = () => {
    setCurrentView('list')
  }


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
            <a href="/projects" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-neutral-800 transition-colors">
              <FileText className="w-5 h-5" />
              <span>Projects</span>
            </a>
            <a href="/databases" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-orange-500/20 text-orange-400">
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
        {/* Dynamic Header */}
        {currentView === 'list' && (
          <header className="border-b border-neutral-800 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">Databases</h1>
                <p className="text-neutral-400 mt-1">Manage your database instances</p>
              </div>
              <Button 
                onClick={handleShowDeployForm}
                className="bg-orange-500 hover:bg-orange-600 text-black font-medium"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Database
              </Button>
            </div>
          </header>
        )}

        <div className="p-6">
          {/* Dynamic Content */}
          {currentView === 'list' && (
            <DatabaseList onSelect={handleSelectDeployment} />
          )}
          
          {currentView === 'details' && selectedDeployment && (
            <DatabaseDetails 
              deployment={selectedDeployment} 
              onBack={handleBackToList}
            />
          )}
          
          {currentView === 'deploy' && (
            <DeploymentForm 
              onBack={handleBackToList} 
              onSuccess={handleDeploySuccess}
            />
          )}
        </div>
      </div>
    </div>
  )
}
