import dotenv from 'dotenv';
import { DatabaseService } from '../../src/services/database';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Global test setup
beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  
  // Ensure we're using the test JWT secret
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only';
  
  // Set lower bcrypt rounds for faster tests
  process.env.BCRYPT_ROUNDS = '4';
  
  console.log('🧪 Test environment setup complete');
});

// Global test teardown
afterAll(async () => {
  // Close database connections
  try {
    const db = DatabaseService.getInstance();
    if (db.isConnected()) {
      await db.disconnect();
      console.log('🔌 Test database connections closed');
    }
  } catch (error) {
    console.error('Error closing test database connections:', error);
  }
});

// Reset environment between test suites
beforeEach(() => {
  // Clear any cached modules that might interfere with tests
  jest.clearAllMocks();
});

afterEach(() => {
  // Clean up any test artifacts
  jest.restoreAllMocks();
});

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process in tests, just log
});

export {};