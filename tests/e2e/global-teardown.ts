import { DatabaseService } from '../../src/services/database';

async function globalTeardown() {
  console.log('🧹 Starting E2E Global Teardown...');
  
  // Clean up test database connections
  try {
    const db = DatabaseService.getInstance();
    await db.disconnect();
    console.log('📀 Database connections closed');
  } catch (error) {
    console.log('Warning: Error closing database connections:', error);
  }
  
  console.log('✅ Global teardown completed');
}

export default globalTeardown;