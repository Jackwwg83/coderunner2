'use client'

import { useState, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Save, 
  Download, 
  Upload,
  Settings,
  Maximize2,
  Minimize2 
} from 'lucide-react'

// Dynamic import to avoid SSR issues with Monaco
const Editor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-96 bg-neutral-900 rounded-lg">
      <div className="text-neutral-400">Loading editor...</div>
    </div>
  )
})

export interface FileContent {
  path: string
  content: string
  language: string
  modified?: boolean
}

interface MonacoEditorProps {
  files: FileContent[]
  activeFile?: string
  onFileChange: (path: string, content: string) => void
  onFileSave?: (path: string, content: string) => void
  onFileSelect: (path: string) => void
  height?: string
  readOnly?: boolean
  showToolbar?: boolean
  className?: string
}

const getLanguageFromPath = (path: string): string => {
  const ext = path.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'js': return 'javascript'
    case 'ts': return 'typescript'
    case 'tsx': return 'typescript'
    case 'jsx': return 'javascript'
    case 'py': return 'python'
    case 'yaml':
    case 'yml': return 'yaml'
    case 'json': return 'json'
    case 'md': return 'markdown'
    case 'css': return 'css'
    case 'html': return 'html'
    case 'sql': return 'sql'
    case 'sh': return 'shell'
    case 'dockerfile': return 'dockerfile'
    default: return 'plaintext'
  }
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

export default function MonacoEditor({
  files,
  activeFile,
  onFileChange,
  onFileSave,
  onFileSelect,
  height = '500px',
  readOnly = false,
  showToolbar = true,
  className = ''
}: MonacoEditorProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const editorRef = useRef<any>(null)
  
  const currentFile = files.find(f => f.path === activeFile) || files[0]
  
  useEffect(() => {
    if (currentFile?.modified) {
      setHasUnsavedChanges(true)
    } else {
      setHasUnsavedChanges(false)
    }
  }, [currentFile?.modified])

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor
    
    // Configure editor for dark theme
    editor.updateOptions({
      fontSize: 14,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
      insertSpaces: true,
      wordWrap: 'on',
      contextmenu: true,
      selectOnLineNumbers: true,
      roundedSelection: false,
      readOnly: readOnly,
      cursorStyle: 'line',
      glyphMargin: false,
      folding: true,
      lineNumbers: 'on',
      lineDecorationsWidth: 0,
      lineNumbersMinChars: 0
    })

    // Add keyboard shortcuts
    editor.addCommand(editor.KeyMod.CtrlCmd | editor.KeyCode.KeyS, () => {
      if (onFileSave && currentFile) {
        onFileSave(currentFile.path, currentFile.content)
        setHasUnsavedChanges(false)
      }
    })
  }

  const handleEditorChange = (value: string | undefined) => {
    if (!currentFile || readOnly) return
    
    const newContent = value || ''
    onFileChange(currentFile.path, newContent)
    setHasUnsavedChanges(newContent !== currentFile.content)
  }

  const handleSave = () => {
    if (onFileSave && currentFile) {
      onFileSave(currentFile.path, currentFile.content)
      setHasUnsavedChanges(false)
    }
  }

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  if (!currentFile) {
    return (
      <Card className="bg-neutral-900 border-neutral-800">
        <div className="flex items-center justify-center h-64 text-neutral-400">
          No file selected
        </div>
      </Card>
    )
  }

  return (
    <Card className={`bg-neutral-900 border-neutral-800 ${className} ${
      isFullscreen ? 'fixed inset-0 z-50 rounded-none border-none' : ''
    }`}>
      {showToolbar && (
        <div className="flex items-center justify-between p-3 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <span className="text-lg">{getFileIcon(currentFile.path)}</span>
            <div>
              <div className="font-medium text-sm">{currentFile.path.split('/').pop()}</div>
              <div className="text-xs text-neutral-400">{currentFile.path}</div>
            </div>
            {hasUnsavedChanges && (
              <Badge variant="outline" className="text-xs text-orange-400 border-orange-400">
                Modified
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs">
              {getLanguageFromPath(currentFile.path)}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            {onFileSave && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleSave}
                disabled={!hasUnsavedChanges}
                className="hover:bg-neutral-800"
              >
                <Save className="w-4 h-4" />
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={toggleFullscreen}
              className="hover:bg-neutral-800"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      )}

      <div className="relative" style={{ height: isFullscreen ? 'calc(100vh - 60px)' : height }}>
        <Editor
          height="100%"
          defaultLanguage={getLanguageFromPath(currentFile.path)}
          language={getLanguageFromPath(currentFile.path)}
          value={currentFile.content}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          theme="vs-dark"
          options={{
            readOnly,
            fontSize: 14,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            insertSpaces: true,
            wordWrap: 'on',
            contextmenu: true,
            selectOnLineNumbers: true,
            roundedSelection: false,
            cursorStyle: 'line',
            glyphMargin: false,
            folding: true,
            lineNumbers: 'on',
            padding: { top: 16, bottom: 16 },
            renderLineHighlight: 'all',
            smoothScrolling: true,
            mouseWheelZoom: true
          }}
        />
      </div>

      {isFullscreen && (
        <div className="absolute top-2 right-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsFullscreen(false)}
            className="bg-neutral-800 hover:bg-neutral-700"
          >
            <Minimize2 className="w-4 h-4" />
          </Button>
        </div>
      )}
    </Card>
  )
}