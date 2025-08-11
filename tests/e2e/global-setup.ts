import { chromium, FullConfig } from '@playwright/test';
import { DatabaseService } from '../../src/services/database';
import { AuthService } from '../../src/services/auth';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting E2E Global Setup...');
  
  // Initialize test database
  console.log('📀 Initializing test database...');
  const db = DatabaseService.getInstance();
  await db.connect();
  
  // Create test user for authentication
  console.log('👤 Creating test user...');
  const authService = new AuthService();
  const testUser = {
    email: 'test@coderunner.io',
    password: 'TestPassword123!',
    name: 'Test User'
  };
  
  try {
    // Try to create test user (might already exist)
    await authService.register(testUser.email, testUser.password, testUser.name);
  } catch (error) {
    // User might already exist, that's okay
    console.log('Test user might already exist, continuing...');
  }
  
  // Create browser and login to save authentication state
  console.log('🔐 Setting up authentication state...');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Navigate to login page
    await page.goto(`${config.projects[0].use.baseURL}/auth`);
    
    // Fill login form
    await page.fill('[data-testid="email"]', testUser.email);
    await page.fill('[data-testid="password"]', testUser.password);
    await page.click('[data-testid="login-submit"]');
    
    // Wait for successful login
    await page.waitForURL('/dashboard', { timeout: 10000 });
    
    // Save authenticated state
    await page.context().storageState({ path: 'playwright/.auth/user.json' });
    console.log('✅ Authentication state saved');
  } catch (error) {
    console.log('⚠️  Authentication setup failed, tests may need to handle login manually');
  } finally {
    await browser.close();
  }
  
  console.log('✅ Global setup completed');
}

export default globalSetup;