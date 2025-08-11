#!/usr/bin/env node

/**
 * AgentSphere API Key Verification Script
 * This script verifies that the AgentSphere API key is properly configured
 * and can successfully connect to the AgentSphere service.
 */

require('dotenv').config();

// Simple color functions using ANSI escape codes
const color = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  gray: (text) => `\x1b[90m${text}\x1b[0m`,
};

console.log(color.cyan('===================================='));
console.log(color.cyan('AgentSphere API Key Verification'));
console.log(color.cyan('====================================\n'));

// Check environment variables
console.log(color.blue('1. Checking environment variables...'));

const domain = process.env.AGENTSPHERE_DOMAIN;
const apiUrl = process.env.AGENTSPHERE_API_URL;
const apiKey = process.env.AGENTSPHERE_API_KEY;

if (!domain) {
  console.log(color.red('❌ AGENTSPHERE_DOMAIN is not set'));
  process.exit(1);
}
console.log(color.green(`✅ AGENTSPHERE_DOMAIN: ${domain}`));

if (!apiUrl) {
  console.log(color.red('❌ AGENTSPHERE_API_URL is not set'));
  process.exit(1);
}
console.log(color.green(`✅ AGENTSPHERE_API_URL: ${apiUrl}`));

if (!apiKey) {
  console.log(color.red('❌ AGENTSPHERE_API_KEY is not set'));
  console.log(color.yellow('   Please set AGENTSPHERE_API_KEY in your .env file'));
  process.exit(1);
}

// Mask the API key for security
const maskedKey = apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 4);
console.log(color.green(`✅ AGENTSPHERE_API_KEY: ${maskedKey}`));

// Try to load the AgentSphere SDK
console.log(color.blue('\n2. Loading AgentSphere SDK...'));

let Sandbox;
try {
  const agentsphere = require('agentsphere-js');
  Sandbox = agentsphere.Sandbox;
  console.log(color.green('✅ AgentSphere SDK loaded successfully'));
} catch (error) {
  console.log(color.yellow('⚠️  AgentSphere SDK not installed, trying to install...'));
  
  // Try to install the SDK
  const { execSync } = require('child_process');
  try {
    console.log(color.gray('   Running: npm install agentsphere-js'));
    execSync('npm install agentsphere-js', { stdio: 'inherit' });
    
    // Try loading again
    const agentsphere = require('agentsphere-js');
    Sandbox = agentsphere.Sandbox;
    console.log(color.green('✅ AgentSphere SDK installed and loaded'));
  } catch (installError) {
    console.log(color.red('❌ Failed to install AgentSphere SDK'));
    console.log(color.red(`   Error: ${installError.message}`));
    process.exit(1);
  }
}

// Test creating a sandbox
console.log(color.blue('\n3. Testing sandbox creation...'));

async function testSandbox() {
  let sandbox = null;
  
  try {
    // Create a test sandbox with minimal timeout
    console.log(color.gray('   Creating sandbox with 60-second timeout...'));
    sandbox = new Sandbox({
      timeout: 60,
      metadata: {
        purpose: 'api-key-verification',
        timestamp: new Date().toISOString()
      }
    });
    
    // Wait for sandbox to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get sandbox info
    const info = sandbox.getInfo();
    console.log(color.green('✅ Sandbox created successfully!'));
    console.log(color.gray(`   Sandbox ID: ${info.sandbox_id || 'N/A'}`));
    console.log(color.gray(`   Template: ${info.template_id || 'N/A'}`));
    
    // Test running a simple command
    console.log(color.blue('\n4. Testing code execution...'));
    const result = await sandbox.runCode('console.log("Hello from AgentSphere!")');
    console.log(color.green('✅ Code executed successfully'));
    console.log(color.gray(`   Output: ${result.logs || result.stdout || 'No output'}`));
    
    // Test file operations
    console.log(color.blue('\n5. Testing file operations...'));
    await sandbox.files.write('/test.txt', 'AgentSphere API Key Verified!');
    const content = await sandbox.files.read('/test.txt');
    console.log(color.green('✅ File operations working'));
    console.log(color.gray(`   File content: ${content}`));
    
    // Clean up
    console.log(color.blue('\n6. Cleaning up...'));
    await sandbox.kill();
    console.log(color.green('✅ Sandbox terminated successfully'));
    
    // Summary
    console.log(color.cyan('\n===================================='));
    console.log(color.green('✅ API KEY VERIFICATION SUCCESSFUL!'));
    console.log(color.cyan('===================================='));
    console.log(color.green('\nYour AgentSphere API key is properly configured and working.'));
    console.log(color.yellow('\n⚠️  Security Reminder:'));
    console.log(color.yellow('   - Never commit API keys to version control'));
    console.log(color.yellow('   - Keep your .env file in .gitignore'));
    console.log(color.yellow('   - Rotate keys regularly for production use'));
    
  } catch (error) {
    console.log(color.red('\n❌ Sandbox operation failed'));
    console.log(color.red(`   Error: ${error.message}`));
    
    if (error.message.includes('401') || error.message.includes('unauthorized')) {
      console.log(color.red('\n   The API key appears to be invalid or expired.'));
      console.log(color.yellow('   Please check your API key at: https://www.agentsphere.run/apikey'));
    } else if (error.message.includes('network') || error.message.includes('ENOTFOUND')) {
      console.log(color.red('\n   Network error - unable to reach AgentSphere servers.'));
      console.log(color.yellow('   Please check your internet connection.'));
    }
    
    // Try to clean up if sandbox was created
    if (sandbox) {
      try {
        await sandbox.kill();
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
    }
    
    process.exit(1);
  }
}

// Run the test
testSandbox().catch(error => {
  console.error(color.red('Unexpected error:'), error);
  process.exit(1);
});