'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  Folder,
  FolderOpen,
  FileText,
  ChevronRight,
  ChevronDown,
  Search,
  Plus,
  Upload
} from 'lucide-react'
import { FileContent } from './MonacoEditor'

interface FileNode {
  path: string
  name: string
  type: 'file' | 'folder'
  children?: FileNode[]
  isExpanded?: boolean
  modified?: boolean
}

interface FileExplorerProps {
  files: FileContent[]
  activeFile?: string
  onFileSelect: (path: string) => void
  onFileAdd?: (parentPath?: string) => void
  onFileUpload?: () => void
  className?: string
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

const buildFileTree = (files: FileContent[]): FileNode[] => {
  const tree: FileNode[] = []
  const nodeMap = new Map<string, FileNode>()

  // First pass: create all nodes
  files.forEach(file => {
    const parts = file.path.split('/')
    let currentPath = ''
    
    parts.forEach((part, index) => {
      const isLast = index === parts.length - 1
      currentPath = currentPath ? `${currentPath}/${part}` : part
      
      if (!nodeMap.has(currentPath)) {
        const node: FileNode = {
          path: currentPath,
          name: part,
          type: isLast ? 'file' : 'folder',
          children: isLast ? undefined : [],
          isExpanded: false,
          modified: isLast ? file.modified : undefined
        }
        nodeMap.set(currentPath, node)
      }
    })
  })

  // Second pass: build hierarchy
  nodeMap.forEach((node, path) => {
    const parentPath = path.substring(0, path.lastIndexOf('/'))
    if (parentPath) {
      const parent = nodeMap.get(parentPath)
      if (parent && parent.children) {
        parent.children.push(node)
      }
    } else {
      tree.push(node)
    }
  })

  // Sort: folders first, then files
  const sortNodes = (nodes: FileNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })
    nodes.forEach(node => {
      if (node.children) {
        sortNodes(node.children)
      }
    })
  }

  sortNodes(tree)
  return tree
}

export default function FileExplorer({
  files,
  activeFile,
  onFileSelect,
  onFileAdd,
  onFileUpload,
  className = ''
}: FileExplorerProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  
  const fileTree = buildFileTree(files)
  
  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders)
    if (newExpanded.has(path)) {
      newExpanded.delete(path)
    } else {
      newExpanded.add(path)
    }
    setExpandedFolders(newExpanded)
  }

  const filterFiles = (nodes: FileNode[], term: string): FileNode[] => {
    if (!term) return nodes
    
    return nodes.filter(node => {
      if (node.type === 'file') {
        return node.name.toLowerCase().includes(term.toLowerCase())
      } else {
        const hasMatchingChildren = node.children && filterFiles(node.children, term).length > 0
        return node.name.toLowerCase().includes(term.toLowerCase()) || hasMatchingChildren
      }
    }).map(node => ({
      ...node,
      children: node.children ? filterFiles(node.children, term) : undefined
    }))
  }

  const renderNode = (node: FileNode, depth: number = 0): React.ReactNode => {
    const isExpanded = expandedFolders.has(node.path)
    const isActive = activeFile === node.path
    const filteredChildren = node.children ? filterFiles(node.children, searchTerm) : []

    return (
      <div key={node.path}>
        <div
          className={`
            flex items-center gap-2 px-2 py-1 cursor-pointer rounded-sm transition-colors
            hover:bg-neutral-800 group
            ${isActive ? 'bg-orange-500/20 text-orange-400' : 'text-neutral-300'}
          `}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => {
            if (node.type === 'folder') {
              toggleFolder(node.path)
            } else {
              onFileSelect(node.path)
            }
          }}
        >
          {node.type === 'folder' && (
            <>
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 flex-shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 flex-shrink-0" />
              )}
              {isExpanded ? (
                <FolderOpen className="w-4 h-4 flex-shrink-0" />
              ) : (
                <Folder className="w-4 h-4 flex-shrink-0" />
              )}
            </>
          )}
          
          {node.type === 'file' && (
            <span className="text-sm flex-shrink-0">
              {getFileIcon(node.path)}
            </span>
          )}
          
          <span className="text-sm truncate flex-1">{node.name}</span>
          
          {node.modified && (
            <div className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0" />
          )}
        </div>
        
        {node.type === 'folder' && isExpanded && filteredChildren.length > 0 && (
          <div>
            {filteredChildren.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  const filteredTree = filterFiles(fileTree, searchTerm)

  return (
    <Card className={`bg-neutral-900 border-neutral-800 h-full ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Files</CardTitle>
          <div className="flex gap-1">
            {onFileAdd && (
              <Button size="sm" variant="ghost" onClick={() => onFileAdd()}>
                <Plus className="w-4 h-4" />
              </Button>
            )}
            {onFileUpload && (
              <Button size="sm" variant="ghost" onClick={onFileUpload}>
                <Upload className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <Input
            placeholder="Search files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-neutral-800 border-neutral-700 focus:border-orange-500 text-sm"
          />
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 max-h-96 overflow-y-auto">
        {filteredTree.length === 0 ? (
          <div className="text-center text-neutral-400 py-8">
            {files.length === 0 ? 'No files' : 'No matching files'}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredTree.map(node => renderNode(node))}
          </div>
        )}
        
        {files.length > 0 && (
          <div className="mt-4 pt-4 border-t border-neutral-800">
            <div className="flex items-center justify-between text-xs text-neutral-400">
              <span>{files.length} files</span>
              <Badge variant="outline" className="text-xs">
                {files.filter(f => f.modified).length} modified
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}