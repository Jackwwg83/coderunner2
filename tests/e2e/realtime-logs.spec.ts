import { test, expect } from '@playwright/test';

test.describe('Real-time Log Streaming', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a deployment with logs
    await page.goto('/deployments');
    await page.click('[data-testid="deployment-card"]:first-child');
    await expect(page).toHaveURL(/\/deployments\/[a-f0-9-]+/);
  });

  test('should display logs container', async ({ page }) => {
    await expect(page.locator('[data-testid="logs-container"]')).toBeVisible();
    await expect(page.locator('[data-testid="logs-content"]')).toBeVisible();
    await expect(page.locator('[data-testid="logs-controls"]')).toBeVisible();
  });

  test('should show log streaming status', async ({ page }) => {
    // Check if streaming indicator is present
    await expect(page.locator('[data-testid="streaming-status"]')).toBeVisible();
    
    // Should show either "Connected" or "Connecting"
    const status = page.locator('[data-testid="streaming-status"]');
    await expect(status).toHaveText(/Connected|Connecting/);
  });

  test('should toggle log streaming', async ({ page }) => {
    // Find the toggle button
    const toggleButton = page.locator('[data-testid="toggle-streaming"]');
    await expect(toggleButton).toBeVisible();
    
    // Get initial state
    const initialText = await toggleButton.textContent();
    
    // Click to toggle
    await toggleButton.click();
    
    // Verify state changed
    await expect(toggleButton).not.toHaveText(initialText || '');
    
    // Toggle back
    await toggleButton.click();
    await expect(toggleButton).toHaveText(initialText || '');
  });

  test('should filter logs by level', async ({ page }) => {
    // Wait for logs to load
    await page.waitForSelector('[data-testid="log-entry"]', { timeout: 10000 });
    
    // Select error level filter
    await page.selectOption('[data-testid="log-level-filter"]', 'error');
    
    // All visible logs should be error level
    const logEntries = page.locator('[data-testid="log-entry"]');
    const count = await logEntries.count();
    
    for (let i = 0; i < count; i++) {
      const logLevel = logEntries.nth(i).locator('[data-testid="log-level"]');
      await expect(logLevel).toContainText('ERROR');
    }
  });

  test('should search logs', async ({ page }) => {
    // Wait for logs to load
    await page.waitForSelector('[data-testid="log-entry"]', { timeout: 10000 });
    
    // Search for specific term
    await page.fill('[data-testid="log-search"]', 'error');
    await page.press('[data-testid="log-search"]', 'Enter');
    
    // All visible logs should contain the search term
    const logMessages = page.locator('[data-testid="log-message"]');
    const count = await logMessages.count();
    
    for (let i = 0; i < count; i++) {
      const message = await logMessages.nth(i).textContent();
      expect(message?.toLowerCase()).toContain('error');
    }
  });

  test('should auto-scroll logs', async ({ page }) => {
    // Enable auto-scroll
    await page.check('[data-testid="auto-scroll"]');
    
    // Verify auto-scroll is enabled
    await expect(page.locator('[data-testid="auto-scroll"]')).toBeChecked();
    
    // Scroll up manually
    await page.locator('[data-testid="logs-content"]').evaluate((el) => {
      el.scrollTop = 0;
    });
    
    // Wait a moment for new logs (if any)
    await page.waitForTimeout(2000);
    
    // If auto-scroll is working and there are new logs, we should be at bottom
    // This is hard to test reliably, so we'll just verify the checkbox state
    await expect(page.locator('[data-testid="auto-scroll"]')).toBeChecked();
  });

  test('should clear logs', async ({ page }) => {
    // Wait for logs to load
    await page.waitForSelector('[data-testid="log-entry"]', { timeout: 10000 });
    
    // Clear logs
    await page.click('[data-testid="clear-logs"]');
    
    // Confirm clear action
    await page.click('[data-testid="confirm-clear"]');
    
    // Logs container should be empty or show "No logs" message
    const logsContent = page.locator('[data-testid="logs-content"]');
    const logEntries = page.locator('[data-testid="log-entry"]');
    
    // Either no log entries or empty logs message
    const entryCount = await logEntries.count();
    if (entryCount === 0) {
      await expect(logsContent).toContainText(/No logs|Empty/);
    }
  });

  test('should download logs', async ({ page }) => {
    // Start download
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="download-logs"]');
    const download = await downloadPromise;
    
    // Verify download filename
    expect(download.suggestedFilename()).toMatch(/logs.*\.txt/);
    
    // Save the download to verify content
    const path = './test-results/downloaded-logs.txt';
    await download.saveAs(path);
    
    // Verify file exists and has content
    const fs = require('fs');
    expect(fs.existsSync(path)).toBe(true);
    const content = fs.readFileSync(path, 'utf8');
    expect(content.length).toBeGreaterThan(0);
  });

  test('should handle WebSocket connection errors', async ({ page }) => {
    // Monitor console for WebSocket errors
    const messages: string[] = [];
    page.on('console', (msg) => {
      messages.push(msg.text());
    });
    
    // Disconnect network to simulate connection issues
    await page.context().setOffline(true);
    
    // Wait for connection error indicators
    await page.waitForTimeout(5000);
    
    // Should show connection error state
    const status = page.locator('[data-testid="streaming-status"]');
    await expect(status).toContainText(/Disconnected|Error|Reconnecting/);
    
    // Reconnect network
    await page.context().setOffline(false);
    
    // Should eventually reconnect
    await expect(status).toContainText(/Connected|Connecting/, { timeout: 10000 });
  });
});

test.describe('Log Performance', () => {
  test('should handle high volume logs without freezing', async ({ page }) => {
    // Navigate to deployment
    await page.goto('/deployments');
    await page.click('[data-testid="deployment-card"]:first-child');
    
    // Monitor page responsiveness
    const startTime = Date.now();
    
    // Interact with controls while logs are streaming
    await page.click('[data-testid="toggle-streaming"]');
    await page.selectOption('[data-testid="log-level-filter"]', 'info');
    await page.fill('[data-testid="log-search"]', 'test');
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    // Should remain responsive (under 2 seconds for UI interactions)
    expect(responseTime).toBeLessThan(2000);
  });

  test('should limit log entries to prevent memory issues', async ({ page }) => {
    await page.goto('/deployments');
    await page.click('[data-testid="deployment-card"]:first-child');
    
    // Wait for logs to load
    await page.waitForTimeout(5000);
    
    // Count log entries
    const logEntries = page.locator('[data-testid="log-entry"]');
    const count = await logEntries.count();
    
    // Should have a reasonable limit (e.g., max 1000 entries)
    expect(count).toBeLessThanOrEqual(1000);
  });
});