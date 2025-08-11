import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { ManifestEngine } from '../services/manifestEngine';
import * as yaml from 'js-yaml';

const router = Router();
const manifestEngine = ManifestEngine.getInstance();

/**
 * GET /api/manifest/templates
 * Get available manifest templates
 */
router.get('/templates', (req, res) => {
  try {
    // For now, return static templates until enhanced engine is integrated
    const templates = [
      {
        id: 'blog',
        name: 'Blog System',
        description: 'Complete blog with posts, comments, and users',
        category: 'web',
        complexity: 'moderate',
        estimatedTime: '10-15 minutes',
        tags: ['blog', 'cms', 'authentication']
      },
      {
        id: 'todo',
        name: 'Todo App',
        description: 'Task management system with projects and categories',
        category: 'web',
        complexity: 'simple',
        estimatedTime: '5-10 minutes',
        tags: ['todo', 'productivity', 'tasks']
      },
      {
        id: 'ecommerce',
        name: 'E-commerce API',
        description: 'Product catalog with orders and inventory',
        category: 'enterprise',
        complexity: 'complex',
        estimatedTime: '20-30 minutes',
        tags: ['ecommerce', 'products', 'orders', 'inventory']
      },
      {
        id: 'user-management',
        name: 'User Management',
        description: 'Complete user system with roles and permissions',
        category: 'enterprise',
        complexity: 'moderate',
        estimatedTime: '15-20 minutes',
        tags: ['users', 'authentication', 'roles', 'permissions']
      }
    ];

    res.json({
      success: true,
      data: templates,
      count: templates.length
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch templates'
    });
  }
});

/**
 * GET /api/manifest/templates/:id
 * Get specific template manifest
 */
router.get('/templates/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    // Return sample manifests for now
    const templates: { [key: string]: any } = {
      blog: {
        name: 'Blog System',
        version: '1.0.0',
        description: 'Complete blog platform with users, posts, and comments',
        authentication: {
          enabled: true,
          type: 'jwt',
          expiresIn: '7d'
        },
        entities: [
          {
            name: 'User',
            fields: [
              { name: 'email', type: 'email', required: true, unique: true },
              { name: 'username', type: 'text', required: true, unique: true, minLength: 3, maxLength: 30 },
              { name: 'firstName', type: 'text', required: true },
              { name: 'lastName', type: 'text', required: true },
              { name: 'isActive', type: 'boolean', defaultValue: true }
            ]
          },
          {
            name: 'Post',
            fields: [
              { name: 'title', type: 'text', required: true, maxLength: 200 },
              { name: 'content', type: 'longtext', required: true },
              { name: 'status', type: 'enum', enumValues: ['draft', 'published', 'archived'], defaultValue: 'draft' },
              { name: 'authorId', type: 'reference', reference: 'User', required: true }
            ]
          }
        ]
      },
      todo: {
        name: 'Todo API',
        version: '1.0.0',
        description: 'Simple task management system',
        entities: [
          {
            name: 'Task',
            fields: [
              { name: 'title', type: 'text', required: true, maxLength: 200 },
              { name: 'description', type: 'longtext' },
              { name: 'priority', type: 'enum', enumValues: ['low', 'medium', 'high', 'urgent'], defaultValue: 'medium' },
              { name: 'status', type: 'enum', enumValues: ['todo', 'in-progress', 'done'], defaultValue: 'todo' },
              { name: 'dueDate', type: 'datetime' },
              { name: 'isCompleted', type: 'boolean', defaultValue: false }
            ]
          }
        ]
      }
    };

    const template = templates[id];
    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    res.json({
      success: true,
      data: {
        id,
        manifest: template,
        yaml: yaml.dump(template, { indent: 2 })
      }
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch template'
    });
  }
});

/**
 * POST /api/manifest/validate
 * Validate manifest YAML content
 */
router.post('/validate', (req, res) => {
  try {
    const { manifest } = req.body;
    
    if (!manifest) {
      return res.status(400).json({
        success: false,
        error: 'Manifest content is required'
      });
    }

    // Basic YAML validation
    let parsed;
    try {
      parsed = yaml.load(manifest);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid YAML syntax',
        details: error instanceof Error ? error.message : 'Unknown YAML error'
      });
    }

    // Enhanced validation logic (simplified)
    const errors = [];
    
    if (!parsed.name) {
      errors.push({ field: 'name', message: 'Name is required' });
    }
    
    if (!parsed.entities || !Array.isArray(parsed.entities)) {
      errors.push({ field: 'entities', message: 'Entities array is required' });
    } else if (parsed.entities.length === 0) {
      errors.push({ field: 'entities', message: 'At least one entity is required' });
    } else {
      // Validate entities
      parsed.entities.forEach((entity: any, index: number) => {
        if (!entity.name) {
          errors.push({ field: `entities[${index}].name`, message: 'Entity name is required' });
        }
        
        if (entity.fields && Array.isArray(entity.fields)) {
          entity.fields.forEach((field: any, fieldIndex: number) => {
            if (!field.name) {
              errors.push({ 
                field: `entities[${index}].fields[${fieldIndex}].name`, 
                message: 'Field name is required' 
              });
            }
            
            const validTypes = ['text', 'longtext', 'number', 'boolean', 'date', 'datetime', 'email', 'url', 'enum', 'array', 'reference'];
            if (field.type && !validTypes.includes(field.type)) {
              errors.push({
                field: `entities[${index}].fields[${fieldIndex}].type`,
                message: `Invalid field type "${field.type}". Valid types: ${validTypes.join(', ')}`
              });
            }
            
            // Validate enum fields
            if (field.type === 'enum' && (!field.enumValues || !Array.isArray(field.enumValues) || field.enumValues.length === 0)) {
              errors.push({
                field: `entities[${index}].fields[${fieldIndex}].enumValues`,
                message: 'Enum fields must have enumValues array'
              });
            }
            
            // Validate reference fields
            if (field.type === 'reference' && !field.reference) {
              errors.push({
                field: `entities[${index}].fields[${fieldIndex}].reference`,
                message: 'Reference fields must have reference property'
              });
            }
          });
        }
      });
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Manifest validation failed',
        errors
      });
    }

    // Generate analysis
    const analysis = {
      entities: parsed.entities.length,
      totalFields: parsed.entities.reduce((sum: number, entity: any) => sum + (entity.fields?.length || 0), 0),
      fieldTypes: new Set(),
      hasAuth: !!parsed.authentication?.enabled,
      complexity: 'simple'
    };

    parsed.entities.forEach((entity: any) => {
      if (entity.fields) {
        entity.fields.forEach((field: any) => {
          analysis.fieldTypes.add(field.type || 'text');
        });
      }
    });

    // Determine complexity
    if (analysis.entities > 3 || analysis.totalFields > 15 || analysis.hasAuth) {
      analysis.complexity = 'moderate';
    }
    if (analysis.entities > 5 || analysis.totalFields > 25) {
      analysis.complexity = 'complex';
    }

    res.json({
      success: true,
      data: {
        valid: true,
        analysis: {
          ...analysis,
          fieldTypes: Array.from(analysis.fieldTypes)
        }
      }
    });

  } catch (error) {
    console.error('Error validating manifest:', error);
    res.status(500).json({
      success: false,
      error: 'Internal validation error'
    });
  }
});

/**
 * POST /api/manifest/generate
 * Generate project from manifest (protected route)
 */
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const { manifest } = req.body;
    
    if (!manifest) {
      return res.status(400).json({
        success: false,
        error: 'Manifest content is required'
      });
    }

    const startTime = Date.now();
    
    // Use existing ManifestEngine
    const files = manifestEngine.generateProject(manifest);
    
    const endTime = Date.now();
    const duration = endTime - startTime;

    res.json({
      success: true,
      data: {
        files,
        metadata: {
          generatedAt: new Date().toISOString(),
          duration: `${duration}ms`,
          fileCount: files.length,
          performance: duration < 100 ? 'excellent' : duration < 500 ? 'good' : 'needs optimization'
        }
      }
    });

  } catch (error) {
    console.error('Error generating project:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Generation failed'
    });
  }
});

/**
 * GET /api/manifest/field-types
 * Get supported field types and validation rules
 */
router.get('/field-types', (req, res) => {
  try {
    const fieldTypes = [
      {
        type: 'text',
        description: 'Short text field',
        validations: ['required', 'unique', 'minLength', 'maxLength', 'pattern'],
        example: 'username'
      },
      {
        type: 'longtext',
        description: 'Long text field for content',
        validations: ['required', 'minLength', 'maxLength'],
        example: 'description'
      },
      {
        type: 'number',
        description: 'Numeric field',
        validations: ['required', 'min', 'max'],
        example: 'age'
      },
      {
        type: 'boolean',
        description: 'True/false field',
        validations: ['required', 'defaultValue'],
        example: 'isActive'
      },
      {
        type: 'date',
        description: 'Date field (YYYY-MM-DD)',
        validations: ['required'],
        example: 'birthDate'
      },
      {
        type: 'datetime',
        description: 'Date and time field',
        validations: ['required'],
        example: 'createdAt'
      },
      {
        type: 'email',
        description: 'Email address field',
        validations: ['required', 'unique'],
        example: 'user@example.com'
      },
      {
        type: 'url',
        description: 'URL field',
        validations: ['required'],
        example: 'website'
      },
      {
        type: 'enum',
        description: 'Select from predefined options',
        validations: ['required', 'enumValues', 'defaultValue'],
        example: 'status'
      },
      {
        type: 'array',
        description: 'Array of values',
        validations: ['required'],
        example: 'tags'
      },
      {
        type: 'reference',
        description: 'Reference to another entity',
        validations: ['required', 'reference'],
        example: 'userId'
      }
    ];

    res.json({
      success: true,
      data: fieldTypes,
      count: fieldTypes.length
    });
  } catch (error) {
    console.error('Error fetching field types:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch field types'
    });
  }
});

export default router;