'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { 
  Plus, 
  Archive, 
  Trash2, 
  Download, 
  RotateCcw,
  AlertCircle,
  CheckCircle,
  Loader2,
  Clock,
  HardDrive,
  Shield,
  Zap,
  Calendar
} from 'lucide-react'
import { useDatabaseStore, DatabaseBackup } from '@/lib/store/databaseStore'

interface BackupManagerProps {
  deploymentId: string
  backups: DatabaseBackup[]
}

export default function BackupManager({ deploymentId, backups }: BackupManagerProps) {
  const { createBackup, restoreBackup, deleteBackup, loading, error } = useDatabaseStore()
  
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [backupType, setBackupType] = useState<'full' | 'incremental'>('full')
  const [actionLoading, setActionLoading] = useState<{id: string, action: string} | null>(null)

  const handleCreateBackup = async () => {
    try {
      await createBackup(deploymentId, backupType)
      setIsDialogOpen(false)
    } catch (error) {
      // Error is handled in the store
    }
  }

  const handleRestoreBackup = async (backup: DatabaseBackup) => {
    if (!confirm(`Are you sure you want to restore from backup ${backup.backup_id}? This will overwrite current data.`)) {
      return
    }

    setActionLoading({ id: backup.id, action: 'restore' })
    try {
      await restoreBackup(deploymentId, backup.backup_id)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeleteBackup = async (backup: DatabaseBackup) => {
    if (!confirm(`Are you sure you want to delete backup ${backup.backup_id}? This action cannot be undone.`)) {
      return
    }

    setActionLoading({ id: backup.id, action: 'delete' })
    try {
      await deleteBackup(deploymentId, backup.backup_id)
    } finally {
      setActionLoading(null)
    }
  }

  const getStatusColor = (status: DatabaseBackup['status']) => {
    switch (status) {
      case 'completed': return 'text-green-400'
      case 'creating': return 'text-blue-400'
      case 'failed': return 'text-red-400'
      case 'restoring': return 'text-yellow-400'
      default: return 'text-gray-400'
    }
  }

  const getStatusIcon = (status: DatabaseBackup['status']) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />
      case 'creating': return <Loader2 className="w-4 h-4 animate-spin" />
      case 'failed': return <AlertCircle className="w-4 h-4" />
      case 'restoring': return <Loader2 className="w-4 h-4 animate-spin" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  const getTypeIcon = (type: DatabaseBackup['type']) => {
    switch (type) {
      case 'full': return <Archive className="w-4 h-4 text-blue-400" />
      case 'incremental': return <Zap className="w-4 h-4 text-green-400" />
      case 'differential': return <HardDrive className="w-4 h-4 text-purple-400" />
      default: return <Archive className="w-4 h-4" />
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const isExpiringSoon = (expiresAt: Date) => {
    const now = new Date()
    const timeUntilExpiry = new Date(expiresAt).getTime() - now.getTime()
    const daysUntilExpiry = timeUntilExpiry / (1000 * 60 * 60 * 24)
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0
  }

  const isExpired = (expiresAt: Date) => {
    return new Date(expiresAt) <= new Date()
  }

  const sortedBackups = [...backups].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  const completedBackups = sortedBackups.filter(b => b.status === 'completed' && !isExpired(b.expires_at))
  const activeBackups = sortedBackups.filter(b => b.status !== 'completed')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Backup Management</h2>
          <p className="text-sm text-neutral-400 mt-1">
            Create, manage, and restore database backups
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-orange-500 hover:bg-orange-600 text-black">
              <Plus className="w-4 h-4 mr-2" />
              Create Backup
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[400px] bg-neutral-900 border-neutral-800">
            <DialogHeader>
              <DialogTitle>Create New Backup</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Backup Type</label>
                <Select value={backupType} onValueChange={(value: 'full' | 'incremental') => setBackupType(value)}>
                  <SelectTrigger className="bg-neutral-800 border-neutral-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">
                      <div className="flex items-center gap-2">
                        <Archive className="w-4 h-4 text-blue-400" />
                        Full Backup
                      </div>
                    </SelectItem>
                    <SelectItem value="incremental">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-green-400" />
                        Incremental Backup
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="bg-neutral-800 p-3 rounded-lg text-sm">
                {backupType === 'full' ? (
                  <div>
                    <div className="font-medium mb-1">Full Backup</div>
                    <div className="text-neutral-400">
                      Complete snapshot of the entire database. Takes more time and storage but provides complete data recovery.
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="font-medium mb-1">Incremental Backup</div>
                    <div className="text-neutral-400">
                      Only backs up data changed since the last backup. Faster and uses less storage.
                    </div>
                  </div>
                )}
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
                  onClick={handleCreateBackup}
                  disabled={loading}
                  className="bg-orange-500 hover:bg-orange-600 text-black"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Archive className="w-4 h-4 mr-2" />
                      Create Backup
                    </>
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

      {/* Active Backups (in progress) */}
      {activeBackups.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-4">Active Operations</h3>
          <div className="space-y-3">
            {activeBackups.map((backup) => (
              <Card key={backup.id} className="bg-neutral-900 border-neutral-800">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getTypeIcon(backup.type)}
                      <div>
                        <div className="font-medium font-mono text-sm">{backup.backup_id}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className={getStatusColor(backup.status)}>
                            {getStatusIcon(backup.status)}
                          </div>
                          <span className="text-sm text-neutral-400 capitalize">
                            {backup.status} • {backup.type} backup
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-neutral-400">
                      Started: {new Date(backup.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                  {backup.status === 'creating' && (
                    <div className="mt-3">
                      <Progress value={65} className="h-2" />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Completed Backups */}
      {completedBackups.length === 0 && activeBackups.length === 0 ? (
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Archive className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Backups Yet</h3>
              <p className="text-neutral-400 mb-4">
                Create your first backup to protect your data
              </p>
              <Button
                onClick={() => setIsDialogOpen(true)}
                className="bg-orange-500 hover:bg-orange-600 text-black"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create First Backup
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div>
          <h3 className="text-lg font-medium mb-4">Available Backups</h3>
          <div className="space-y-4">
            {completedBackups.map((backup) => (
              <Card 
                key={backup.id} 
                className={`bg-neutral-900 transition-colors ${
                  isExpiringSoon(backup.expires_at) 
                    ? 'border-yellow-500/50' 
                    : 'border-neutral-800'
                }`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {getTypeIcon(backup.type)}
                      <div>
                        <CardTitle className="text-lg font-mono">{backup.backup_id}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <div className={getStatusColor(backup.status)}>
                            {getStatusIcon(backup.status)}
                          </div>
                          <Badge variant="secondary" className="text-xs capitalize">
                            {backup.type}
                          </Badge>
                          {backup.encryption_enabled && (
                            <Badge variant="outline" className="text-xs">
                              <Shield className="w-3 h-3 mr-1" />
                              Encrypted
                            </Badge>
                          )}
                          {backup.compression !== 'none' && (
                            <Badge variant="outline" className="text-xs capitalize">
                              {backup.compression}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0"
                        onClick={() => handleRestoreBackup(backup)}
                        disabled={actionLoading?.id === backup.id || backup.status !== 'completed'}
                      >
                        {actionLoading?.id === backup.id && actionLoading?.action === 'restore' ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RotateCcw className="w-4 h-4 text-blue-400" />
                        )}
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0"
                      >
                        <Download className="w-4 h-4 text-green-400" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0"
                        onClick={() => handleDeleteBackup(backup)}
                        disabled={actionLoading?.id === backup.id}
                      >
                        {actionLoading?.id === backup.id && actionLoading?.action === 'delete' ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4 text-red-400" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-neutral-400">Size:</span>
                      <span className="ml-2 font-medium">{formatFileSize(backup.size_bytes)}</span>
                    </div>
                    <div>
                      <span className="text-neutral-400">Location:</span>
                      <span className="ml-2 font-mono text-xs">{backup.storage_location}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-neutral-400">Created:</span>
                      <span className="ml-2">{new Date(backup.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-neutral-400">Expires:</span>
                      <span className={`ml-2 ${
                        isExpiringSoon(backup.expires_at) 
                          ? 'text-yellow-400' 
                          : 'text-neutral-300'
                      }`}>
                        {new Date(backup.expires_at).toLocaleDateString()}
                      </span>
                      {isExpiringSoon(backup.expires_at) && (
                        <AlertCircle className="w-4 h-4 text-yellow-400" />
                      )}
                    </div>
                  </div>

                  {isExpiringSoon(backup.expires_at) && (
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-yellow-400 text-sm">
                        <AlertCircle className="w-4 h-4" />
                        <span>This backup will expire soon. Consider creating a new one.</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}