'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import MonacoEditor, { FileContent } from './MonacoEditor'
import EditorTabs from './EditorTabs'
import FileExplorer from './FileExplorer'
import { 
  Save,
  Download,
  Upload,
  RefreshCw,
  Settings,
  SidebarIcon,
  Code2
} from 'lucide-react'

interface CodeEditorProps {
  initialFiles?: FileContent[]
  onFilesChange?: (files: FileContent[]) => void
  onSave?: (files: FileContent[]) => void
  onFileUpload?: (files: File[]) => void
  showSidebar?: boolean
  height?: string
  readOnly?: boolean
  autoSave?: boolean
  autoSaveDelay?: number
  className?: string
}

export default function CodeEditor({
  initialFiles = [],
  onFilesChange,
  onSave,
  onFileUpload,
  showSidebar = true,
  height = '600px',
  readOnly = false,
  autoSave = false,
  autoSaveDelay = 2000,
  className = ''
}: CodeEditorProps) {
  const [files, setFiles] = useState<FileContent[]>(initialFiles)
  const [activeFile, setActiveFile] = useState<string | undefined>(
    initialFiles.length > 0 ? initialFiles[0].path : undefined
  )
  const [sidebarVisible, setSidebarVisible] = useState(showSidebar)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [autoSaveTimeout, setAutoSaveTimeout] = useState<NodeJS.Timeout | null>(null)

  // Update files when initialFiles changes
  useEffect(() => {
    setFiles(initialFiles)
    if (initialFiles.length > 0 && !activeFile) {
      setActiveFile(initialFiles[0].path)
    }
  }, [initialFiles])

  // Track unsaved changes
  useEffect(() => {
    const hasChanges = files.some(f => f.modified)
    setHasUnsavedChanges(hasChanges)
  }, [files])

  // Auto-save functionality
  useEffect(() => {
    if (autoSave && hasUnsavedChanges) {
      if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout)
      }
      
      const timeout = setTimeout(() => {
        handleSaveAll()
      }, autoSaveDelay)
      
      setAutoSaveTimeout(timeout)
    }

    return () => {
      if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout)
      }
    }
  }, [files, autoSave, hasUnsavedChanges])

  const handleFileChange = (path: string, content: string) => {
    setFiles(prevFiles => {
      const updatedFiles = prevFiles.map(file => 
        file.path === path 
          ? { ...file, content, modified: true }
          : file
      )
      
      onFilesChange?.(updatedFiles)
      return updatedFiles
    })
  }

  const handleFileSave = (path: string, content: string) => {
    setFiles(prevFiles => {
      const updatedFiles = prevFiles.map(file =>
        file.path === path
          ? { ...file, content, modified: false }
          : file
      )
      
      onFilesChange?.(updatedFiles)
      return updatedFiles
    })
  }

  const handleSaveAll = () => {
    if (onSave) {
      onSave(files)
    }
    
    setFiles(prevFiles => {
      const savedFiles = prevFiles.map(file => ({ ...file, modified: false }))
      onFilesChange?.(savedFiles)
      return savedFiles
    })
  }

  const handleFileSelect = (path: string) => {
    setActiveFile(path)
  }

  const handleFileClose = (path: string) => {
    const updatedFiles = files.filter(f => f.path !== path)
    setFiles(updatedFiles)
    
    // Select next file if the closed file was active
    if (activeFile === path) {
      const currentIndex = files.findIndex(f => f.path === path)
      const nextFile = updatedFiles[Math.min(currentIndex, updatedFiles.length - 1)]
      setActiveFile(nextFile?.path)
    }
    
    onFilesChange?.(updatedFiles)
  }

  const handleFileAdd = () => {
    const newFileName = `untitled-${files.length + 1}.js`
    const newFile: FileContent = {
      path: newFileName,
      content: '// New file\n',
      language: 'javascript',
      modified: true
    }
    
    const updatedFiles = [...files, newFile]
    setFiles(updatedFiles)
    setActiveFile(newFile.path)
    onFilesChange?.(updatedFiles)
  }

  const handleFileUploadClick = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = '.js,.ts,.tsx,.jsx,.py,.yaml,.yml,.json,.md,.css,.html,.sql,.sh'
    
    input.onchange = async (e) => {
      const fileList = (e.target as HTMLInputElement).files
      if (!fileList) return
      
      const uploadedFiles = Array.from(fileList)
      
      if (onFileUpload) {
        onFileUpload(uploadedFiles)
      } else {
        // Default behavior: read files and add to editor
        const newFiles: FileContent[] = []
        
        for (const file of uploadedFiles) {
          const content = await file.text()
          const language = file.name.split('.').pop()?.toLowerCase() || 'plaintext'
          
          newFiles.push({
            path: file.name,
            content,
            language,
            modified: false
          })
        }
        
        const updatedFiles = [...files, ...newFiles]
        setFiles(updatedFiles)
        
        if (newFiles.length > 0) {
          setActiveFile(newFiles[0].path)
        }
        
        onFilesChange?.(updatedFiles)
      }
    }
    
    input.click()
  }

  const getModifiedCount = () => {
    return files.filter(f => f.modified).length
  }

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Toolbar */}
      <Card className="bg-neutral-900 border-neutral-800">
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Code2 className="w-5 h-5 text-orange-400" />
              <span className="font-semibold">Code Editor</span>
            </div>
            
            {files.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {files.length} files
              </Badge>
            )}
            
            {hasUnsavedChanges && (
              <Badge variant="outline" className="text-xs text-orange-400 border-orange-400">
                {getModifiedCount()} modified
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSidebarVisible(!sidebarVisible)}
              className="hover:bg-neutral-800"
            >
              <SidebarIcon className="w-4 h-4" />
            </Button>
            
            <Button
              size="sm"
              variant="ghost"
              onClick={handleFileUploadClick}
              className="hover:bg-neutral-800"
            >
              <Upload className="w-4 h-4" />
            </Button>
            
            {files.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleSaveAll}
                disabled={!hasUnsavedChanges}
                className="hover:bg-neutral-800"
              >
                <Save className="w-4 h-4" />
                {hasUnsavedChanges && (
                  <span className="ml-2 text-xs">Save All</span>
                )}
              </Button>
            )}
          </div>
        </div>
      </Card>

      <div className="flex gap-3" style={{ height }}>
        {/* Sidebar */}
        {sidebarVisible && (
          <div className="w-64 flex-shrink-0">
            <FileExplorer
              files={files}
              activeFile={activeFile}
              onFileSelect={handleFileSelect}
              onFileAdd={handleFileAdd}
              onFileUpload={handleFileUploadClick}
              className="h-full"
            />
          </div>
        )}

        {/* Main Editor Area */}
        <div className="flex-1 flex flex-col gap-2">
          {/* File Tabs */}
          {files.length > 0 && (
            <EditorTabs
              files={files}
              activeFile={activeFile}
              onFileSelect={handleFileSelect}
              onFileClose={handleFileClose}
              onFileAdd={handleFileAdd}
            />
          )}

          {/* Monaco Editor */}
          {files.length > 0 ? (
            <MonacoEditor
              files={files}
              activeFile={activeFile}
              onFileChange={handleFileChange}
              onFileSave={handleFileSave}
              onFileSelect={handleFileSelect}
              height="100%"
              readOnly={readOnly}
              showToolbar={false} // We have our own toolbar
              className="flex-1"
            />
          ) : (
            <Card className="bg-neutral-900 border-neutral-800 flex-1 flex items-center justify-center">
              <div className="text-center">
                <Code2 className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-neutral-300 mb-2">
                  No files open
                </h3>
                <p className="text-neutral-400 mb-4">
                  Upload files or create a new file to start coding
                </p>
                <div className="flex gap-2 justify-center">
                  <Button
                    onClick={handleFileUploadClick}
                    className="bg-orange-500 hover:bg-orange-600 text-black"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Files
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleFileAdd}
                    className="border-neutral-700 hover:bg-neutral-800"
                  >
                    <Code2 className="w-4 h-4 mr-2" />
                    New File
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}