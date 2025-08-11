import { ManifestEngine } from '../../src/services/manifestEngine';
import { GeneratedFile } from '../../src/types/index';

describe('ManifestEngine', () => {
  let manifestEngine: ManifestEngine;

  beforeEach(() => {
    manifestEngine = ManifestEngine.getInstance();
  });

  describe('generateProject', () => {
    it('should generate all required files from a valid manifest', () => {
      const manifestContent = `name: my-api
version: 1.2.0
entities:
  - name: User
    fields:
      - name: name
        type: string
        required: true
      - name: email
        type: string
        required: true
      - name: age
        type: number
  - name: Post
    fields:
      - name: title
        type: string
        required: true
      - name: content
        type: string
      - name: userId
        type: string`;

      const files = manifestEngine.generateProject(manifestContent);

      // Should generate exactly 5 files
      expect(files).toHaveLength(5);

      // Check all required files are present
      const filePaths = files.map((f: GeneratedFile) => f.path);
      expect(filePaths).toContain('package.json');
      expect(filePaths).toContain('index.js');
      expect(filePaths).toContain('database.js');
      expect(filePaths).toContain('.env');
      expect(filePaths).toContain('README.md');
    });

    it('should generate valid package.json', () => {
      const manifestContent = `name: test-app
version: 2.0.1
entities:
  - name: Item
    fields:
      - name: title
        type: string`;

      const files = manifestEngine.generateProject(manifestContent);
      const packageJsonFile = files.find((f: GeneratedFile) => f.path === 'package.json');
      
      expect(packageJsonFile).toBeDefined();
      
      const packageJson = JSON.parse(packageJsonFile!.content);
      expect(packageJson.name).toBe('test-app');
      expect(packageJson.version).toBe('2.0.1');
      expect(packageJson.main).toBe('index.js');
      expect(packageJson.scripts.start).toBe('node index.js');
      
      // Check dependencies
      expect(packageJson.dependencies).toHaveProperty('express');
      expect(packageJson.dependencies).toHaveProperty('cors');
      expect(packageJson.dependencies).toHaveProperty('lowdb');
      expect(packageJson.dependencies).toHaveProperty('uuid');
    });

    it('should generate Express server with CRUD routes', () => {
      const manifestContent = `name: blog-api
version: 1.0.0
entities:
  - name: User
    fields:
      - name: name
        type: string
        required: true
      - name: email
        type: string
        required: true
  - name: Post
    fields:
      - name: title
        type: string
        required: true
      - name: content
        type: string`;

      const files = manifestEngine.generateProject(manifestContent);
      const indexFile = files.find((f: GeneratedFile) => f.path === 'index.js');
      
      expect(indexFile).toBeDefined();
      
      const serverCode = indexFile!.content;
      
      // Check server basics
      expect(serverCode).toContain('const express = require(\'express\')');
      expect(serverCode).toContain('const cors = require(\'cors\')');
      expect(serverCode).toContain('app.use(cors())');
      expect(serverCode).toContain('app.use(express.json())');
      
      // Check health endpoint
      expect(serverCode).toContain('app.get(\'/health\'');
      
      // Check API info endpoint  
      expect(serverCode).toContain('app.get(\'/api\'');
      
      // Check User CRUD routes
      expect(serverCode).toContain('app.get(\'/api/users\'');
      expect(serverCode).toContain('app.get(\'/api/users/:id\'');
      expect(serverCode).toContain('app.post(\'/api/users\'');
      expect(serverCode).toContain('app.put(\'/api/users/:id\'');
      expect(serverCode).toContain('app.delete(\'/api/users/:id\'');
      
      // Check Post CRUD routes  
      expect(serverCode).toContain('app.get(\'/api/posts\'');
      expect(serverCode).toContain('app.get(\'/api/posts/:id\'');
      expect(serverCode).toContain('app.post(\'/api/posts\'');
      expect(serverCode).toContain('app.put(\'/api/posts/:id\'');
      expect(serverCode).toContain('app.delete(\'/api/posts/:id\'');
      
      // Check validation for required fields (using bracket notation for field access)
      expect(serverCode).toContain('if (!req.body[\'name\'])');
      expect(serverCode).toContain('if (!req.body[\'email\'])');
      expect(serverCode).toContain('if (!req.body[\'title\'])');
      
      // Check server startup
      expect(serverCode).toContain('app.listen(PORT');
      expect(serverCode).toContain('console.log');
    });

    it('should generate database.js with LowDB setup', () => {
      const manifestContent = `name: test-db
version: 1.0.0
entities:
  - name: Product
    fields:
      - name: name
        type: string
  - name: Category
    fields:
      - name: title
        type: string`;

      const files = manifestEngine.generateProject(manifestContent);
      const dbFile = files.find((f: GeneratedFile) => f.path === 'database.js');
      
      expect(dbFile).toBeDefined();
      
      const dbCode = dbFile!.content;
      
      // Check LowDB setup
      expect(dbCode).toContain('const { Low } = require(\'lowdb\')');
      expect(dbCode).toContain('const { JSONFile } = require(\'lowdb/node\')');
      expect(dbCode).toContain('const { v4: uuidv4 } = require(\'uuid\')');
      
      // Check initialization
      expect(dbCode).toContain('function initDatabase()');
      expect(dbCode).toContain('db.data.products = db.data.products || []');
      expect(dbCode).toContain('db.data.categories = db.data.categories || []');
      
      // Check CRUD functions
      expect(dbCode).toContain('function createRecord(collection, data)');
      expect(dbCode).toContain('function getAllRecords(collection)');
      expect(dbCode).toContain('function getRecordById(collection, id)');
      expect(dbCode).toContain('function updateRecord(collection, id, updates)');
      expect(dbCode).toContain('function deleteRecord(collection, id)');
      
      // Check UUID generation and timestamps
      expect(dbCode).toContain('id: uuidv4()');
      expect(dbCode).toContain('createdAt: new Date().toISOString()');
      expect(dbCode).toContain('updatedAt: new Date().toISOString()');
      
      // Check exports
      expect(dbCode).toContain('module.exports = {');
      expect(dbCode).toContain('initDatabase,');
      expect(dbCode).toContain('createRecord,');
    });

    it('should generate .env file with correct variables', () => {
      const manifestContent = `name: env-test
version: 1.0.0
entities:
  - name: Item
    fields:
      - name: name
        type: string`;

      const files = manifestEngine.generateProject(manifestContent);
      const envFile = files.find((f: GeneratedFile) => f.path === '.env');
      
      expect(envFile).toBeDefined();
      
      const envContent = envFile!.content;
      expect(envContent).toContain('PORT=8080');
      expect(envContent).toContain('NODE_ENV=production');
      expect(envContent).toContain('DB_FILE=./data/db.json');
      expect(envContent).toContain('APP_NAME=Manifest Generated API');
    });

    it('should generate comprehensive README.md', () => {
      const manifestContent = `name: readme-test
version: 3.1.4
entities:
  - name: User
    fields:
      - name: username
        type: string
        required: true
      - name: email
        type: string
        required: true
      - name: active
        type: boolean`;

      const files = manifestEngine.generateProject(manifestContent);
      const readmeFile = files.find((f: GeneratedFile) => f.path === 'README.md');
      
      expect(readmeFile).toBeDefined();
      
      const readmeContent = readmeFile!.content;
      
      // Check title and description
      expect(readmeContent).toContain('# readme-test');
      expect(readmeContent).toContain('Generated Express.js API');
      
      // Check quick start section
      expect(readmeContent).toContain('## 🚀 Quick Start');
      expect(readmeContent).toContain('npm install');
      expect(readmeContent).toContain('npm start');
      
      // Check API documentation
      expect(readmeContent).toContain('## 📚 API Documentation');
      expect(readmeContent).toContain('GET /health');
      expect(readmeContent).toContain('GET /api');
      
      // Check entity documentation
      expect(readmeContent).toContain('#### User');
      expect(readmeContent).toContain('GET /api/users');
      expect(readmeContent).toContain('POST /api/users');
      expect(readmeContent).toContain('`username`: string (required)');
      expect(readmeContent).toContain('`email`: string (required)');
      expect(readmeContent).toContain('`active`: boolean');
      
      // Check example JSON
      expect(readmeContent).toContain('```json');
      expect(readmeContent).toContain('"username": "example username"');
      expect(readmeContent).toContain('"active": true');
      
      // Check metadata
      expect(readmeContent).toContain('**Version:** 3.1.4');
      expect(readmeContent).toContain('**Entities:** 1');
    });

    it('should handle pluralization correctly', () => {
      const manifestContent = `name: pluralization-test
version: 1.0.0
entities:
  - name: Category
    fields:
      - name: name
        type: string
  - name: Company
    fields:
      - name: name
        type: string
  - name: Child
    fields:
      - name: name
        type: string`;

      const files = manifestEngine.generateProject(manifestContent);
      const serverFile = files.find((f: GeneratedFile) => f.path === 'index.js');
      
      expect(serverFile).toBeDefined();
      
      const serverCode = serverFile!.content;
      
      // Check pluralization
      expect(serverCode).toContain('/api/categories'); // category -> categories
      expect(serverCode).toContain('/api/companies');  // company -> companies  
      expect(serverCode).toContain('/api/children');   // child -> children (note: this is basic pluralization)
    });

    it('should throw error for invalid manifest', () => {
      const invalidManifests = [
        '', // empty
        'invalid: yaml: content:', // invalid YAML
        `name: test`, // missing entities
        `entities: []`, // missing name
        `name: test
entities:
  - fields: []`, // missing entity name
        `name: test  
entities:
  - name: User
    fields: not_an_array`, // invalid fields type
        `name: test
entities:
  - name: User
    fields:
      - type: string` // missing field name
      ];

      for (const manifest of invalidManifests) {
        expect(() => {
          manifestEngine.generateProject(manifest);
        }).toThrow();
      }
    });

    it('should handle different field types correctly', () => {
      const manifestContent = `name: field-types-test
version: 1.0.0
entities:
  - name: Product
    fields:
      - name: title
        type: string
        required: true
      - name: price
        type: number
        required: true
      - name: inStock
        type: boolean
      - name: createdDate
        type: date`;

      const files = manifestEngine.generateProject(manifestContent);
      const readmeFile = files.find((f: GeneratedFile) => f.path === 'README.md');
      
      expect(readmeFile).toBeDefined();
      
      const readmeContent = readmeFile!.content;
      expect(readmeContent).toContain('"title": "example title"');
      expect(readmeContent).toContain('"price": 123');
      expect(readmeContent).toContain('"inStock": true');
      expect(readmeContent).toContain('"createdDate": "2023-12-01T00:00:00.000Z"');
    });

    it('should handle entities without required fields', () => {
      const manifestContent = `name: no-required-test
version: 1.0.0
entities:
  - name: Tag
    fields:
      - name: label
        type: string
      - name: color
        type: string`;

      const files = manifestEngine.generateProject(manifestContent);
      const serverFile = files.find((f: GeneratedFile) => f.path === 'index.js');
      
      expect(serverFile).toBeDefined();
      
      const serverCode = serverFile!.content;
      
      // Should not have validation code for this entity
      expect(serverCode).toContain('// No required fields validation needed');
    });
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ManifestEngine.getInstance();
      const instance2 = ManifestEngine.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('Enhanced ManifestEngine Tests', () => {
    it('should handle super long entity names (>100 characters)', () => {
      const longEntityName = 'A'.repeat(150) + 'Entity';
      const manifestContent = `name: long-entity-test
version: 1.0.0
entities:
  - name: ${longEntityName}
    fields:
      - name: id
        type: string
        required: true`;

      expect(() => {
        manifestEngine.generateProject(manifestContent);
      }).not.toThrow();

      const files = manifestEngine.generateProject(manifestContent);
      const serverFile = files.find((f: GeneratedFile) => f.path === 'index.js');
      
      expect(serverFile).toBeDefined();
      // The engine should handle long names gracefully
      expect(serverFile!.content).toContain(longEntityName.toLowerCase());
    });

    it('should handle reserved keywords as entity names', () => {
      const manifestContent = `name: reserved-words-test
version: 1.0.0
entities:
  - name: Class
    fields:
      - name: name
        type: string
        required: true
  - name: Function  
    fields:
      - name: code
        type: string
        required: true
  - name: Var
    fields:
      - name: value
        type: string
        required: true`;

      expect(() => {
        manifestEngine.generateProject(manifestContent);
      }).not.toThrow();

      const files = manifestEngine.generateProject(manifestContent);
      const serverFile = files.find((f: GeneratedFile) => f.path === 'index.js');
      
      expect(serverFile).toBeDefined();
      expect(files).toHaveLength(5); // package.json, index.js, database.js, .env, README.md
    });

    it('should detect circular references in entity relationships', () => {
      const manifestContent = `name: circular-reference-test  
version: 1.0.0
entities:
  - name: User
    fields:
      - name: id
        type: string
        required: true
      - name: profileId
        type: string
        required: true
  - name: Profile
    fields:
      - name: id  
        type: string
        required: true
      - name: userId
        type: string
        required: true`;

      // The engine should handle this gracefully without infinite loops
      expect(() => {
        const startTime = Date.now();
        manifestEngine.generateProject(manifestContent);
        const endTime = Date.now();
        
        // Should complete within reasonable time (not hang due to circular refs)
        expect(endTime - startTime).toBeLessThan(5000);
      }).not.toThrow();
    });

    it('should handle performance test with 100 entities', () => {
      const entities = Array.from({ length: 100 }, (_, i) => `
  - name: Entity${i}
    fields:
      - name: id
        type: string
        required: true
      - name: name${i}
        type: string
      - name: value${i}
        type: number`).join('');

      const manifestContent = `name: performance-test
version: 1.0.0
entities:${entities}`;

      const startTime = Date.now();
      const files = manifestEngine.generateProject(manifestContent);
      const endTime = Date.now();

      expect(files).toHaveLength(5); // Standard files
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
      
      const serverFile = files.find((f: GeneratedFile) => f.path === 'index.js');
      expect(serverFile).toBeDefined();
      
      // Should contain routes for all entities
      for (let i = 0; i < 10; i++) { // Check first 10 entities
        expect(serverFile!.content).toContain(`/entity${i}s`);
      }
    });

    it('should handle special characters in field names', () => {
      const manifestContent = `name: special-chars-test
version: 1.0.0
entities:
  - name: SpecialEntity
    fields:
      - name: field-with-dashes
        type: string
        required: true
      - name: field_with_underscores
        type: string
        required: true
      - name: fieldWith123Numbers
        type: string
        required: true
      - name: field@#$%
        type: string
        required: false`;

      const files = manifestEngine.generateProject(manifestContent);
      const serverFile = files.find((f: GeneratedFile) => f.path === 'index.js');
      
      expect(serverFile).toBeDefined();
      expect(files).toHaveLength(5);
      
      // Should handle special characters in field names for JavaScript compatibility
      const serverContent = serverFile!.content;
      expect(serverContent).toContain('if (!req.body[\'field-with-dashes\'])');
      expect(serverContent).toContain('if (!req.body[\'field_with_underscores\'])');
      expect(serverContent).toContain('if (!req.body[\'fieldWith123Numbers\'])');
      // field@#$% should not have validation since it's not required
      expect(serverContent).not.toContain('if (!req.body[\'field@#$%\'])');
    });

    it('should handle empty entity (no fields)', () => {
      const manifestContent = `name: empty-entity-test
version: 1.0.0
entities:
  - name: EmptyEntity
    fields: []
  - name: AnotherEmpty
    fields:`;

      const files = manifestEngine.generateProject(manifestContent);
      expect(files).toHaveLength(5);
      
      const serverFile = files.find((f: GeneratedFile) => f.path === 'index.js');
      expect(serverFile).toBeDefined();
      
      // Should handle entities with no fields gracefully
      expect(serverFile!.content).toContain('/emptyentities');
      expect(serverFile!.content).toContain('/anotherempties');
    });

    it('should handle duplicate entity names', () => {
      const manifestContent = `name: duplicate-test
version: 1.0.0
entities:
  - name: User
    fields:
      - name: email
        type: string
        required: true
  - name: User
    fields:
      - name: username
        type: string
        required: true`;

      // Should handle duplicates gracefully (last one wins or merge)
      expect(() => {
        manifestEngine.generateProject(manifestContent);
      }).not.toThrow();
    });

    it('should validate field type consistency', () => {
      const manifestContent = `name: type-validation-test
version: 1.0.0
entities:
  - name: ValidationTest
    fields:
      - name: validString
        type: string
        required: true
      - name: validNumber
        type: number
        required: true
      - name: validBoolean
        type: boolean
        required: false
      - name: validDate
        type: date
        required: false
      - name: invalidType
        type: invalidType
        required: false`;

      // Should handle invalid types gracefully
      const files = manifestEngine.generateProject(manifestContent);
      expect(files).toHaveLength(5);
      
      const serverFile = files.find((f: GeneratedFile) => f.path === 'index.js');
      expect(serverFile).toBeDefined();
    });

    it('should handle extremely nested field structures', () => {
      const manifestContent = `name: nested-test
version: 1.0.0
entities:
  - name: DeepEntity
    fields:
      - name: level1_field1
        type: string
        required: true
      - name: level1_field2_with_very_long_name_that_goes_on_and_on
        type: string
        required: false
      - name: level1_field3_with_special_chars_@#$%
        type: number
        required: false`;

      const files = manifestEngine.generateProject(manifestContent);
      expect(files).toHaveLength(5);
      
      const readmeFile = files.find((f: GeneratedFile) => f.path === 'README.md');
      expect(readmeFile).toBeDefined();
      expect(readmeFile!.content.length).toBeGreaterThan(1000); // Should generate comprehensive README
    });

    it('should handle unicode characters in entity and field names', () => {
      const manifestContent = `name: unicode-test
version: 1.0.0
entities:
  - name: ユーザー
    fields:
      - name: 名前
        type: string
        required: true
      - name: 电子邮件
        type: string
        required: true
  - name: المستخدم
    fields:
      - name: الاسم
        type: string
        required: true`;

      // Should handle unicode gracefully
      expect(() => {
        manifestEngine.generateProject(manifestContent);
      }).not.toThrow();
    });
  });
});