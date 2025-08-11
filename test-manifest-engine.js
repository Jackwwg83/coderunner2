#!/usr/bin/env node

// Test the ManifestEngine directly
const { ManifestEngine } = require('./dist/services/manifestEngine');

function testManifestEngine() {
  console.log('🧪 Testing ManifestEngine...\n');
  
  try {
    const engine = ManifestEngine.getInstance();
    
    const sampleManifest = `name: Blog API
version: 1.0.0
entities:
  - name: Post
    fields:
      - name: title
        type: string
        required: true
      - name: content
        type: string
        required: true
      - name: author
        type: string
        required: false
  - name: Comment
    fields:
      - name: content
        type: string
        required: true
      - name: author
        type: string
        required: true`;

    console.log('📝 Sample manifest:');
    console.log(sampleManifest);
    console.log('\n🔄 Generating project files...');
    
    const generatedFiles = engine.generateProject(sampleManifest);
    
    console.log(`✅ Generated ${generatedFiles.length} files:`);
    
    generatedFiles.forEach(file => {
      console.log(`   📄 ${file.path} (${file.content.length} chars)`);
    });
    
    // Show generated package.json
    const packageFile = generatedFiles.find(f => f.path === 'package.json');
    if (packageFile) {
      console.log('\n📦 Generated package.json:');
      const pkg = JSON.parse(packageFile.content);
      console.log(`   Name: ${pkg.name}`);
      console.log(`   Dependencies: ${Object.keys(pkg.dependencies).join(', ')}`);
    }
    
    // Show a snippet of the main server
    const serverFile = generatedFiles.find(f => f.path === 'index.js');
    if (serverFile) {
      console.log('\n🚀 Generated server (first 300 chars):');
      console.log(serverFile.content.substring(0, 300) + '...');
    }
    
    console.log('\n✅ ManifestEngine is working correctly!');
    
  } catch (error) {
    console.error('❌ ManifestEngine test failed:', error.message);
    console.error(error.stack);
  }
}

testManifestEngine();