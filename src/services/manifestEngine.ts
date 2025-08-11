import * as yaml from 'js-yaml';
import { ManifestConfig, ManifestEntity, ManifestField, GeneratedFile } from '../types/index';

/**
 * ManifestEngine - Generates complete Express.js backend projects from manifest.yaml
 * 
 * This service takes a manifest.yaml file and generates:
 * - package.json with dependencies
 * - index.js with Express server and all CRUD routes
 * - database.js with LowDB setup and helper functions
 * - .env with environment variables
 * - README.md with basic documentation
 * 
 * The generated project is self-contained and ready to run in AgentSphere sandboxes.
 */
export class ManifestEngine {
  private static instance: ManifestEngine;

  private constructor() {
    console.log('ManifestEngine initialized');
  }

  public static getInstance(): ManifestEngine {
    if (!ManifestEngine.instance) {
      ManifestEngine.instance = new ManifestEngine();
    }
    return ManifestEngine.instance;
  }

  /**
   * Generate a complete Express.js project from manifest.yaml content
   * 
   * @param manifestContent - Raw YAML content from manifest.yaml
   * @returns Array of generated files ready for deployment
   */
  public generateProject(manifestContent: string): GeneratedFile[] {
    console.log('ManifestEngine: Generating project from manifest');

    // Parse the manifest YAML
    const manifest = this.parseManifest(manifestContent);
    console.log('ManifestEngine: Parsed manifest:', JSON.stringify(manifest, null, 2));

    // Generate all project files
    const files: GeneratedFile[] = [
      this.generatePackageJson(manifest),
      this.generateMainServer(manifest),
      this.generateDatabase(manifest),
      this.generateEnvFile(),
      this.generateReadme(manifest)
    ];

    console.log(`ManifestEngine: Generated ${files.length} files for project "${manifest.name}"`);
    return files;
  }

  /**
   * Parse manifest YAML content into structured config
   */
  public parseManifest(manifestContent: string): ManifestConfig {
    try {
      const parsed = yaml.load(manifestContent) as any;

      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid manifest structure');
      }

      if (!parsed.name || typeof parsed.name !== 'string') {
        throw new Error('Manifest must have a valid name field');
      }

      if (!parsed.entities || !Array.isArray(parsed.entities)) {
        throw new Error('Manifest must have an entities array');
      }

      // Transform entities to our expected structure
      const entities: ManifestEntity[] = parsed.entities.map((entity: any) => {
        if (!entity.name || typeof entity.name !== 'string') {
          throw new Error('Each entity must have a valid name');
        }

        // Handle empty fields - allow undefined/null or empty array
        if (entity.fields && !Array.isArray(entity.fields)) {
          throw new Error(`Entity "${entity.name}" fields must be an array`);
        }
        
        // Default to empty array if fields is undefined/null
        const rawFields = entity.fields || [];

        const fields: ManifestField[] = rawFields.map((field: any) => {
          if (!field.name || typeof field.name !== 'string') {
            throw new Error(`Fields in entity "${entity.name}" must have valid names`);
          }

          // Validate field type, default to 'string' for invalid types
          const validTypes = ['string', 'number', 'boolean', 'date'];
          const fieldType = field.type && validTypes.includes(field.type) ? field.type : 'string';

          return {
            name: field.name,
            type: fieldType,
            required: field.required || false
          };
        });

        return {
          name: entity.name,
          fields
        };
      });

      return {
        name: parsed.name,
        version: parsed.version || '1.0.0',
        entities
      };
    } catch (error) {
      console.error('ManifestEngine: Failed to parse manifest:', error);
      throw new Error(`Failed to parse manifest: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate package.json with all necessary dependencies
   */
  private generatePackageJson(manifest: ManifestConfig): GeneratedFile {
    const packageJson = {
      name: manifest.name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      version: manifest.version || '1.0.0',
      description: `Generated Express.js API for ${manifest.name}`,
      main: 'index.js',
      scripts: {
        start: 'node index.js',
        dev: 'node index.js',
        test: 'echo "No tests specified" && exit 0'
      },
      dependencies: {
        express: '^4.18.2',
        cors: '^2.8.5',
        lowdb: '^7.0.1',
        uuid: '^9.0.0'
      },
      engines: {
        node: '>=18.0.0'
      },
      keywords: [
        'express',
        'api',
        'crud',
        'manifest-generated'
      ]
    };

    return {
      path: 'package.json',
      content: JSON.stringify(packageJson, null, 2)
    };
  }

  /**
   * Generate the main Express server with all CRUD routes
   */
  private generateMainServer(manifest: ManifestConfig): GeneratedFile {
    const serverCode = `const express = require('express');
const cors = require('cors');
const { initDatabase, db, createRecord, getAllRecords, getRecordById, updateRecord, deleteRecord } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
initDatabase();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    message: 'Generated Express API for ${manifest.name}',
    timestamp: new Date().toISOString()
  });
});

// API Info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: '${manifest.name}',
    version: '${manifest.version}',
    description: 'Generated Express API with CRUD operations',
    entities: [${manifest.entities.map(entity => `'${entity.name.toLowerCase()}'`).join(', ')}],
    endpoints: {
${manifest.entities.map(entity => {
    const entityName = entity.name.toLowerCase();
    const pluralName = this.pluralize(entityName);
    return `      '${pluralName}': {
        'GET /api/${pluralName}': 'List all ${pluralName}',
        'GET /api/${pluralName}/:id': 'Get ${entityName} by ID',
        'POST /api/${pluralName}': 'Create new ${entityName}',
        'PUT /api/${pluralName}/:id': 'Update ${entityName}',
        'DELETE /api/${pluralName}/:id': 'Delete ${entityName}'
      }`;
  }).join(',\n')}
    }
  });
});

${manifest.entities.map(entity => this.generateEntityRoutes(entity)).join('\n\n')}

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    message: 'Use GET /api to see available endpoints',
    success: false
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: 'Something went wrong',
    success: false
  });
});

app.listen(PORT, () => {
  console.log(\`🚀 ${manifest.name} API server running on port \${PORT}\`);
  console.log(\`📚 API documentation: http://localhost:\${PORT}/api\`);
  console.log(\`❤️ Health check: http://localhost:\${PORT}/health\`);
});

module.exports = app;`;

    return {
      path: 'index.js',
      content: serverCode
    };
  }

  /**
   * Generate CRUD routes for a single entity
   */
  private generateEntityRoutes(entity: ManifestEntity): string {
    const entityName = entity.name.toLowerCase();
    const pluralName = this.pluralize(entityName);
    const capitalizedName = entity.name;

    // Get required fields for validation
    const requiredFields = entity.fields.filter(field => field.required);
    const validationCode = requiredFields.length > 0 
      ? `  // Validate required fields
  const missingFields = [];
  ${requiredFields.map(field => 
    `if (!req.body['${field.name}']) missingFields.push('${field.name}');`
  ).join('\n  ')}
  
  if (missingFields.length > 0) {
    return res.status(400).json({ 
      error: 'Missing required fields', 
      missingFields,
      success: false 
    });
  }`
      : '  // No required fields validation needed';

    return `// ${capitalizedName} routes
app.get('/api/${pluralName}', (req, res) => {
  try {
    const records = getAllRecords('${pluralName}');
    res.json({ 
      data: records, 
      count: records.length,
      success: true 
    });
  } catch (error) {
    console.error('Error fetching ${pluralName}:', error);
    res.status(500).json({ 
      error: 'Failed to fetch ${pluralName}',
      success: false 
    });
  }
});

app.get('/api/${pluralName}/:id', (req, res) => {
  try {
    const record = getRecordById('${pluralName}', req.params.id);
    if (!record) {
      return res.status(404).json({ 
        error: '${capitalizedName} not found',
        success: false 
      });
    }
    res.json({ 
      data: record, 
      success: true 
    });
  } catch (error) {
    console.error('Error fetching ${entityName}:', error);
    res.status(500).json({ 
      error: 'Failed to fetch ${entityName}',
      success: false 
    });
  }
});

app.post('/api/${pluralName}', (req, res) => {
  try {
${validationCode}

    const newRecord = createRecord('${pluralName}', req.body);
    res.status(201).json({ 
      data: newRecord, 
      success: true,
      message: '${capitalizedName} created successfully'
    });
  } catch (error) {
    console.error('Error creating ${entityName}:', error);
    res.status(500).json({ 
      error: 'Failed to create ${entityName}',
      success: false 
    });
  }
});

app.put('/api/${pluralName}/:id', (req, res) => {
  try {
    const updatedRecord = updateRecord('${pluralName}', req.params.id, req.body);
    if (!updatedRecord) {
      return res.status(404).json({ 
        error: '${capitalizedName} not found',
        success: false 
      });
    }
    res.json({ 
      data: updatedRecord, 
      success: true,
      message: '${capitalizedName} updated successfully'
    });
  } catch (error) {
    console.error('Error updating ${entityName}:', error);
    res.status(500).json({ 
      error: 'Failed to update ${entityName}',
      success: false 
    });
  }
});

app.delete('/api/${pluralName}/:id', (req, res) => {
  try {
    const deleted = deleteRecord('${pluralName}', req.params.id);
    if (!deleted) {
      return res.status(404).json({ 
        error: '${capitalizedName} not found',
        success: false 
      });
    }
    res.json({ 
      success: true,
      message: '${capitalizedName} deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting ${entityName}:', error);
    res.status(500).json({ 
      error: 'Failed to delete ${entityName}',
      success: false 
    });
  }
});`;
  }

  /**
   * Generate database.js with LowDB setup and helper functions
   */
  private generateDatabase(manifest: ManifestConfig): GeneratedFile {
    const dbCode = `const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

// Initialize LowDB
let db;

/**
 * Initialize the database
 */
function initDatabase() {
  try {
    // Create data directory if it doesn't exist
    if (!fs.existsSync('./data')) {
      fs.mkdirSync('./data');
    }

    const adapter = new JSONFile('./data/db.json');
    db = new Low(adapter, {});

    // Initialize database with default structure
    return db.read().then(() => {
      // Set default data structure
      db.data = db.data || {};
      
      // Initialize collections for each entity
      ${manifest.entities.map(entity => {
    const pluralName = this.pluralize(entity.name.toLowerCase());
    return `db.data.${pluralName} = db.data.${pluralName} || [];`;
  }).join('\n      ')}

      return db.write();
    }).then(() => {
      console.log('✅ Database initialized successfully');
      console.log('📁 Database file: ./data/db.json');
    });
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Create a new record in the specified collection
 * @param {string} collection - The collection name
 * @param {object} data - The record data
 * @returns {object} The created record with ID and timestamps
 */
function createRecord(collection, data) {
  if (!db || !db.data) {
    throw new Error('Database not initialized');
  }

  if (!db.data[collection]) {
    db.data[collection] = [];
  }

  const record = {
    id: uuidv4(),
    ...data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.data[collection].push(record);
  db.write();

  console.log(\`✅ Created record in \${collection}:\`, record.id);
  return record;
}

/**
 * Get all records from the specified collection
 * @param {string} collection - The collection name
 * @returns {array} All records in the collection
 */
function getAllRecords(collection) {
  if (!db || !db.data) {
    throw new Error('Database not initialized');
  }

  return db.data[collection] || [];
}

/**
 * Get a single record by ID
 * @param {string} collection - The collection name
 * @param {string} id - The record ID
 * @returns {object|null} The record or null if not found
 */
function getRecordById(collection, id) {
  if (!db || !db.data) {
    throw new Error('Database not initialized');
  }

  const records = db.data[collection] || [];
  return records.find(record => record.id === id) || null;
}

/**
 * Update a record by ID
 * @param {string} collection - The collection name
 * @param {string} id - The record ID
 * @param {object} updates - The fields to update
 * @returns {object|null} The updated record or null if not found
 */
function updateRecord(collection, id, updates) {
  if (!db || !db.data) {
    throw new Error('Database not initialized');
  }

  const records = db.data[collection] || [];
  const index = records.findIndex(record => record.id === id);

  if (index === -1) {
    return null;
  }

  // Update the record
  records[index] = {
    ...records[index],
    ...updates,
    id, // Preserve the original ID
    createdAt: records[index].createdAt, // Preserve creation time
    updatedAt: new Date().toISOString()
  };

  db.write();

  console.log(\`✅ Updated record in \${collection}:\`, id);
  return records[index];
}

/**
 * Delete a record by ID
 * @param {string} collection - The collection name
 * @param {string} id - The record ID
 * @returns {boolean} True if deleted, false if not found
 */
function deleteRecord(collection, id) {
  if (!db || !db.data) {
    throw new Error('Database not initialized');
  }

  const records = db.data[collection] || [];
  const index = records.findIndex(record => record.id === id);

  if (index === -1) {
    return false;
  }

  records.splice(index, 1);
  db.write();

  console.log(\`✅ Deleted record from \${collection}:\`, id);
  return true;
}

module.exports = {
  db: () => db,
  initDatabase,
  createRecord,
  getAllRecords,
  getRecordById,
  updateRecord,
  deleteRecord
};`;

    return {
      path: 'database.js',
      content: dbCode
    };
  }

  /**
   * Generate .env file with environment variables
   */
  private generateEnvFile(): GeneratedFile {
    return {
      path: '.env',
      content: `# Generated Environment Configuration
PORT=3000
NODE_ENV=production

# Database
DB_FILE=./data/db.json

# Application
APP_NAME=Manifest Generated API
APP_VERSION=1.0.0`
    };
  }

  /**
   * Generate README.md with basic documentation
   */
  private generateReadme(manifest: ManifestConfig): GeneratedFile {
    const readmeContent = `# ${manifest.name}

> Generated Express.js API with CRUD operations

This is an auto-generated Express.js backend API based on your manifest configuration.

## 🚀 Quick Start

\`\`\`bash
# Install dependencies
npm install

# Start the server
npm start
\`\`\`

The server will start on port 3000 (or the PORT environment variable).

## 📚 API Documentation

### Base URLs
- Health Check: \`GET /health\`
- API Info: \`GET /api\`

### Available Entities

${manifest.entities.map(entity => {
    const entityName = entity.name.toLowerCase();
    const pluralName = this.pluralize(entityName);
  
    return `#### ${entity.name}

**Endpoints:**
- \`GET /api/${pluralName}\` - List all ${pluralName}
- \`GET /api/${pluralName}/:id\` - Get ${entityName} by ID  
- \`POST /api/${pluralName}\` - Create new ${entityName}
- \`PUT /api/${pluralName}/:id\` - Update ${entityName}
- \`DELETE /api/${pluralName}/:id\` - Delete ${entityName}

**Fields:**
${entity.fields.map(field => 
    `- \`${field.name}\`: ${field.type}${field.required ? ' (required)' : ''}`
  ).join('\n')}

**Example JSON:**
\`\`\`json
{
${entity.fields.map(field => {
    let exampleValue: any;
    switch (field.type) {
    case 'text': exampleValue = `"example ${field.name}"`; break;
    case 'longtext': exampleValue = `"This is a longer text field for ${field.name}"`; break;
    case 'number': exampleValue = '123'; break;
    case 'boolean': exampleValue = 'true'; break;
    case 'date': exampleValue = '"2023-12-01T00:00:00.000Z"'; break;
    case 'datetime': exampleValue = '"2023-12-01T10:30:00.000Z"'; break;
    case 'email': exampleValue = '"user@example.com"'; break;
    case 'url': exampleValue = '"https://example.com"'; break;
    case 'enum': exampleValue = '"option1"'; break;
    case 'array': exampleValue = '["item1", "item2"]'; break;
    case 'reference': exampleValue = '"uuid-reference-id"'; break;
    default: exampleValue = `"example ${field.name}"`;
    }
    return `  "${field.name}": ${exampleValue}`;
  }).join(',\n')}
}
\`\`\``;
  }).join('\n\n')}

## 🗄️ Database

This API uses LowDB for data persistence. Data is stored in \`./data/db.json\`.

## 📄 Response Format

All API endpoints return responses in the following format:

**Success Response:**
\`\`\`json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
\`\`\`

**Error Response:**
\`\`\`json
{
  "success": false,
  "error": "Error message",
  "message": "Human readable message"
}
\`\`\`

## 🛠️ Generated from Manifest

This API was generated from the following manifest configuration:

**Version:** ${manifest.version}  
**Entities:** ${manifest.entities.length}  
**Generated:** ${new Date().toISOString()}

---
*This project was generated by CodeRunner ManifestEngine*`;

    return {
      path: 'README.md',
      content: readmeContent
    };
  }

  /**
   * Simple pluralization helper
   */
  private pluralize(word: string): string {
    // Handle common irregular plurals
    const irregulars: { [key: string]: string } = {
      'child': 'children',
      'person': 'people',
      'man': 'men',
      'woman': 'women',
      'tooth': 'teeth',
      'foot': 'feet',
      'mouse': 'mice',
      'goose': 'geese'
    };
    
    if (irregulars[word.toLowerCase()]) {
      return irregulars[word.toLowerCase()];
    }
    
    // Simple English pluralization rules
    if (word.endsWith('y') && !['a', 'e', 'i', 'o', 'u'].includes(word[word.length - 2])) {
      return word.slice(0, -1) + 'ies';
    }
    if (word.endsWith('s') || word.endsWith('sh') || word.endsWith('ch') || word.endsWith('x') || word.endsWith('z')) {
      return word + 'es';
    }
    if (word.endsWith('f')) {
      return word.slice(0, -1) + 'ves';
    }
    if (word.endsWith('fe')) {
      return word.slice(0, -2) + 'ves';
    }
    return word + 's';
  }
}