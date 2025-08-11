'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ArrowLeft, FileText, Plus, Server, Trash2, Upload, Zap } from 'lucide-react'

export default function NewDeploymentPage() {
  const [selectedType, setSelectedType] = useState('nodejs')
  const [projectName, setProjectName] = useState('')
  const [envVars, setEnvVars] = useState([{ key: 'NODE_ENV', value: 'production' }])
  const [files, setFiles] = useState<File[]>([])

  const projectTypes = [
    { id: 'nodejs', name: 'Node.js', icon: '📦', description: 'JavaScript/TypeScript applications' },
    { id: 'manifest', name: 'Manifest', icon: '🎯', description: 'Container-based deployments' },
    { id: 'python', name: 'Python', icon: '🐍', description: 'Python applications' },
    { id: 'static', name: 'Static', icon: '🌐', description: 'HTML, CSS, JS websites' }
  ]

  const addEnvVar = () => {
    setEnvVars([...envVars, { key: '', value: '' }])
  }

  const removeEnvVar = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index))
  }

  const updateEnvVar = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...envVars]
    updated[index][field] = value
    setEnvVars(updated)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files))
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files) {
      setFiles(Array.from(e.dataTransfer.files))
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDeploy = () => {
    console.log('Deploying:', { selectedType, projectName, envVars, files })
    // Handle deployment logic
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-neutral-800 p-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" className="hover:bg-neutral-800">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Create New Deployment</h1>
            <p className="text-neutral-400 mt-1">Deploy your application in seconds</p>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-6 space-y-8">
        {/* Project Type Selection */}
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader>
            <CardTitle>Project Type</CardTitle>
            <p className="text-neutral-400">Choose the type of application you want to deploy</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {projectTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type.id)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    selectedType === type.id
                      ? 'border-orange-500 bg-orange-500/10'
                      : 'border-neutral-700 hover:border-neutral-600'
                  }`}
                >
                  <div className="text-2xl mb-2">{type.icon}</div>
                  <h3 className="font-semibold mb-1">{type.name}</h3>
                  <p className="text-sm text-neutral-400">{type.description}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Project Name */}
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader>
            <CardTitle>Project Name</CardTitle>
            <p className="text-neutral-400">Choose a unique name for your deployment</p>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="my-awesome-project"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="bg-neutral-800 border-neutral-700 focus:border-orange-500 font-mono"
            />
            <p className="text-sm text-neutral-400 mt-2">
              Your app will be available at: <span className="text-orange-400 font-mono">https://{projectName || 'your-project'}.coderunner.io</span>
            </p>
          </CardContent>
        </Card>

        {/* File Upload */}
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader>
            <CardTitle>Upload Files</CardTitle>
            <p className="text-neutral-400">Upload your project files or drag and drop them here</p>
          </CardHeader>
          <CardContent>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="border-2 border-dashed border-neutral-700 rounded-lg p-8 text-center hover:border-neutral-600 transition-colors"
            >
              <Upload className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
              <p className="text-lg mb-2">Drag files here or browse</p>
              <p className="text-neutral-400 mb-4">Supports ZIP, TAR.GZ, or individual files</p>
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <Button
                variant="outline"
                className="border-neutral-700 hover:bg-neutral-800"
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                <FileText className="w-4 h-4 mr-2" />
                Browse Files
              </Button>
            </div>

            {files.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium mb-2">Uploaded Files ({files.length})</h4>
                <div className="space-y-2">
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-neutral-800 rounded">
                      <span className="font-mono text-sm">{file.name}</span>
                      <span className="text-neutral-400 text-sm">{(file.size / 1024).toFixed(1)} KB</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Environment Variables */}
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader>
            <CardTitle>Environment Variables</CardTitle>
            <p className="text-neutral-400">Configure environment variables for your application</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {envVars.map((envVar, index) => (
                <div key={index} className="flex gap-3">
                  <Input
                    placeholder="KEY"
                    value={envVar.key}
                    onChange={(e) => updateEnvVar(index, 'key', e.target.value)}
                    className="bg-neutral-800 border-neutral-700 focus:border-orange-500 font-mono"
                  />
                  <Input
                    placeholder="VALUE"
                    value={envVar.value}
                    onChange={(e) => updateEnvVar(index, 'value', e.target.value)}
                    className="bg-neutral-800 border-neutral-700 focus:border-orange-500 font-mono flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeEnvVar(index)}
                    className="border-red-700 text-red-400 hover:bg-red-900/20"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                onClick={addEnvVar}
                className="border-neutral-700 hover:bg-neutral-800"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Variable
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Deploy Button */}
        <div className="flex justify-end gap-4">
          <Button variant="outline" className="border-neutral-700 hover:bg-neutral-800">
            Cancel
          </Button>
          <Button
            onClick={handleDeploy}
            className="bg-orange-500 hover:bg-orange-600 text-black font-medium"
            disabled={!projectName || files.length === 0}
          >
            <Zap className="w-4 h-4 mr-2" />
            Deploy Now
          </Button>
        </div>
      </div>
    </div>
  )
}
