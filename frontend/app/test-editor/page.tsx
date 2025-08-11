'use client'

import { useState } from 'react'
import { CodeEditor, FileContent } from '@/components/editor'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Code2, Download, Save } from 'lucide-react'

// Sample files for testing
const sampleFiles: FileContent[] = [
  {
    path: 'package.json',
    content: `{
  "name": "my-app",
  "version": "1.0.0",
  "description": "A sample Node.js application",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "jest"
  },
  "dependencies": {
    "express": "^4.18.0",
    "cors": "^2.8.5",
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "nodemon": "^2.0.20",
    "jest": "^29.0.0"
  }
}`,
    language: 'json'
  },
  {
    path: 'server.js',
    content: `const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Hello CodeRunner!',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.post('/api/data', (req, res) => {
  const { data } = req.body;
  
  if (!data) {
    return res.status(400).json({ error: 'Data is required' });
  }
  
  res.json({ 
    received: data,
    processed: true,
    timestamp: new Date().toISOString()
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});`,
    language: 'javascript'
  },
  {
    path: 'docker-compose.yml',
    content: `version: '3.8'

services:
  app:
    build: .
    container_name: my-app
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    volumes:
      - .:/app
      - /app/node_modules
    restart: unless-stopped
    
  redis:
    image: redis:7-alpine
    container_name: my-app-redis
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  redis_data:`,
    language: 'yaml'
  },
  {
    path: 'Dockerfile',
    content: `FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["npm", "start"]`,
    language: 'dockerfile'
  },
  {
    path: '.env.example',
    content: `# Application Configuration
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://username:password@localhost:5432/myapp

# Redis
REDIS_URL=redis://localhost:6379

# Security
JWT_SECRET=your-super-secret-jwt-key-here
CORS_ORIGIN=http://localhost:3000

# API Keys
API_KEY=your-api-key-here
WEBHOOK_SECRET=your-webhook-secret`,
    language: 'plaintext'
  }
]

export default function TestEditorPage() {
  const [files, setFiles] = useState<FileContent[]>(sampleFiles)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  const handleFilesChange = (updatedFiles: FileContent[]) => {
    setFiles(updatedFiles)
  }

  const handleSave = (savedFiles: FileContent[]) => {
    setFiles(savedFiles)
    setLastSaved(new Date())
    
    // Simulate saving to backend
    console.log('Files saved:', savedFiles.map(f => ({ path: f.path, size: f.content.length })))
  }

  const handleDownload = () => {
    // Create a simple download of all files as JSON
    const dataStr = JSON.stringify(files, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
    
    const exportFileDefaultName = 'coderunner-project.json'
    
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }

  const modifiedCount = files.filter(f => f.modified).length

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-neutral-800 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                <Code2 className="w-6 h-6 text-black" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Monaco Editor Test</h1>
                <p className="text-neutral-400">Testing Monaco Editor integration with CodeRunner</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {lastSaved && (
                <Badge variant="outline" className="text-xs text-green-400 border-green-400">
                  Saved at {lastSaved.toLocaleTimeString()}
                </Badge>
              )}
              
              {modifiedCount > 0 && (
                <Badge variant="outline" className="text-xs text-orange-400 border-orange-400">
                  {modifiedCount} modified
                </Badge>
              )}
              
              <Button
                variant="outline"
                onClick={handleDownload}
                className="border-neutral-700 hover:bg-neutral-800"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <CodeEditor
            initialFiles={files}
            onFilesChange={handleFilesChange}
            onSave={handleSave}
            height="80vh"
            autoSave={true}
            autoSaveDelay={2000}
            showSidebar={true}
          />
        </div>
      </div>

      {/* Footer Info */}
      <div className="border-t border-neutral-800 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between text-sm text-neutral-400">
            <div className="flex items-center gap-4">
              <span>Monaco Editor v{process.env.NODE_ENV === 'development' ? 'dev' : '1.0.0'}</span>
              <span>•</span>
              <span>{files.length} files</span>
              <span>•</span>
              <span>
                {files.reduce((acc, f) => acc + f.content.length, 0).toLocaleString()} characters
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4" />
              <span>CodeRunner v2.0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}