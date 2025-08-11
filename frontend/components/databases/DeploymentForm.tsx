'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { 
  ArrowLeft, 
  Database, 
  Server, 
  Globe, 
  Settings, 
  ChevronRight,
  Check,
  Loader2,
  AlertCircle,
  Code2,
  FileText
} from 'lucide-react'
import { useDatabaseStore, DatabaseTemplate, DeploymentConfig } from '@/lib/store/databaseStore'
import DeploymentEditor from './DeploymentEditor'
import { FileContent } from '@/components/editor'

interface DeploymentFormProps {
  onBack: () => void
  onSuccess: () => void
}

export default function DeploymentForm({ onBack, onSuccess }: DeploymentFormProps) {
  const { 
    templates, 
    loading, 
    error,
    fetchTemplates, 
    deployDatabase,
    clearError 
  } = useDatabaseStore()

  const [step, setStep] = useState(1) // 1: Template, 2: Configuration, 3: Files, 4: Review
  const [selectedTemplate, setSelectedTemplate] = useState<DatabaseTemplate | null>(null)
  const [formData, setFormData] = useState<Partial<DeploymentConfig>>({
    name: '',
    environment: 'development',
    region: 'us-east-1',
    resources: {
      cpu_cores: 1,
      memory_mb: 1024,
      storage_gb: 10
    },
    configuration: {}
  })
  const [deploymentFiles, setDeploymentFiles] = useState<FileContent[]>([])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const handleTemplateSelect = (template: DatabaseTemplate) => {
    setSelectedTemplate(template)
    setFormData(prev => ({
      ...prev,
      templateId: template.id
    }))
  }

  const handleInputChange = (field: string, value: any) => {
    if (field.startsWith('resources.')) {
      const resourceField = field.split('.')[1]
      setFormData(prev => ({
        ...prev,
        resources: {
          ...prev.resources!,
          [resourceField]: value
        }
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }))
    }
  }

  const handleDeploy = async () => {
    if (!selectedTemplate || !formData.name) return

    try {
      await deployDatabase(formData as DeploymentConfig)
      onSuccess()
    } catch (error) {
      // Error is handled in the store
    }
  }

  const getTemplateIcon = (type: string) => {
    switch (type) {
      case 'postgresql': return '🐘'
      case 'mysql': return '🐬'
      case 'mongodb': return '🍃'
      case 'redis': return '🔴'
      case 'influxdb': return '📊'
      default: return '💾'
    }
  }

  const getResourceCost = () => {
    const { cpu_cores, memory_mb, storage_gb } = formData.resources || { cpu_cores: 1, memory_mb: 1024, storage_gb: 10 }
    // Simple cost calculation (example)
    return (cpu_cores * 10 + memory_mb * 0.01 + storage_gb * 0.1).toFixed(2)
  }

  const regions = [
    { value: 'us-east-1', label: 'US East (N. Virginia)' },
    { value: 'us-west-2', label: 'US West (Oregon)' },
    { value: 'eu-west-1', label: 'Europe (Ireland)' },
    { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' }
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="hover:bg-neutral-800"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">Deploy New Database</h1>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
            step >= 1 ? 'bg-orange-500 text-black' : 'bg-neutral-800 text-neutral-400'
          }`}>
            {step > 1 ? <Check className="w-4 h-4" /> : '1'}
            <span>Template</span>
          </div>
          <ChevronRight className="w-4 h-4 text-neutral-400" />
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
            step >= 2 ? 'bg-orange-500 text-black' : 'bg-neutral-800 text-neutral-400'
          }`}>
            {step > 2 ? <Check className="w-4 h-4" /> : '2'}
            <span>Configure</span>
          </div>
          <ChevronRight className="w-4 h-4 text-neutral-400" />
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
            step >= 3 ? 'bg-orange-500 text-black' : 'bg-neutral-800 text-neutral-400'
          }`}>
            {step > 3 ? <Check className="w-4 h-4" /> : '3'}
            <span>Files</span>
          </div>
          <ChevronRight className="w-4 h-4 text-neutral-400" />
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
            step >= 4 ? 'bg-orange-500 text-black' : 'bg-neutral-800 text-neutral-400'
          }`}>
            {step > 4 ? <Check className="w-4 h-4" /> : '4'}
            <span>Review</span>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="bg-red-500/10 border-red-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-red-400">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearError}
                className="ml-auto"
              >
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Template Selection */}
      {step === 1 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Choose Database Template</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
              <Card
                key={template.id}
                className={`cursor-pointer transition-all duration-200 ${
                  selectedTemplate?.id === template.id
                    ? 'ring-2 ring-orange-500 bg-orange-500/5 border-orange-500/50'
                    : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700'
                }`}
                onClick={() => handleTemplateSelect(template)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getTemplateIcon(template.type)}</span>
                      <div>
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <Badge variant="secondary" className="text-xs mt-1">
                          {template.version}
                        </Badge>
                      </div>
                    </div>
                    {selectedTemplate?.id === template.id && (
                      <Check className="w-5 h-5 text-orange-500" />
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-neutral-400 mb-3">
                    {template.description}
                  </p>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-neutral-500">Type: {template.type}</span>
                    <Badge variant="outline" className="text-xs">
                      {template.environment}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex justify-end mt-6">
            <Button
              onClick={() => setStep(2)}
              disabled={!selectedTemplate}
              className="bg-orange-500 hover:bg-orange-600 text-black"
            >
              Continue
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Configuration */}
      {step === 2 && selectedTemplate && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-neutral-900 border-neutral-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Basic Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="name">Database Name *</Label>
                  <Input
                    id="name"
                    placeholder="my-database"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="bg-neutral-800 border-neutral-700 focus:border-orange-500"
                  />
                </div>

                <div>
                  <Label htmlFor="environment">Environment</Label>
                  <Select value={formData.environment} onValueChange={(value) => handleInputChange('environment', value)}>
                    <SelectTrigger className="bg-neutral-800 border-neutral-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="development">Development</SelectItem>
                      <SelectItem value="staging">Staging</SelectItem>
                      <SelectItem value="production">Production</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="region">Region</Label>
                  <Select value={formData.region} onValueChange={(value) => handleInputChange('region', value)}>
                    <SelectTrigger className="bg-neutral-800 border-neutral-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {regions.map((region) => (
                        <SelectItem key={region.value} value={region.value}>
                          {region.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-neutral-900 border-neutral-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="w-5 h-5" />
                  Resource Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label>CPU Cores: {formData.resources?.cpu_cores}</Label>
                  <Slider
                    value={[formData.resources?.cpu_cores || 1]}
                    onValueChange={(value) => handleInputChange('resources.cpu_cores', value[0])}
                    max={16}
                    min={1}
                    step={1}
                    className="mt-2"
                  />
                  <div className="flex justify-between text-xs text-neutral-400 mt-1">
                    <span>1 core</span>
                    <span>16 cores</span>
                  </div>
                </div>

                <div>
                  <Label>Memory: {(formData.resources?.memory_mb || 1024) / 1024}GB</Label>
                  <Slider
                    value={[formData.resources?.memory_mb || 1024]}
                    onValueChange={(value) => handleInputChange('resources.memory_mb', value[0])}
                    max={32768}
                    min={512}
                    step={512}
                    className="mt-2"
                  />
                  <div className="flex justify-between text-xs text-neutral-400 mt-1">
                    <span>0.5GB</span>
                    <span>32GB</span>
                  </div>
                </div>

                <div>
                  <Label>Storage: {formData.resources?.storage_gb}GB</Label>
                  <Slider
                    value={[formData.resources?.storage_gb || 10]}
                    onValueChange={(value) => handleInputChange('resources.storage_gb', value[0])}
                    max={1000}
                    min={5}
                    step={5}
                    className="mt-2"
                  />
                  <div className="flex justify-between text-xs text-neutral-400 mt-1">
                    <span>5GB</span>
                    <span>1TB</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Summary Sidebar */}
          <div>
            <Card className="bg-neutral-900 border-neutral-800 sticky top-4">
              <CardHeader>
                <CardTitle className="text-lg">Deployment Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-neutral-800">
                  <span className="text-2xl">{getTemplateIcon(selectedTemplate.type)}</span>
                  <div>
                    <div className="font-medium">{selectedTemplate.name}</div>
                    <div className="text-sm text-neutral-400">{selectedTemplate.version}</div>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Name:</span>
                    <span>{formData.name || 'Not set'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Environment:</span>
                    <Badge variant="outline" className="text-xs">{formData.environment}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Region:</span>
                    <span>{formData.region}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-neutral-800">
                  <div className="text-sm font-medium mb-2">Resources</div>
                  <div className="space-y-1 text-sm text-neutral-400">
                    <div className="flex justify-between">
                      <span>CPU:</span>
                      <span>{formData.resources?.cpu_cores} cores</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Memory:</span>
                      <span>{(formData.resources?.memory_mb || 0) / 1024}GB</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Storage:</span>
                      <span>{formData.resources?.storage_gb}GB</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-neutral-800">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Estimated Cost:</span>
                    <span className="text-lg font-bold text-orange-400">${getResourceCost()}/mo</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3 flex justify-between">
            <Button
              variant="outline"
              onClick={() => setStep(1)}
              className="border-neutral-700"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button
              onClick={() => setStep(3)}
              disabled={!formData.name}
              className="bg-orange-500 hover:bg-orange-600 text-black"
            >
              Configure Files
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Files Configuration */}
      {step === 3 && selectedTemplate && (
        <DeploymentEditor
          template={{
            id: selectedTemplate.id,
            name: selectedTemplate.name,
            type: selectedTemplate.type,
            version: selectedTemplate.version
          }}
          onFilesChange={setDeploymentFiles}
          onBack={() => setStep(2)}
          onNext={() => setStep(4)}
        />
      )}

      {/* Step 4: Review & Deploy */}
      {step === 4 && selectedTemplate && (
        <div className="max-w-2xl mx-auto">
          <Card className="bg-neutral-900 border-neutral-800">
            <CardHeader>
              <CardTitle className="text-xl">Review Deployment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4 p-4 bg-neutral-800 rounded-lg">
                <span className="text-3xl">{getTemplateIcon(selectedTemplate.type)}</span>
                <div>
                  <div className="font-semibold text-lg">{formData.name}</div>
                  <div className="text-neutral-400">{selectedTemplate.name} v{selectedTemplate.version}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-neutral-400 mb-1">Environment</div>
                  <Badge>{formData.environment}</Badge>
                </div>
                <div>
                  <div className="text-sm text-neutral-400 mb-1">Region</div>
                  <div className="text-sm">{regions.find(r => r.value === formData.region)?.label}</div>
                </div>
              </div>

              <div>
                <div className="text-sm text-neutral-400 mb-2">Resource Configuration</div>
                <div className="bg-neutral-800 p-3 rounded-lg space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>CPU Cores:</span>
                    <span>{formData.resources?.cpu_cores}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Memory:</span>
                    <span>{(formData.resources?.memory_mb || 0) / 1024}GB</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Storage:</span>
                    <span>{formData.resources?.storage_gb}GB</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-sm text-neutral-400 mb-2">Deployment Files</div>
                <div className="bg-neutral-800 p-3 rounded-lg space-y-2 text-sm">
                  {deploymentFiles.length === 0 ? (
                    <div className="text-neutral-400">No files configured</div>
                  ) : (
                    deploymentFiles.map((file) => (
                      <div key={file.path} className="flex justify-between items-center">
                        <span className="flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          {file.path}
                        </span>
                        <span className="text-neutral-400">{file.language}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Estimated Monthly Cost</span>
                  <span className="text-xl font-bold text-orange-400">${getResourceCost()}</span>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setStep(3)}
                  className="flex-1 border-neutral-700"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={handleDeploy}
                  disabled={loading}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-black"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Deploying...
                    </>
                  ) : (
                    <>
                      <Database className="w-4 h-4 mr-2" />
                      Deploy Database
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}