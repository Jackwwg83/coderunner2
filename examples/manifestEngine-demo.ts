/**
 * ManifestEngine Demo - Demonstrates how to use the ManifestEngine service
 * 
 * This file shows how to generate a complete Express.js backend from a manifest.yaml
 */

import { ManifestEngine } from '../src/services/manifestEngine';

// Example manifest.yaml content
const exampleManifest = `name: blog-api
version: 1.0.0
entities:
  - name: User
    fields:
      - name: username
        type: string
        required: true
      - name: email
        type: string
        required: true
      - name: bio
        type: string
      - name: active
        type: boolean
  - name: Post
    fields:
      - name: title
        type: string
        required: true
      - name: content
        type: string
        required: true
      - name: publishedAt
        type: date
      - name: userId
        type: string
        required: true
  - name: Comment
    fields:
      - name: content
        type: string
        required: true
      - name: postId
        type: string
        required: true
      - name: userId
        type: string
        required: true`;

async function demonstrateManifestEngine() {
  console.log('🚀 ManifestEngine Demonstration');
  console.log('===============================');
  
  try {
    // Get the ManifestEngine instance
    const manifestEngine = ManifestEngine.getInstance();
    
    console.log('📝 Input Manifest:');
    console.log(exampleManifest);
    console.log('\n🎯 Generating Express.js project...\n');
    
    // Generate the project files
    const generatedFiles = manifestEngine.generateProject(exampleManifest);
    
    console.log(`✅ Generated ${generatedFiles.length} files:\n`);
    
    // Display file information
    for (const file of generatedFiles) {
      console.log(`📄 ${file.path}`);
      console.log(`   Size: ${file.content.length} characters`);
      console.log(`   Content preview: ${file.content.substring(0, 100).replace(/\n/g, ' ')}...`);
      console.log('');
    }
    
    console.log('🎉 Project generation completed successfully!');
    console.log('\nGenerated files include:');
    console.log('• package.json - Dependencies and scripts');
    console.log('• index.js - Express server with CRUD routes');
    console.log('• database.js - LowDB setup and helper functions');
    console.log('• .env - Environment variables');
    console.log('• README.md - Complete documentation');
    
    console.log('\n🚀 The generated project is ready to run with:');
    console.log('   npm install && npm start');
    
    console.log('\n📊 API Endpoints generated:');
    console.log('   Users:    GET|POST /api/users, GET|PUT|DELETE /api/users/:id');
    console.log('   Posts:    GET|POST /api/posts, GET|PUT|DELETE /api/posts/:id');
    console.log('   Comments: GET|POST /api/comments, GET|PUT|DELETE /api/comments/:id');
    
  } catch (error) {
    console.error('❌ Error generating project:', error);
    process.exit(1);
  }
}

// Run the demonstration if this file is executed directly
if (require.main === module) {
  demonstrateManifestEngine();
}

export { demonstrateManifestEngine };