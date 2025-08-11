import { test, expect } from '@playwright/test';

/**
 * Simple MVP E2E Tests - Day 6
 * Basic functionality tests without complex TypeScript types
 */
test.describe('MVP Critical Tests', () => {
  
  test('should load homepage successfully', async ({ page }) => {
    await page.goto('/');
    
    // Wait for CodeRunner brand to appear
    await expect(page.locator('text=CodeRunner')).toBeVisible();
    
    // Verify main navigation
    await expect(page.locator('a[href="/deployments"]')).toBeVisible();
    await expect(page.locator('a[href="/projects"]')).toBeVisible();
    await expect(page.locator('a[href="/databases"]')).toBeVisible();
  });

  test('should navigate to deployments page', async ({ page }) => {
    await page.goto('/deployments');
    
    await expect(page.locator('h1')).toContainText('Deployments');
    await expect(page.locator('text=New Deployment')).toBeVisible();
  });

  test('should navigate to test editor', async ({ page }) => {
    await page.goto('/test-editor');
    
    // Wait for Monaco editor to load
    await expect(page.locator('.monaco-editor')).toBeVisible({ timeout: 10000 });
  });

  test('should handle API calls', async ({ page }) => {
    const response = await page.request.get('http://localhost:8080/api/health');
    expect(response.status()).toBe(200);
  });

  test('should be mobile responsive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    await expect(page.locator('text=CodeRunner')).toBeVisible();
  });
});