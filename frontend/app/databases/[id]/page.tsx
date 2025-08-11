'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import DatabaseDetails from '@/components/databases/DatabaseDetails'
import { useDatabaseStore, DatabaseDeployment } from '@/lib/store/databaseStore'
import { Loader2, AlertCircle } from 'lucide-react'

export default function DatabaseDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { deployments, fetchDeployments, loading, error } = useDatabaseStore()
  const [deployment, setDeployment] = useState<DatabaseDeployment | null>(null)

  useEffect(() => {
    // Fetch deployments if not already loaded
    if (deployments.length === 0) {
      fetchDeployments()
    }
  }, [deployments.length, fetchDeployments])

  useEffect(() => {
    // Find the specific deployment
    if (deployments.length > 0 && params.id) {
      const found = deployments.find(d => d.id === params.id)
      setDeployment(found || null)
    }
  }, [deployments, params.id])

  const handleBack = () => {
    router.push('/databases')
  }

  if (loading && !deployment) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-orange-500 animate-spin mx-auto mb-4" />
          <p className="text-neutral-400">Loading database details...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-red-400 mb-2">Failed to load database</h3>
          <p className="text-neutral-400 mb-4">{error}</p>
          <button 
            onClick={handleBack}
            className="bg-orange-500 hover:bg-orange-600 text-black px-4 py-2 rounded-md font-medium"
          >
            Back to Databases
          </button>
        </div>
      </div>
    )
  }

  if (!deployment) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Database Not Found</h3>
          <p className="text-neutral-400 mb-4">
            The database with ID "{params.id}" could not be found.
          </p>
          <button 
            onClick={handleBack}
            className="bg-orange-500 hover:bg-orange-600 text-black px-4 py-2 rounded-md font-medium"
          >
            Back to Databases
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-64 bg-neutral-900 border-r border-neutral-800">
        <div className="p-4">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <span className="text-black font-bold">CR</span>
            </div>
            <span className="font-bold text-xl">CodeRunner</span>
          </div>
          
          <nav className="space-y-2">
            <a href="/" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-neutral-800 transition-colors">
              <span>Deployments</span>
            </a>
            <a href="/projects" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-neutral-800 transition-colors">
              <span>Projects</span>
            </a>
            <a href="/databases" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-orange-500/20 text-orange-400">
              <span>Databases</span>
            </a>
            <a href="/team" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-neutral-800 transition-colors">
              <span>Team</span>
            </a>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-64 p-6">
        <DatabaseDetails deployment={deployment} onBack={handleBack} />
      </div>
    </div>
  )
}