import { test, expect } from '@playwright/test';

test.describe('Deployment Management', () => {
  test.beforeEach(async ({ page }) => {
    // Start from deployments page (authenticated via storageState)
    await page.goto('/deployments');
  });

  test('should display deployments list', async ({ page }) => {
    await expect(page.locator('[data-testid="deployments-container"]')).toBeVisible();
    await expect(page.locator('[data-testid="create-deployment-button"]')).toBeVisible();
  });

  test('should navigate to deployment creation', async ({ page }) => {
    await page.click('[data-testid="create-deployment-button"]');
    await page.waitForURL('/deploy/new');
    
    // Verify form elements are present
    await expect(page.locator('[data-testid="project-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="manifest-editor"]')).toBeVisible();
    await expect(page.locator('[data-testid="deploy-button"]')).toBeVisible();
  });

  test('should create deployment with basic manifest', async ({ page }) => {
    await page.click('[data-testid="create-deployment-button"]');
    await page.waitForURL('/deploy/new');
    
    // Fill deployment form
    await page.fill('[data-testid="project-name"]', 'Test Node.js App');
    
    // Use basic Node.js manifest
    const basicManifest = `
version: "1.0"
name: test-nodejs-app
type: nodejs
runtime:
  version: "18"
build:
  commands:
    - npm install
    - npm run build
start:
  command: npm start
  port: 3000
resources:
  cpu: 0.5
  memory: 512
environment:
  NODE_ENV: production
`;
    
    await page.fill('[data-testid="manifest-editor"]', basicManifest);
    await page.click('[data-testid="deploy-button"]');
    
    // Should redirect to deployment detail page
    await expect(page).toHaveURL(/\/deployments\/[a-f0-9-]+/);
    await expect(page.locator('[data-testid="deployment-status"]')).toBeVisible();
  });

  test('should validate manifest format', async ({ page }) => {
    await page.click('[data-testid="create-deployment-button"]');
    await page.waitForURL('/deploy/new');
    
    // Fill with invalid YAML
    await page.fill('[data-testid="project-name"]', 'Test Invalid Manifest');
    await page.fill('[data-testid="manifest-editor"]', 'invalid: yaml: content:');
    await page.click('[data-testid="deploy-button"]');
    
    // Should show validation error
    await expect(page.locator('[data-testid="manifest-error"]')).toBeVisible();
  });

  test('should show deployment details', async ({ page }) => {
    // First create a deployment
    await page.click('[data-testid="create-deployment-button"]');
    await page.waitForURL('/deploy/new');
    
    await page.fill('[data-testid="project-name"]', 'Test Deployment Details');
    const manifest = `
version: "1.0"
name: test-details
type: nodejs
runtime:
  version: "18"
start:
  command: npm start
  port: 3000
`;
    await page.fill('[data-testid="manifest-editor"]', manifest);
    await page.click('[data-testid="deploy-button"]');
    
    // Wait for deployment detail page
    await expect(page).toHaveURL(/\/deployments\/[a-f0-9-]+/);
    
    // Verify deployment details are displayed
    await expect(page.locator('[data-testid="deployment-name"]')).toContainText('Test Deployment Details');
    await expect(page.locator('[data-testid="deployment-status"]')).toBeVisible();
    await expect(page.locator('[data-testid="manifest-display"]')).toBeVisible();
    await expect(page.locator('[data-testid="logs-container"]')).toBeVisible();
  });

  test('should filter deployments by status', async ({ page }) => {
    // Verify filter controls exist
    await expect(page.locator('[data-testid="status-filter"]')).toBeVisible();
    
    // Test filtering by status
    await page.selectOption('[data-testid="status-filter"]', 'running');
    
    // Verify URL parameter is set
    await expect(page).toHaveURL(/status=running/);
    
    // All visible deployments should have running status
    const deploymentCards = page.locator('[data-testid="deployment-card"]');
    const count = await deploymentCards.count();
    
    for (let i = 0; i < count; i++) {
      const status = deploymentCards.nth(i).locator('[data-testid="status-badge"]');
      await expect(status).toContainText('running');
    }
  });

  test('should search deployments by name', async ({ page }) => {
    await page.fill('[data-testid="search-input"]', 'test');
    await page.press('[data-testid="search-input"]', 'Enter');
    
    // Verify URL parameter is set
    await expect(page).toHaveURL(/search=test/);
    
    // All visible deployment names should contain 'test'
    const deploymentNames = page.locator('[data-testid="deployment-name"]');
    const count = await deploymentNames.count();
    
    for (let i = 0; i < count; i++) {
      const name = await deploymentNames.nth(i).textContent();
      expect(name?.toLowerCase()).toContain('test');
    }
  });
});

test.describe('Deployment Actions', () => {
  test('should stop and restart deployment', async ({ page }) => {
    // Navigate to a deployment detail page
    await page.goto('/deployments');
    
    // Click on first deployment
    await page.click('[data-testid="deployment-card"]:first-child');
    await expect(page).toHaveURL(/\/deployments\/[a-f0-9-]+/);
    
    // Stop deployment
    await page.click('[data-testid="stop-deployment"]');
    await expect(page.locator('[data-testid="confirm-stop"]')).toBeVisible();
    await page.click('[data-testid="confirm-stop"]');
    
    // Wait for status to change
    await expect(page.locator('[data-testid="deployment-status"]')).toContainText('stopped');
    
    // Restart deployment
    await page.click('[data-testid="start-deployment"]');
    await expect(page.locator('[data-testid="deployment-status"]')).toContainText('starting');
  });

  test('should delete deployment', async ({ page }) => {
    // Navigate to deployments page
    await page.goto('/deployments');
    
    // Click on first deployment
    await page.click('[data-testid="deployment-card"]:first-child');
    await expect(page).toHaveURL(/\/deployments\/[a-f0-9-]+/);
    
    // Delete deployment
    await page.click('[data-testid="delete-deployment"]');
    await expect(page.locator('[data-testid="confirm-delete"]')).toBeVisible();
    await page.fill('[data-testid="delete-confirmation"]', 'DELETE');
    await page.click('[data-testid="confirm-delete"]');
    
    // Should redirect to deployments list
    await page.waitForURL('/deployments');
    
    // Verify deployment is removed (or marked as deleted)
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Deployment deleted successfully');
  });
});