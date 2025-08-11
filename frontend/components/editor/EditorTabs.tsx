'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  X, 
  Plus,
  FileText,
  File
} from 'lucide-react'
import { FileContent } from './MonacoEditor'

interface EditorTabsProps {
  files: FileContent[]
  activeFile?: string
  onFileSelect: (path: string) => void
  onFileClose?: (path: string) => void
  onFileAdd?: () => void
  maxTabs?: number
}

const getFileIcon = (path: string): string => {
  const ext = path.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'js': return '📜'
    case 'ts':
    case 'tsx': return '🔷'
    case 'jsx': return '⚛️'
    case 'py': return '🐍'
    case 'yaml':
    case 'yml': return '⚙️'
    case 'json': return '📋'
    case 'md': return '📝'
    case 'css': return '🎨'
    case 'html': return '🌐'
    case 'sql': return '🗃️'
    case 'dockerfile': return '🐳'
    default: return '📄'
  }
}

const getFileName = (path: string): string => {
  return path.split('/').pop() || path
}

const getFileExtension = (path: string): string => {
  return path.split('.').pop()?.toLowerCase() || ''
}

export default function EditorTabs({
  files,
  activeFile,
  onFileSelect,
  onFileClose,
  onFileAdd,
  maxTabs = 10
}: EditorTabsProps) {
  const [hoveredTab, setHoveredTab] = useState<string | null>(null)

  const displayFiles = files.slice(0, maxTabs)
  const hasMoreFiles = files.length > maxTabs

  const handleTabClick = (filePath: string) => {
    onFileSelect(filePath)
  }

  const handleCloseClick = (e: React.MouseEvent, filePath: string) => {
    e.stopPropagation()
    if (onFileClose) {
      onFileClose(filePath)
    }
  }

  if (files.length === 0) {
    return (
      <Card className="bg-neutral-900 border-neutral-800">
        <div className="flex items-center justify-center p-4">
          <Button
            variant="ghost"
            onClick={onFileAdd}
            className="hover:bg-neutral-800 text-neutral-400"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add File
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card className="bg-neutral-900 border-neutral-800">
      <div className="flex items-center overflow-x-auto scrollbar-hide">
        {displayFiles.map((file) => {
          const isActive = file.path === activeFile
          const fileName = getFileName(file.path)
          const fileExtension = getFileExtension(file.path)
          
          return (
            <div
              key={file.path}
              className={`
                flex items-center gap-2 px-3 py-2 cursor-pointer border-r border-neutral-800 
                min-w-0 flex-shrink-0 transition-all duration-200
                ${isActive 
                  ? 'bg-neutral-800 text-white border-b-2 border-orange-500' 
                  : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-white'
                }
                ${hoveredTab === file.path ? 'bg-neutral-800/50' : ''}
              `}
              onClick={() => handleTabClick(file.path)}
              onMouseEnter={() => setHoveredTab(file.path)}
              onMouseLeave={() => setHoveredTab(null)}
              title={file.path}
            >
              <span className="text-sm flex-shrink-0">
                {getFileIcon(file.path)}
              </span>
              
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate max-w-32">
                  {fileName}
                </div>
                {fileExtension && (
                  <div className="text-xs text-neutral-500 truncate">
                    {fileExtension}
                  </div>
                )}
              </div>

              {file.modified && (
                <div className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0" />
              )}

              {onFileClose && files.length > 1 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => handleCloseClick(e, file.path)}
                  className={`
                    w-4 h-4 p-0 hover:bg-neutral-700 rounded-sm flex-shrink-0
                    ${hoveredTab === file.path || isActive ? 'opacity-100' : 'opacity-0'}
                    transition-opacity duration-200
                  `}
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>
          )
        })}

        {hasMoreFiles && (
          <div className="flex items-center px-3 py-2 text-neutral-400 text-sm border-r border-neutral-800">
            <FileText className="w-4 h-4 mr-1" />
            +{files.length - maxTabs}
          </div>
        )}

        {onFileAdd && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onFileAdd}
            className="flex-shrink-0 mx-2 hover:bg-neutral-800"
          >
            <Plus className="w-4 h-4" />
          </Button>
        )}
      </div>
    </Card>
  )
}