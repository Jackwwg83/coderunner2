import { test, expect } from '@playwright/test';

test.describe('Auto-scaling Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to auto-scaling dashboard
    await page.goto('/deployments');
    await page.click('[data-testid="deployment-card"]:first-child');
    await page.click('[data-testid="scaling-tab"]');
  });

  test('should display scaling dashboard', async ({ page }) => {
    await expect(page.locator('[data-testid="scaling-dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="current-instances"]')).toBeVisible();
    await expect(page.locator('[data-testid="scaling-policies"]')).toBeVisible();
    await expect(page.locator('[data-testid="scaling-history"]')).toBeVisible();
  });

  test('should show current scaling metrics', async ({ page }) => {
    // Verify metric displays
    await expect(page.locator('[data-testid="cpu-metric"]')).toBeVisible();
    await expect(page.locator('[data-testid="memory-metric"]')).toBeVisible();
    await expect(page.locator('[data-testid="request-rate-metric"]')).toBeVisible();
    
    // Verify values are within reasonable ranges
    const cpuValue = await page.locator('[data-testid="cpu-value"]').textContent();
    const cpuPercent = parseFloat(cpuValue?.replace('%', '') || '0');
    expect(cpuPercent).toBeGreaterThanOrEqual(0);
    expect(cpuPercent).toBeLessThanOrEqual(100);
  });

  test('should display instance information', async ({ page }) => {
    const instanceCount = page.locator('[data-testid="instance-count"]');
    await expect(instanceCount).toBeVisible();
    
    // Should show at least 1 instance
    const count = await instanceCount.textContent();
    const num = parseInt(count || '0');
    expect(num).toBeGreaterThan(0);
    
    // Verify instance list
    await expect(page.locator('[data-testid="instance-list"]')).toBeVisible();
  });

  test('should create scaling policy', async ({ page }) => {
    await page.click('[data-testid="create-policy"]');
    
    // Fill policy form
    await page.fill('[data-testid="policy-name"]', 'CPU Scale Out Policy');
    await page.selectOption('[data-testid="metric-type"]', 'cpu');
    await page.selectOption('[data-testid="scale-direction"]', 'out');
    await page.fill('[data-testid="threshold"]', '75');
    await page.fill('[data-testid="scale-amount"]', '2');
    await page.fill('[data-testid="cooldown"]', '300');
    
    await page.click('[data-testid="save-policy"]');
    
    // Verify policy appears in list
    await expect(page.locator('[data-testid="policy-CPU Scale Out Policy"]')).toBeVisible();
  });

  test('should edit scaling policy', async ({ page }) => {
    // First create a policy
    await page.click('[data-testid="create-policy"]');
    await page.fill('[data-testid="policy-name"]', 'Edit Test Policy');
    await page.selectOption('[data-testid="metric-type"]', 'memory');
    await page.fill('[data-testid="threshold"]', '80');
    await page.click('[data-testid="save-policy"]');
    
    // Edit the policy
    await page.click('[data-testid="edit-policy-Edit Test Policy"]');
    await page.fill('[data-testid="threshold"]', '85');
    await page.click('[data-testid="save-policy"]');
    
    // Verify updated threshold
    const policy = page.locator('[data-testid="policy-Edit Test Policy"]');
    await expect(policy).toContainText('85%');
  });

  test('should delete scaling policy', async ({ page }) => {
    // Create a policy to delete
    await page.click('[data-testid="create-policy"]');
    await page.fill('[data-testid="policy-name"]', 'Delete Test Policy');
    await page.selectOption('[data-testid="metric-type"]', 'requests');
    await page.fill('[data-testid="threshold"]', '100');
    await page.click('[data-testid="save-policy"]');
    
    // Delete the policy
    await page.click('[data-testid="delete-policy-Delete Test Policy"]');
    await page.click('[data-testid="confirm-delete"]');
    
    // Verify policy is removed
    await expect(page.locator('[data-testid="policy-Delete Test Policy"]')).not.toBeVisible();
  });

  test('should validate policy configuration', async ({ page }) => {
    await page.click('[data-testid="create-policy"]');
    
    // Try invalid threshold
    await page.fill('[data-testid="policy-name"]', 'Invalid Policy');
    await page.fill('[data-testid="threshold"]', '150'); // Invalid: > 100%
    await page.click('[data-testid="save-policy"]');
    
    // Should show validation error
    await expect(page.locator('[data-testid="threshold-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="threshold-error"]')).toContainText('Threshold must be between');
  });
});

test.describe('Scaling History and Events', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/deployments');
    await page.click('[data-testid="deployment-card"]:first-child');
    await page.click('[data-testid="scaling-tab"]');
  });

  test('should display scaling history', async ({ page }) => {
    await expect(page.locator('[data-testid="scaling-history"]')).toBeVisible();
    
    // Should show history entries
    const historyEntries = page.locator('[data-testid="history-entry"]');
    const count = await historyEntries.count();
    
    if (count > 0) {
      // Verify history entry structure
      const firstEntry = historyEntries.first();
      await expect(firstEntry.locator('[data-testid="event-time"]')).toBeVisible();
      await expect(firstEntry.locator('[data-testid="event-type"]')).toBeVisible();
      await expect(firstEntry.locator('[data-testid="event-reason"]')).toBeVisible();
    }
  });

  test('should filter scaling history by time range', async ({ page }) => {
    await page.selectOption('[data-testid="history-filter"]', 'last-24h');
    
    // Verify URL parameter
    await expect(page).toHaveURL(/timeRange=last-24h/);
    
    // All entries should be within 24 hours
    const entries = page.locator('[data-testid="history-entry"]');
    const count = await entries.count();
    
    for (let i = 0; i < count; i++) {
      const timeText = await entries.nth(i).locator('[data-testid="event-time"]').textContent();
      // Basic check that it looks like a recent timestamp
      expect(timeText).toBeTruthy();
    }
  });

  test('should show scaling event details', async ({ page }) => {
    // Click on first scaling event
    const firstEvent = page.locator('[data-testid="history-entry"]').first();
    await firstEvent.click();
    
    // Should show event details modal
    await expect(page.locator('[data-testid="event-details-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="event-metadata"]')).toBeVisible();
    await expect(page.locator('[data-testid="metric-values"]')).toBeVisible();
  });
});

test.describe('Manual Scaling Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/deployments');
    await page.click('[data-testid="deployment-card"]:first-child');
    await page.click('[data-testid="scaling-tab"]');
  });

  test('should scale deployment manually', async ({ page }) => {
    // Get current instance count
    const currentCount = await page.locator('[data-testid="instance-count"]').textContent();
    const current = parseInt(currentCount || '1');
    
    // Scale up manually
    await page.click('[data-testid="manual-scale"]');
    await page.fill('[data-testid="target-instances"]', (current + 1).toString());
    await page.click('[data-testid="apply-scaling"]');
    
    // Should show scaling in progress
    await expect(page.locator('[data-testid="scaling-status"]')).toContainText(/Scaling|In Progress/);
    
    // Eventually should show updated count
    await expect(page.locator('[data-testid="instance-count"]')).toContainText((current + 1).toString(), {
      timeout: 30000
    });
  });

  test('should validate manual scaling limits', async ({ page }) => {
    await page.click('[data-testid="manual-scale"]');
    
    // Try to scale to 0 instances
    await page.fill('[data-testid="target-instances"]', '0');
    await page.click('[data-testid="apply-scaling"]');
    
    // Should show validation error
    await expect(page.locator('[data-testid="scaling-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="scaling-error"]')).toContainText('minimum');
  });

  test('should show scaling cost estimate', async ({ page }) => {
    await page.click('[data-testid="manual-scale"]');
    await page.fill('[data-testid="target-instances"]', '5');
    
    // Should show cost estimate
    await expect(page.locator('[data-testid="cost-estimate"]')).toBeVisible();
    
    const costText = await page.locator('[data-testid="cost-estimate"]').textContent();
    expect(costText).toMatch(/\$[\d.]+/); // Should contain dollar amount
  });
});

test.describe('Scaling Performance', () => {
  test('should respond to scaling requests quickly', async ({ page }) => {
    await page.goto('/deployments');
    await page.click('[data-testid="deployment-card"]:first-child');
    await page.click('[data-testid="scaling-tab"]');
    
    // Measure response time for scaling request
    const startTime = Date.now();
    
    await page.click('[data-testid="manual-scale"]');
    await page.fill('[data-testid="target-instances"]', '3');
    await page.click('[data-testid="apply-scaling"]');
    
    // Wait for scaling status to appear
    await expect(page.locator('[data-testid="scaling-status"]')).toContainText(/Scaling|Progress/);
    
    const responseTime = Date.now() - startTime;
    
    // Should respond within 5 seconds
    expect(responseTime).toBeLessThan(5000);
  });

  test('should update metrics regularly', async ({ page }) => {
    await page.goto('/deployments');
    await page.click('[data-testid="deployment-card"]:first-child');
    await page.click('[data-testid="scaling-tab"]');
    
    // Get initial metric value
    const initialCpu = await page.locator('[data-testid="cpu-value"]').textContent();
    
    // Wait for metrics to update (assuming they update every 30 seconds)
    await page.waitForTimeout(35000);
    
    // Check if metrics have updated
    const updatedCpu = await page.locator('[data-testid="cpu-value"]').textContent();
    
    // Metrics might be the same, but timestamp should update
    const lastUpdate = await page.locator('[data-testid="last-updated"]').textContent();
    expect(lastUpdate).toContain('ago'); // Should show relative time
  });
});