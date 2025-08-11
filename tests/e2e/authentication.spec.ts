import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Start each test on the login page
    await page.goto('/auth');
  });

  test('should display login form', async ({ page }) => {
    await expect(page.locator('[data-testid="email"]')).toBeVisible();
    await expect(page.locator('[data-testid="password"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-submit"]')).toBeVisible();
  });

  test('should login with valid credentials', async ({ page }) => {
    await page.fill('[data-testid="email"]', 'test@coderunner.io');
    await page.fill('[data-testid="password"]', 'TestPassword123!');
    await page.click('[data-testid="login-submit"]');
    
    // Should redirect to dashboard
    await page.waitForURL('/dashboard');
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.fill('[data-testid="email"]', 'invalid@email.com');
    await page.fill('[data-testid="password"]', 'wrongpassword');
    await page.click('[data-testid="login-submit"]');
    
    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid credentials');
  });

  test('should validate email format', async ({ page }) => {
    await page.fill('[data-testid="email"]', 'invalid-email');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-submit"]');
    
    // Should show validation error
    await expect(page.locator('[data-testid="email-error"]')).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.fill('[data-testid="email"]', 'test@coderunner.io');
    await page.fill('[data-testid="password"]', 'TestPassword123!');
    await page.click('[data-testid="login-submit"]');
    await page.waitForURL('/dashboard');
    
    // Logout
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout-button"]');
    
    // Should redirect to login page
    await page.waitForURL('/auth');
    await expect(page.locator('[data-testid="email"]')).toBeVisible();
  });

  test('should handle session expiry', async ({ page }) => {
    // Login first
    await page.fill('[data-testid="email"]', 'test@coderunner.io');
    await page.fill('[data-testid="password"]', 'TestPassword123!');
    await page.click('[data-testid="login-submit"]');
    await page.waitForURL('/dashboard');
    
    // Clear storage to simulate session expiry
    await page.context().clearCookies();
    await page.reload();
    
    // Should redirect to login
    await page.waitForURL('/auth');
  });
});

test.describe('Registration Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
    await page.click('[data-testid="register-tab"]');
  });

  test('should display registration form', async ({ page }) => {
    await expect(page.locator('[data-testid="register-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="register-email"]')).toBeVisible();
    await expect(page.locator('[data-testid="register-password"]')).toBeVisible();
    await expect(page.locator('[data-testid="register-submit"]')).toBeVisible();
  });

  test('should register new user successfully', async ({ page }) => {
    const timestamp = Date.now();
    const testEmail = `test-${timestamp}@coderunner.io`;
    
    await page.fill('[data-testid="register-name"]', 'Test User');
    await page.fill('[data-testid="register-email"]', testEmail);
    await page.fill('[data-testid="register-password"]', 'TestPassword123!');
    await page.click('[data-testid="register-submit"]');
    
    // Should redirect to dashboard after successful registration
    await page.waitForURL('/dashboard');
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('should validate password strength', async ({ page }) => {
    await page.fill('[data-testid="register-name"]', 'Test User');
    await page.fill('[data-testid="register-email"]', 'test@example.com');
    await page.fill('[data-testid="register-password"]', '123');
    await page.click('[data-testid="register-submit"]');
    
    // Should show password validation error
    await expect(page.locator('[data-testid="password-error"]')).toBeVisible();
  });
});