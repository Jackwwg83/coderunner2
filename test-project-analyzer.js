#!/usr/bin/env node

// Test the ProjectAnalyzer directly
const { ProjectAnalyzer } = require('./dist/utils/analyzer');

function testProjectAnalyzer() {
  console.log('🧪 Testing ProjectAnalyzer...\n');
  
  try {
    // Test 1: Node.js project
    console.log('1️⃣ Testing Node.js project detection...');
    const nodeFiles = [
      { path: 'package.json', content: '{"name": "test", "scripts": {"start": "node index.js"}}' },
      { path: 'index.js', content: 'console.log("Hello");' }
    ];
    
    const nodeAnalysis = ProjectAnalyzer.analyzeProject(nodeFiles);
    console.log(`   Project Type: ${nodeAnalysis.projectType}`);
    console.log(`   Framework: ${nodeAnalysis.framework}`);
    console.log(`   Start Command: ${nodeAnalysis.startCommand}`);
    
    // Test 2: Manifest project
    console.log('\n2️⃣ Testing Manifest project detection...');
    const manifestFiles = [
      { path: 'manifest.yaml', content: 'name: Test API\nentities: []' }
    ];
    
    const manifestAnalysis = ProjectAnalyzer.analyzeProject(manifestFiles);
    console.log(`   Project Type: ${manifestAnalysis.projectType}`);
    console.log(`   Framework: ${manifestAnalysis.framework}`);
    console.log(`   Start Command: ${manifestAnalysis.startCommand}`);
    
    // Test 3: Python project
    console.log('\n3️⃣ Testing Python project detection...');
    const pythonFiles = [
      { path: 'requirements.txt', content: 'flask==2.0.1' },
      { path: 'app.py', content: 'print("Hello")' }
    ];
    
    const pythonAnalysis = ProjectAnalyzer.analyzeProject(pythonFiles);
    console.log(`   Project Type: ${pythonAnalysis.projectType}`);
    console.log(`   Framework: ${pythonAnalysis.framework}`);
    console.log(`   Start Command: ${pythonAnalysis.startCommand}`);
    
    console.log('\n✅ ProjectAnalyzer is working correctly!');
    
  } catch (error) {
    console.error('❌ ProjectAnalyzer test failed:', error.message);
    console.error(error.stack);
  }
}

testProjectAnalyzer();