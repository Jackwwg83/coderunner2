'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CodeEditor, FileContent } from '@/components/editor'
import { 
  Code2,
  FileText,
  Upload,
  Save,
  ArrowLeft,
  ChevronRight,
  Database,
  AlertCircle
} from 'lucide-react'

interface DeploymentEditorProps {
  template?: {
    id: string
    name: string
    type: string
    version: string
    defaultFiles?: FileContent[]
  }
  onFilesChange?: (files: FileContent[]) => void
  onBack?: () => void
  onNext?: () => void
  className?: string
}

// Sample template files for different database types
const getDefaultTemplateFiles = (templateType: string): FileContent[] => {
  switch (templateType) {
    case 'postgresql':
      return [
        {
          path: 'init.sql',
          content: `-- PostgreSQL initialization script
CREATE DATABASE IF NOT EXISTS myapp;

CREATE USER IF NOT EXISTS appuser WITH ENCRYPTED PASSWORD 'securepass';
GRANT ALL PRIVILEGES ON DATABASE myapp TO appuser;

-- Create a sample table
\\c myapp;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample data
INSERT INTO users (email) VALUES 
    ('admin@example.com'),
    ('user@example.com')
ON CONFLICT (email) DO NOTHING;`,
          language: 'sql'
        },
        {
          path: 'docker-compose.yml',
          content: `version: '3.8'

services:
  postgres:
    image: postgres:15
    container_name: myapp_postgres
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: appuser
      POSTGRES_PASSWORD: securepass
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    restart: unless-stopped

volumes:
  postgres_data:`,
          language: 'yaml'
        }
      ]

    case 'mysql':
      return [
        {
          path: 'init.sql',
          content: `-- MySQL initialization script
CREATE DATABASE IF NOT EXISTS myapp;

CREATE USER IF NOT EXISTS 'appuser'@'%' IDENTIFIED BY 'securepass';
GRANT ALL PRIVILEGES ON myapp.* TO 'appuser'@'%';
FLUSH PRIVILEGES;

USE myapp;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample data
INSERT IGNORE INTO users (email) VALUES 
    ('admin@example.com'),
    ('user@example.com');`,
          language: 'sql'
        },
        {
          path: 'docker-compose.yml',
          content: `version: '3.8'

services:
  mysql:
    image: mysql:8.0
    container_name: myapp_mysql
    environment:
      MYSQL_ROOT_PASSWORD: rootpass
      MYSQL_DATABASE: myapp
      MYSQL_USER: appuser
      MYSQL_PASSWORD: securepass
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    restart: unless-stopped

volumes:
  mysql_data:`,
          language: 'yaml'
        }
      ]

    case 'mongodb':
      return [
        {
          path: 'init.js',
          content: `// MongoDB initialization script
db = db.getSiblingDB('myapp');

// Create a collection and insert sample data
db.users.insertMany([
    {
        email: 'admin@example.com',
        createdAt: new Date()
    },
    {
        email: 'user@example.com',
        createdAt: new Date()
    }
]);

// Create an index
db.users.createIndex({ "email": 1 }, { unique: true });

print('Database initialized successfully');`,
          language: 'javascript'
        },
        {
          path: 'docker-compose.yml',
          content: `version: '3.8'

services:
  mongodb:
    image: mongo:7
    container_name: myapp_mongodb
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: adminpass
      MONGO_INITDB_DATABASE: myapp
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
      - ./init.js:/docker-entrypoint-initdb.d/init.js
    restart: unless-stopped

volumes:
  mongodb_data:`,
          language: 'yaml'
        }
      ]

    case 'redis':
      return [
        {
          path: 'redis.conf',
          content: `# Redis configuration file
bind 0.0.0.0
port 6379
protected-mode no

# Memory settings
maxmemory 256mb
maxmemory-policy allkeys-lru

# Persistence
save 900 1
save 300 10
save 60 10000

# Logging
loglevel notice
logfile ""

# Security
requirepass securepass`,
          language: 'plaintext'
        },
        {
          path: 'docker-compose.yml',
          content: `version: '3.8'

services:
  redis:
    image: redis:7-alpine
    container_name: myapp_redis
    command: redis-server /usr/local/etc/redis/redis.conf
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
      - ./redis.conf:/usr/local/etc/redis/redis.conf
    restart: unless-stopped

volumes:
  redis_data:`,
          language: 'yaml'
        }
      ]

    default:
      return [
        {
          path: 'README.md',
          content: `# Database Deployment

This is a template deployment for your database.

## Configuration

Update the configuration files according to your needs:

- Edit connection settings
- Modify security settings
- Adjust resource allocations
- Add initialization scripts

## Deployment

The deployment will use the files you've configured in this editor.`,
          language: 'markdown'
        }
      ]
  }
}

export default function DeploymentEditor({
  template,
  onFilesChange,
  onBack,
  onNext,
  className = ''
}: DeploymentEditorProps) {
  const [files, setFiles] = useState<FileContent[]>([])
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Initialize files when template changes
  useEffect(() => {
    if (template) {
      const defaultFiles = template.defaultFiles || getDefaultTemplateFiles(template.type)
      setFiles(defaultFiles)
      onFilesChange?.(defaultFiles)
    }
  }, [template])

  // Track unsaved changes
  useEffect(() => {
    const hasChanges = files.some(f => f.modified)
    setHasUnsavedChanges(hasChanges)
  }, [files])

  const handleFilesChange = (updatedFiles: FileContent[]) => {
    setFiles(updatedFiles)
    onFilesChange?.(updatedFiles)
  }

  const handleSaveFiles = (savedFiles: FileContent[]) => {
    setFiles(savedFiles)
    onFilesChange?.(savedFiles)
  }

  const handleFileUpload = (uploadedFiles: File[]) => {
    // Handle file uploads by converting to FileContent objects
    const newFiles: FileContent[] = []
    
    uploadedFiles.forEach(async (file) => {
      const content = await file.text()
      const language = file.name.split('.').pop()?.toLowerCase() || 'plaintext'
      
      newFiles.push({
        path: file.name,
        content,
        language,
        modified: false
      })
    })
    
    const updatedFiles = [...files, ...newFiles]
    setFiles(updatedFiles)
    onFilesChange?.(updatedFiles)
  }

  if (!template) {
    return (
      <Card className={`bg-neutral-900 border-neutral-800 ${className}`}>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center text-neutral-400">
            <AlertCircle className="w-8 h-8 mx-auto mb-2" />
            <p>No template selected</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Code2 className="w-6 h-6 text-orange-400" />
                <div>
                  <CardTitle className="text-xl">Configure Deployment Files</CardTitle>
                  <p className="text-sm text-neutral-400 mt-1">
                    Edit configuration files for your {template.name} deployment
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs">
                {template.type} {template.version}
              </Badge>
            </div>
            
            {hasUnsavedChanges && (
              <Badge variant="outline" className="text-orange-400 border-orange-400">
                Unsaved Changes
              </Badge>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Code Editor */}
      <CodeEditor
        initialFiles={files}
        onFilesChange={handleFilesChange}
        onSave={handleSaveFiles}
        onFileUpload={handleFileUpload}
        height="500px"
        autoSave={true}
        autoSaveDelay={1000}
        showSidebar={true}
      />

      {/* File Summary */}
      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Deployment Files ({files.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {files.length === 0 ? (
            <div className="text-center text-neutral-400 py-4">
              No files configured
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {files.map((file) => (
                <div
                  key={file.path}
                  className="flex items-center gap-2 p-2 bg-neutral-800 rounded-lg"
                >
                  <FileText className="w-4 h-4 text-neutral-400" />
                  <span className="text-sm flex-1 truncate">{file.path}</span>
                  {file.modified && (
                    <div className="w-2 h-2 bg-orange-500 rounded-full" />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={onBack}
          className="border-neutral-700"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        
        <Button
          onClick={onNext}
          disabled={files.length === 0}
          className="bg-orange-500 hover:bg-orange-600 text-black"
        >
          Continue to Review
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}