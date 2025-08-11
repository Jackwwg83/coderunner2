import { test, expect } from '@playwright/test';

test.describe('Configuration Management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to project settings/configuration
    await page.goto('/projects');
    await page.click('[data-testid="project-card"]:first-child');
    await page.click('[data-testid="project-settings"]');
    await page.click('[data-testid="configuration-tab"]');
  });

  test('should display environment configurations', async ({ page }) => {
    await expect(page.locator('[data-testid="environment-tabs"]')).toBeVisible();
    await expect(page.locator('[data-testid="development-tab"]')).toBeVisible();
    await expect(page.locator('[data-testid="staging-tab"]')).toBeVisible();
    await expect(page.locator('[data-testid="production-tab"]')).toBeVisible();
  });

  test('should switch between environment tabs', async ({ page }) => {
    // Click staging tab
    await page.click('[data-testid="staging-tab"]');
    await expect(page.locator('[data-testid="staging-config"]')).toBeVisible();
    
    // Click production tab
    await page.click('[data-testid="production-tab"]');
    await expect(page.locator('[data-testid="production-config"]')).toBeVisible();
    
    // Return to development
    await page.click('[data-testid="development-tab"]');
    await expect(page.locator('[data-testid="development-config"]')).toBeVisible();
  });

  test('should add new environment variable', async ({ page }) => {
    await page.click('[data-testid="add-variable"]');
    
    // Fill variable form
    await page.fill('[data-testid="variable-key"]', 'NEW_TEST_VAR');
    await page.fill('[data-testid="variable-value"]', 'test-value-123');
    await page.fill('[data-testid="variable-description"]', 'Test variable for E2E testing');
    
    await page.click('[data-testid="save-variable"]');
    
    // Verify variable appears in list
    await expect(page.locator('[data-testid="variable-NEW_TEST_VAR"]')).toBeVisible();
    await expect(page.locator('[data-testid="variable-NEW_TEST_VAR"]')).toContainText('test-value-123');
  });

  test('should edit existing environment variable', async ({ page }) => {
    // Find first variable and click edit
    await page.click('[data-testid="edit-variable"]:first-child');
    
    // Modify value
    const newValue = `updated-${Date.now()}`;
    await page.fill('[data-testid="variable-value"]', newValue);
    await page.click('[data-testid="save-variable"]');
    
    // Verify updated value appears
    await expect(page.locator('[data-testid="variable-value"]')).toContainText(newValue);
  });

  test('should delete environment variable', async ({ page }) => {
    // First add a variable to delete
    await page.click('[data-testid="add-variable"]');
    await page.fill('[data-testid="variable-key"]', 'DELETE_ME_VAR');
    await page.fill('[data-testid="variable-value"]', 'will-be-deleted');
    await page.click('[data-testid="save-variable"]');
    
    // Verify it exists
    await expect(page.locator('[data-testid="variable-DELETE_ME_VAR"]')).toBeVisible();
    
    // Delete it
    await page.click('[data-testid="delete-variable-DELETE_ME_VAR"]');
    await page.click('[data-testid="confirm-delete"]');
    
    // Verify it's gone
    await expect(page.locator('[data-testid="variable-DELETE_ME_VAR"]')).not.toBeVisible();
  });

  test('should handle secret variables', async ({ page }) => {
    await page.click('[data-testid="add-variable"]');
    
    // Fill secret variable
    await page.fill('[data-testid="variable-key"]', 'SECRET_API_KEY');
    await page.fill('[data-testid="variable-value"]', 'super-secret-key-123');
    await page.check('[data-testid="is-secret"]');
    await page.click('[data-testid="save-variable"]');
    
    // Verify secret is masked
    const secretVariable = page.locator('[data-testid="variable-SECRET_API_KEY"]');
    await expect(secretVariable).toBeVisible();
    await expect(secretVariable.locator('[data-testid="variable-value"]')).toContainText('****');
    
    // Should have reveal button
    await expect(secretVariable.locator('[data-testid="reveal-secret"]')).toBeVisible();
  });

  test('should reveal and hide secret values', async ({ page }) => {
    // Add a secret first
    await page.click('[data-testid="add-variable"]');
    await page.fill('[data-testid="variable-key"]', 'REVEAL_TEST_SECRET');
    await page.fill('[data-testid="variable-value"]', 'reveal-me-123');
    await page.check('[data-testid="is-secret"]');
    await page.click('[data-testid="save-variable"]');
    
    const secretVariable = page.locator('[data-testid="variable-REVEAL_TEST_SECRET"]');
    
    // Click reveal
    await secretVariable.locator('[data-testid="reveal-secret"]').click();
    await expect(secretVariable.locator('[data-testid="variable-value"]')).toContainText('reveal-me-123');
    
    // Click hide
    await secretVariable.locator('[data-testid="hide-secret"]').click();
    await expect(secretVariable.locator('[data-testid="variable-value"]')).toContainText('****');
  });

  test('should use configuration templates', async ({ page }) => {
    await page.click('[data-testid="use-template"]');
    
    // Select Node.js template
    await page.click('[data-testid="template-nodejs"]');
    await page.click('[data-testid="apply-template"]');
    
    // Should add template variables
    await expect(page.locator('[data-testid="variable-NODE_ENV"]')).toBeVisible();
    await expect(page.locator('[data-testid="variable-PORT"]')).toBeVisible();
  });

  test('should validate variable names', async ({ page }) => {
    await page.click('[data-testid="add-variable"]');
    
    // Try invalid variable name
    await page.fill('[data-testid="variable-key"]', 'invalid-name-with-spaces');
    await page.fill('[data-testid="variable-value"]', 'test');
    await page.click('[data-testid="save-variable"]');
    
    // Should show validation error
    await expect(page.locator('[data-testid="key-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="key-error"]')).toContainText('Invalid variable name');
  });

  test('should export configuration', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-config"]');
    const download = await downloadPromise;
    
    expect(download.suggestedFilename()).toMatch(/config.*\.env/);
  });

  test('should import configuration', async ({ page }) => {
    // Create a test .env file content
    const envContent = `
TEST_IMPORT_VAR=imported-value
ANOTHER_VAR=another-value
# This is a comment
SECRET_VAR=secret-value
`;
    
    // Upload file (this is tricky to test in E2E, might need special setup)
    await page.click('[data-testid="import-config"]');
    
    // For now, test the UI elements exist
    await expect(page.locator('[data-testid="file-upload"]')).toBeVisible();
    await expect(page.locator('[data-testid="import-preview"]')).toBeVisible();
  });
});

test.describe('Configuration Security', () => {
  test('should require authentication for sensitive operations', async ({ page }) => {
    // Navigate to production config
    await page.goto('/projects');
    await page.click('[data-testid="project-card"]:first-child');
    await page.click('[data-testid="project-settings"]');
    await page.click('[data-testid="configuration-tab"]');
    await page.click('[data-testid="production-tab"]');
    
    // Try to reveal a production secret
    await page.click('[data-testid="reveal-secret"]:first-child');
    
    // Should require password confirmation
    await expect(page.locator('[data-testid="auth-challenge"]')).toBeVisible();
    await page.fill('[data-testid="confirm-password"]', 'TestPassword123!');
    await page.click('[data-testid="confirm-auth"]');
    
    // Secret should be revealed after authentication
    await expect(page.locator('[data-testid="secret-value"]')).not.toContainText('****');
  });

  test('should audit configuration changes', async ({ page }) => {
    await page.goto('/projects');
    await page.click('[data-testid="project-card"]:first-child');
    await page.click('[data-testid="project-settings"]');
    await page.click('[data-testid="configuration-tab"]');
    
    // Make a configuration change
    await page.click('[data-testid="add-variable"]');
    await page.fill('[data-testid="variable-key"]', 'AUDIT_TEST_VAR');
    await page.fill('[data-testid="variable-value"]', 'audit-test-value');
    await page.click('[data-testid="save-variable"]');
    
    // Check audit log
    await page.click('[data-testid="audit-log"]');
    await expect(page.locator('[data-testid="audit-entry"]:first-child')).toContainText('AUDIT_TEST_VAR');
    await expect(page.locator('[data-testid="audit-entry"]:first-child')).toContainText('create');
  });

  test('should validate environment isolation', async ({ page }) => {
    await page.goto('/projects');
    await page.click('[data-testid="project-card"]:first-child');
    await page.click('[data-testid="project-settings"]');
    await page.click('[data-testid="configuration-tab"]');
    
    // Add variable to development
    await page.click('[data-testid="development-tab"]');
    await page.click('[data-testid="add-variable"]');
    await page.fill('[data-testid="variable-key"]', 'DEV_ONLY_VAR');
    await page.fill('[data-testid="variable-value"]', 'dev-value');
    await page.click('[data-testid="save-variable"]');
    
    // Verify it's not in production
    await page.click('[data-testid="production-tab"]');
    await expect(page.locator('[data-testid="variable-DEV_ONLY_VAR"]')).not.toBeVisible();
    
    // Verify it's still in development
    await page.click('[data-testid="development-tab"]');
    await expect(page.locator('[data-testid="variable-DEV_ONLY_VAR"]')).toBeVisible();
  });
});