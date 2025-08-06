#!/usr/bin/env ts-node

/**
 * DatabaseService Example Usage
 * 
 * This file demonstrates how to use the DatabaseService to perform
 * common database operations for CodeRunner.
 */

import { DatabaseService } from '../services/database';
import { DeploymentStatus } from '../types';

async function exampleUsage() {
  const db = DatabaseService.getInstance();

  try {
    // Initialize database connection
    console.log('🔌 Connecting to database...');
    await db.connect();
    await db.initialize();

    // Health check
    console.log('\n🏥 Checking database health...');
    const health = await db.healthCheck();
    console.log('Health status:', health);

    // Example 1: Create a user
    console.log('\n👤 Creating a user...');
    const newUser = await db.createUser({
      email: 'demo@example.com',
      password_hash: 'hashed_password_123',
      plan_type: 'free'
    });
    console.log('Created user:', newUser);

    // Example 2: Create a project
    console.log('\n📁 Creating a project...');
    const newProject = await db.createProject({
      user_id: newUser.id,
      name: 'Demo Project',
      description: 'This is a demo project created via DatabaseService'
    });
    console.log('Created project:', newProject);

    // Example 3: Create a deployment
    console.log('\n🚀 Creating a deployment...');
    const newDeployment = await db.createDeployment({
      project_id: newProject.id,
      app_sandbox_id: 'sandbox_123',
      public_url: 'https://demo.coderunner.dev',
      runtime_type: 'nodejs',
      status: DeploymentStatus.PENDING
    });
    console.log('Created deployment:', newDeployment);

    // Example 4: Update deployment status
    console.log('\n🔄 Updating deployment status...');
    const updatedDeployment = await db.updateDeploymentStatus(
      newDeployment.id, 
      DeploymentStatus.RUNNING
    );
    console.log('Updated deployment:', updatedDeployment);

    // Example 5: Get user's projects
    console.log('\n📋 Getting user projects...');
    const userProjects = await db.getProjectsByUserId(newUser.id);
    console.log('User projects:', userProjects);

    // Example 6: Get project deployments
    console.log('\n🏗️  Getting project deployments...');
    const projectDeployments = await db.getDeploymentsByProjectId(newProject.id);
    console.log('Project deployments:', projectDeployments);

    // Example 7: Get deployment with details
    console.log('\n🔍 Getting deployment with full details...');
    const deploymentDetails = await db.getDeploymentWithDetails(newDeployment.id);
    console.log('Deployment details:', deploymentDetails);

    // Example 8: System statistics
    console.log('\n📊 Getting system statistics...');
    const stats = await db.getSystemStats();
    console.log('System stats:', stats);

    // Example 9: Using transactions
    console.log('\n💳 Using database transactions...');
    await db.executeInTransaction(async (client) => {
      // Update project and create deployment in single transaction
      await client.query(
        'UPDATE projects SET description = $1 WHERE id = $2',
        ['Updated via transaction', newProject.id]
      );
      
      await client.query(
        'INSERT INTO deployments (project_id, status, runtime_type) VALUES ($1, $2, $3)',
        [newProject.id, DeploymentStatus.PENDING, 'python']
      );
      
      console.log('Transaction completed successfully');
    });

    // Example 10: Pool information
    console.log('\n🏊 Connection pool information...');
    const poolInfo = db.getPoolInfo();
    console.log('Pool info:', poolInfo);

    console.log('\n✅ All examples completed successfully!');

  } catch (error) {
    console.error('❌ Error in example:', error);
  } finally {
    // Always close database connections
    console.log('\n🔚 Closing database connection...');
    await db.disconnect();
  }
}

// Example function to demonstrate error handling
async function errorHandlingExample() {
  const db = DatabaseService.getInstance();

  try {
    await db.connect();

    // Try to create user with duplicate email
    await db.createUser({
      email: 'duplicate@example.com',
      password_hash: 'hash1'
    });

    // This should fail with unique constraint violation
    await db.createUser({
      email: 'duplicate@example.com',
      password_hash: 'hash2'
    });

  } catch (error) {
    console.log('Expected error caught:', error instanceof Error ? error.message : error);
  } finally {
    await db.disconnect();
  }
}

// Example function to demonstrate migration usage
async function migrationExample() {
  console.log('📚 Migration Examples:');
  console.log('');
  console.log('1. Run all pending migrations:');
  console.log('   npm run migrate');
  console.log('');
  console.log('2. Check migration status:');
  console.log('   npm run migrate:status');
  console.log('');
  console.log('3. Create a new migration:');
  console.log('   npm run migrate:create "add user preferences table"');
  console.log('');
  console.log('4. Check database health:');
  console.log('   npm run db:health');
  console.log('');
}

// Main execution
async function main() {
  const command = process.argv[2];

  switch (command) {
  case 'usage':
  case 'demo':
    await exampleUsage();
    break;
    
  case 'error':
    await errorHandlingExample();
    break;
    
  case 'migrations':
    migrationExample();
    break;
    
  default:
    console.log('🗃️  DatabaseService Example Usage');
    console.log('');
    console.log('Commands:');
    console.log('  ts-node src/examples/database-example.ts demo       - Run full demo');
    console.log('  ts-node src/examples/database-example.ts error      - Error handling demo');
    console.log('  ts-node src/examples/database-example.ts migrations - Migration examples');
    console.log('');
    console.log('Prerequisites:');
    console.log('  1. Set up your DATABASE_URL environment variable');
    console.log('  2. Run: npm run migrate (to create tables)');
    console.log('  3. Ensure PostgreSQL is running');
    break;
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { exampleUsage, errorHandlingExample };