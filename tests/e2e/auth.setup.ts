import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../../playwright/.auth/user.json');

setup('authenticate', async ({ page }) => {
  // Navigate to login page
  await page.goto('/auth');
  
  // Fill login form
  await page.fill('[data-testid="email"]', 'test@coderunner.io');
  await page.fill('[data-testid="password"]', 'TestPassword123!');
  
  // Submit form and wait for navigation
  await page.click('[data-testid="login-submit"]');
  await page.waitForURL('/dashboard');
  
  // Verify we're logged in
  await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  
  // Save authentication state
  await page.context().storageState({ path: authFile });
});