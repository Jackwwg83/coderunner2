import { DatabaseService } from '../../src/services/database';

/**
 * Global teardown function for Jest
 * This runs once after all tests have completed
 */
export default async function globalTeardown(): Promise<void> {
  console.log('🧹 Running global test teardown...');
  
  try {
    // Ensure database connections are closed
    const db = DatabaseService.getInstance();
    if (db.isConnected()) {
      await db.disconnect();
      console.log('✅ Database connections closed');
    }
    
    // Clean up any remaining timers (if jest is available)
    if (typeof jest !== 'undefined') {
      jest.clearAllTimers();
    }
    
    console.log('✅ Global teardown completed');
  } catch (error) {
    console.error('❌ Error during global teardown:', error);
    // Don't throw here as it would cause Jest to fail
  }
}