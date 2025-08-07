# /deploy API Endpoint Documentation

## Overview

The `/api/deploy` endpoint is a unified deployment API that accepts project files and deploys them to a sandboxed environment. It supports both Node.js projects and Manifest-based projects.

## Endpoint Details

- **URL**: `POST /api/deploy`
- **Authentication**: Required (Bearer token)
- **Content-Type**: `application/json`
- **Rate Limiting**: Applied based on user plan

## Request Format

```json
{
  "projectName": "string",           // Required: Project name
  "projectDescription": "string",    // Optional: Project description
  "files": [                        // Required: Array of project files
    {
      "path": "string",             // File path (no path traversal)
      "content": "string"           // File content (base64 or plain text)
    }
  ],
  "config": {                       // Optional: Deployment configuration
    "env": {                        // Environment variables
      "NODE_ENV": "production"
    },
    "port": 3000,                   // Application port (default: 3000)
    "timeout": 300                  // Deployment timeout in seconds (default: 300)
  }
}
```

## Response Format

### Success Response (201 Created)
```json
{
  "success": true,
  "data": {
    "deploymentId": "exec_1691234567890_abc123def",
    "projectId": "project_uuid",
    "url": "https://sandbox-id.execute.run",
    "sandboxId": "sb_1691234567890_xyz789",
    "status": "running",
    "createdAt": "2023-08-05T12:34:56.789Z"
  },
  "message": "Deployment successful",
  "timestamp": "2023-08-05T12:34:56.789Z"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "message": "[ERROR_CODE] Detailed error message",
  "timestamp": "2023-08-05T12:34:56.789Z"
}
```

## Plan Limits

### Free Plan
- Max Projects: 3
- Max Concurrent Deployments: 10
- Max File Size: 10MB
- Max Total Project Size: 50MB

### Personal Plan
- Max Projects: 10
- Max Concurrent Deployments: 100
- Max File Size: 50MB
- Max Total Project Size: 200MB

### Team Plan
- Max Projects: Unlimited
- Max Concurrent Deployments: Unlimited
- Max File Size: 100MB
- Max Total Project Size: 500MB

## Example Usage

### Node.js Project Deployment

```javascript
// Example Node.js project deployment
const deployPayload = {
  "projectName": "hello-world-api",
  "projectDescription": "Simple Express.js API",
  "files": [
    {
      "path": "package.json",
      "content": JSON.stringify({
        "name": "hello-world-api",
        "version": "1.0.0",
        "main": "index.js",
        "scripts": {
          "start": "node index.js"
        },
        "dependencies": {
          "express": "^4.18.0"
        }
      }, null, 2)
    },
    {
      "path": "index.js",
      "content": `
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({ message: 'Hello World!', timestamp: new Date().toISOString() });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.listen(port, () => {
  console.log(\`Server running on port \${port}\`);
});
      `
    }
  ],
  "config": {
    "env": {
      "NODE_ENV": "production"
    },
    "port": 3000,
    "timeout": 300
  }
};

// Make the deployment request
fetch('/api/deploy', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${yourJWTToken}`
  },
  body: JSON.stringify(deployPayload)
})
.then(response => response.json())
.then(data => {
  if (data.success) {
    console.log('Deployment successful!');
    console.log('Application URL:', data.data.url);
    console.log('Deployment ID:', data.data.deploymentId);
  } else {
    console.error('Deployment failed:', data.error);
  }
});
```

### Manifest Project Deployment

```javascript
// Example Manifest project deployment
const manifestPayload = {
  "projectName": "user-management-api",
  "projectDescription": "Auto-generated API from manifest",
  "files": [
    {
      "path": "manifest.yaml",
      "content": `
name: user-management-api
version: 1.0.0
entities:
  - name: User
    fields:
      - name: id
        type: number
        required: true
      - name: name
        type: string
        required: true
      - name: email
        type: string
        required: true
      - name: created_at
        type: date
        required: false
  - name: Post
    fields:
      - name: id
        type: number
        required: true
      - name: title
        type: string
        required: true
      - name: content
        type: string
        required: true
      - name: user_id
        type: number
        required: true
      `
    }
  ],
  "config": {
    "port": 3000,
    "timeout": 300
  }
};

fetch('/api/deploy', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${yourJWTToken}`
  },
  body: JSON.stringify(manifestPayload)
})
.then(response => response.json())
.then(data => console.log(data));
```

## Error Codes

| Code | Description |
|------|-------------|
| `INVALID_FILES` | Files array is missing, empty, or contains invalid files |
| `INVALID_PROJECT_NAME` | Project name is missing or contains invalid characters |
| `QUOTA_EXCEEDED` | User has exceeded their plan limits |
| `DEPLOYMENT_FAILED` | General deployment failure |
| `DEPLOYMENT_TIMEOUT` | Deployment exceeded the timeout limit |
| `SANDBOX_ERROR` | Sandbox service is unavailable |
| `RESOURCE_NOT_FOUND` | Required resource could not be found |

## File Processing

### Supported File Types
- JavaScript (`.js`, `.jsx`)
- TypeScript (`.ts`, `.tsx`)
- JSON (`.json`)
- YAML (`.yaml`, `.yml`)
- Markdown (`.md`)
- Text (`.txt`)
- HTML (`.html`)
- CSS (`.css`, `.scss`)

### File Content Encoding
- Plain text: Direct string content
- Base64: Automatically detected and decoded

### Security Features
- Path traversal prevention (no `..`, `~`, or absolute paths)
- File size limits based on plan
- Content sanitization
- Malicious content filtering

## Rate Limiting

- **Authentication Required**: All requests must include a valid JWT token
- **Plan-Based Limits**: Different limits based on user's subscription plan
- **Concurrent Deployments**: Limited based on plan
- **File Size Restrictions**: Per-file and total project size limits

## Architecture Integration

The `/deploy` endpoint integrates with several core services:

1. **AuthMiddleware**: Token validation and user authentication
2. **OrchestrationService**: Handles sandbox creation and deployment orchestration
3. **DatabaseService**: Manages project and deployment records
4. **ManifestEngine**: Processes Manifest files and generates Express.js projects
5. **ProjectAnalyzer**: Analyzes project type and structure

## Testing

To test the endpoint, ensure you have:

1. Valid JWT token from `/api/auth/login` or `/api/auth/register`
2. Project files with valid structure
3. Proper content encoding (plain text or base64)
4. Respect for plan limits and rate limits

## Monitoring

The deployment process emits events that can be monitored:
- `deployment:status` - Status changes during deployment
- `sandbox:created` - When a new sandbox is created
- `sandbox:error` - When sandbox operations fail
- `sandbox:cleanup` - When sandboxes are cleaned up

## Production Considerations

1. **Database Connection**: Ensure PostgreSQL is configured and accessible
2. **AgentSphere Integration**: Verify sandbox service is available
3. **Rate Limiting**: Configure appropriate limits for production load
4. **Monitoring**: Set up logging and alerting for deployment failures
5. **Cleanup**: Automatic sandbox cleanup runs every 5 minutes by default