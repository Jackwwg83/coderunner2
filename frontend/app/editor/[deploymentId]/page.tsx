'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, File, Folder, FolderOpen, Play, Save, Settings, Zap } from 'lucide-react'

export default function FileEditorPage() {
  const [selectedFile, setSelectedFile] = useState('src/index.js')
  const [fileContent, setFileContent] = useState(`const express = require('express');
const app = express();
const port = process.env.PORT || 8080;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to CodeRunner API',
    version: '1.0.0',
    status: 'running'
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: err.message
  });
});

// Start server
app.listen(port, () => {
  console.log(\`Server running on port \${port}\`);
});`)

  const fileTree = [
    {
      name: 'src',
      type: 'folder',
      expanded: true,
      children: [
        { name: 'index.js', type: 'file', selected: true },
        { name: 'routes.js', type: 'file' },
        { name: 'middleware.js', type: 'file' },
        {
          name: 'controllers',
          type: 'folder',
          expanded: false,
          children: [
            { name: 'auth.js', type: 'file' },
            { name: 'users.js', type: 'file' }
          ]
        }
      ]
    },
    { name: 'package.json', type: 'file' },
    { name: '.env', type: 'file' },
    { name: 'README.md', type: 'file' }
  ]

  const renderFileTree = (items: any[], level = 0) => {
    return items.map((item, index) => (
      <div key={index}>
        <div
          className={`flex items-center gap-2 px-2 py-1 hover:bg-neutral-800 cursor-pointer ${
            item.selected ? 'bg-orange-500/20 text-orange-400' : ''
          }`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => item.type === 'file' && setSelectedFile(item.name)}
        >
          {item.type === 'folder' ? (
            item.expanded ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />
          ) : (
            <File className="w-4 h-4" />
          )}
          <span className="text-sm">{item.name}</span>
        </div>
        {item.type === 'folder' && item.expanded && item.children && (
          <div>
            {renderFileTree(item.children, level + 1)}
          </div>
        )}
      </div>
    ))
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-neutral-800 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" className="hover:bg-neutral-800">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-orange-500 rounded flex items-center justify-center">
                <Zap className="w-4 h-4 text-black" />
              </div>
              <span className="font-bold">File Editor</span>
              <span className="text-neutral-400">•</span>
              <span className="font-mono text-sm">tactical-api</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-black">
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
            <Button size="sm" variant="outline" className="border-green-700 text-green-400 hover:bg-green-900/20">
              <Play className="w-4 h-4 mr-2" />
              Run
            </Button>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-73px)]">
        {/* File Tree Sidebar */}
        <div className="w-64 bg-neutral-900 border-r border-neutral-800 overflow-y-auto">
          <div className="p-4">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <Folder className="w-4 h-4" />
              Files
            </h3>
            <div className="space-y-1">
              {renderFileTree(fileTree)}
            </div>
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 flex flex-col">
          {/* File Tabs */}
          <div className="border-b border-neutral-800 bg-neutral-900">
            <div className="flex">
              <div className="flex items-center gap-2 px-4 py-2 bg-neutral-800 border-r border-neutral-700">
                <File className="w-4 h-4" />
                <span className="text-sm font-mono">{selectedFile}</span>
              </div>
            </div>
          </div>

          {/* Monaco Editor Area */}
          <div className="flex-1 relative">
            <Card className="h-full bg-neutral-900 border-0 rounded-none">
              <CardContent className="p-0 h-full">
                <div className="h-full bg-neutral-950 p-4 font-mono text-sm overflow-auto">
                  <div className="flex">
                    {/* Line Numbers */}
                    <div className="text-neutral-500 text-right pr-4 select-none">
                      {fileContent.split('\n').map((_, index) => (
                        <div key={index} className="leading-6">
                          {index + 1}
                        </div>
                      ))}
                    </div>
                    
                    {/* Code Content */}
                    <div className="flex-1">
                      <textarea
                        value={fileContent}
                        onChange={(e) => setFileContent(e.target.value)}
                        className="w-full h-full bg-transparent border-none outline-none resize-none leading-6 text-white"
                        style={{ minHeight: '100%' }}
                        spellCheck={false}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Status Bar */}
          <div className="border-t border-neutral-800 bg-neutral-900 px-4 py-2 text-sm text-neutral-400">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span>JavaScript</span>
                <span>UTF-8</span>
                <span>LF</span>
              </div>
              <div className="flex items-center gap-4">
                <span>Ln 1, Col 1</span>
                <span>Spaces: 2</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
