'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { 
  Plus, 
  Users, 
  Trash2, 
  Database, 
  Settings,
  AlertCircle,
  CheckCircle,
  Loader2,
  Shield,
  HardDrive,
  Cpu,
  Network
} from 'lucide-react'
import { useDatabaseStore, DatabaseTenant, TenantConfig } from '@/lib/store/databaseStore'

interface TenantManagerProps {
  deploymentId: string
  tenants: DatabaseTenant[]
}

export default function TenantManager({ deploymentId, tenants }: TenantManagerProps) {
  const { createTenant, deleteTenant, loading, error } = useDatabaseStore()
  
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState<Partial<TenantConfig>>({
    tenant_id: '',
    isolation_type: 'schema',
    resource_limits: {
      max_connections: 10,
      storage_quota_mb: 100,
      cpu_quota_percent: 10
    }
  })
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleInputChange = (field: string, value: any) => {
    if (field.startsWith('resource_limits.')) {
      const resourceField = field.split('.')[1]
      setFormData(prev => ({
        ...prev,
        resource_limits: {
          ...prev.resource_limits!,
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

  const handleCreateTenant = async () => {
    if (!formData.tenant_id) return

    try {
      await createTenant(deploymentId, formData as TenantConfig)
      setIsDialogOpen(false)
      setFormData({
        tenant_id: '',
        isolation_type: 'schema',
        resource_limits: {
          max_connections: 10,
          storage_quota_mb: 100,
          cpu_quota_percent: 10
        }
      })
    } catch (error) {
      // Error is handled in the store
    }
  }

  const handleDeleteTenant = async (tenantId: string) => {
    if (!confirm('Are you sure you want to delete this tenant? This action cannot be undone.')) {
      return
    }

    setDeletingId(tenantId)
    try {
      await deleteTenant(deploymentId, tenantId)
    } finally {
      setDeletingId(null)
    }
  }

  const getStatusColor = (status: DatabaseTenant['status']) => {
    switch (status) {
      case 'active': return 'text-green-400'
      case 'suspended': return 'text-yellow-400'
      case 'migrating': return 'text-blue-400'
      case 'deleting': return 'text-red-400'
      default: return 'text-gray-400'
    }
  }

  const getStatusIcon = (status: DatabaseTenant['status']) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-4 h-4" />
      case 'suspended': return <AlertCircle className="w-4 h-4" />
      case 'migrating': return <Loader2 className="w-4 h-4 animate-spin" />
      case 'deleting': return <Loader2 className="w-4 h-4 animate-spin" />
      default: return <AlertCircle className="w-4 h-4" />
    }
  }

  const getIsolationIcon = (type: DatabaseTenant['isolation_type']) => {
    switch (type) {
      case 'database': return <Database className="w-4 h-4 text-blue-400" />
      case 'schema': return <Shield className="w-4 h-4 text-green-400" />
      case 'row': return <Users className="w-4 h-4 text-yellow-400" />
      default: return <Database className="w-4 h-4" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Tenant Management</h2>
          <p className="text-sm text-neutral-400 mt-1">
            Manage database tenants and resource isolation
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-orange-500 hover:bg-orange-600 text-black">
              <Plus className="w-4 h-4 mr-2" />
              Create Tenant
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] bg-neutral-900 border-neutral-800">
            <DialogHeader>
              <DialogTitle>Create New Tenant</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tenant_id">Tenant ID *</Label>
                  <Input
                    id="tenant_id"
                    placeholder="tenant-001"
                    value={formData.tenant_id}
                    onChange={(e) => handleInputChange('tenant_id', e.target.value)}
                    className="bg-neutral-800 border-neutral-700"
                  />
                </div>
                <div>
                  <Label htmlFor="isolation_type">Isolation Type</Label>
                  <Select 
                    value={formData.isolation_type} 
                    onValueChange={(value) => handleInputChange('isolation_type', value)}
                  >
                    <SelectTrigger className="bg-neutral-800 border-neutral-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="schema">Schema Level</SelectItem>
                      <SelectItem value="database">Database Level</SelectItem>
                      <SelectItem value="row">Row Level</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.isolation_type === 'schema' && (
                <div>
                  <Label htmlFor="schema_name">Schema Name (optional)</Label>
                  <Input
                    id="schema_name"
                    placeholder="tenant_001_schema"
                    value={formData.schema_name || ''}
                    onChange={(e) => handleInputChange('schema_name', e.target.value)}
                    className="bg-neutral-800 border-neutral-700"
                  />
                </div>
              )}

              {formData.isolation_type === 'database' && (
                <div>
                  <Label htmlFor="database_name">Database Name (optional)</Label>
                  <Input
                    id="database_name"
                    placeholder="tenant_001_db"
                    value={formData.database_name || ''}
                    onChange={(e) => handleInputChange('database_name', e.target.value)}
                    className="bg-neutral-800 border-neutral-700"
                  />
                </div>
              )}

              <div className="space-y-4">
                <h4 className="font-medium">Resource Limits</h4>
                
                <div>
                  <Label>Max Connections: {formData.resource_limits?.max_connections}</Label>
                  <div className="flex items-center gap-4 mt-2">
                    <Input
                      type="range"
                      min="1"
                      max="100"
                      value={formData.resource_limits?.max_connections}
                      onChange={(e) => handleInputChange('resource_limits.max_connections', parseInt(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-sm text-neutral-400 w-12 text-right">
                      {formData.resource_limits?.max_connections}
                    </span>
                  </div>
                </div>

                <div>
                  <Label>Storage Quota: {formData.resource_limits?.storage_quota_mb}MB</Label>
                  <div className="flex items-center gap-4 mt-2">
                    <Input
                      type="range"
                      min="50"
                      max="10240"
                      step="50"
                      value={formData.resource_limits?.storage_quota_mb}
                      onChange={(e) => handleInputChange('resource_limits.storage_quota_mb', parseInt(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-sm text-neutral-400 w-16 text-right">
                      {formData.resource_limits?.storage_quota_mb}MB
                    </span>
                  </div>
                </div>

                <div>
                  <Label>CPU Quota: {formData.resource_limits?.cpu_quota_percent}%</Label>
                  <div className="flex items-center gap-4 mt-2">
                    <Input
                      type="range"
                      min="5"
                      max="100"
                      step="5"
                      value={formData.resource_limits?.cpu_quota_percent}
                      onChange={(e) => handleInputChange('resource_limits.cpu_quota_percent', parseInt(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-sm text-neutral-400 w-12 text-right">
                      {formData.resource_limits?.cpu_quota_percent}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  className="border-neutral-700"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateTenant}
                  disabled={!formData.tenant_id || loading}
                  className="bg-orange-500 hover:bg-orange-600 text-black"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Tenant'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="bg-red-500/10 border-red-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-red-400">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tenants List */}
      {tenants.length === 0 ? (
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Tenants Yet</h3>
              <p className="text-neutral-400 mb-4">
                Create your first tenant to start isolating database access
              </p>
              <Button
                onClick={() => setIsDialogOpen(true)}
                className="bg-orange-500 hover:bg-orange-600 text-black"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create First Tenant
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {tenants.map((tenant) => (
            <Card key={tenant.id} className="bg-neutral-900 border-neutral-800">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {getIsolationIcon(tenant.isolation_type)}
                    <div>
                      <CardTitle className="text-lg font-mono">{tenant.tenant_id}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <div className={getStatusColor(tenant.status)}>
                          {getStatusIcon(tenant.status)}
                        </div>
                        <span className="text-sm text-neutral-400 capitalize">
                          {tenant.isolation_type} isolation
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {tenant.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0"
                      disabled={tenant.status !== 'active'}
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0"
                      onClick={() => handleDeleteTenant(tenant.id)}
                      disabled={deletingId === tenant.id}
                    >
                      {deletingId === tenant.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4 text-red-400" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Database/Schema Info */}
                {tenant.schema_name && (
                  <div>
                    <p className="text-sm text-neutral-400">Schema</p>
                    <p className="font-mono text-sm">{tenant.schema_name}</p>
                  </div>
                )}
                
                {tenant.database_name && (
                  <div>
                    <p className="text-sm text-neutral-400">Database</p>
                    <p className="font-mono text-sm">{tenant.database_name}</p>
                  </div>
                )}

                {/* Resource Limits */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Network className="w-4 h-4 text-blue-400" />
                    <div className="flex-1">
                      <div className="flex justify-between text-sm">
                        <span>Connections</span>
                        <span>Max {tenant.resource_limits.max_connections}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <HardDrive className="w-4 h-4 text-green-400" />
                    <div className="flex-1">
                      <div className="flex justify-between text-sm">
                        <span>Storage Quota</span>
                        <span>{tenant.resource_limits.storage_quota_mb}MB</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Cpu className="w-4 h-4 text-purple-400" />
                    <div className="flex-1">
                      <div className="flex justify-between text-sm">
                        <span>CPU Quota</span>
                        <span>{tenant.resource_limits.cpu_quota_percent}%</span>
                      </div>
                      <Progress value={tenant.resource_limits.cpu_quota_percent} className="h-1 mt-1" />
                    </div>
                  </div>
                </div>

                {/* Created Date */}
                <div className="flex items-center justify-between text-sm pt-2 border-t border-neutral-800">
                  <span className="text-neutral-400">
                    Created: {new Date(tenant.created_at).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}