'use client'

import { useRouter } from 'next/navigation'
import DeploymentForm from '@/components/databases/DeploymentForm'
import { Database, FileText, Users, Zap } from 'lucide-react'

export default function DatabaseDeployPage() {
  const router = useRouter()

  const handleBack = () => {
    router.push('/databases')
  }

  const handleSuccess = () => {
    router.push('/databases')
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
      <div className="ml-64 p-6">
        <DeploymentForm onBack={handleBack} onSuccess={handleSuccess} />
      </div>
    </div>
  )
}