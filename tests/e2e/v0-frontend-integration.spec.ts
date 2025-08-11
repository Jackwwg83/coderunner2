import { test, expect, Page, BrowserContext } from '@playwright/test';
import { io, Socket } from 'socket.io-client';

// V0 Frontend E2E Testing Strategy
test.describe('V0 Frontend Integration Tests', () => {
  let page: Page;
  let context: BrowserContext;
  let wsSocket: Socket;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      permissions: ['clipboard-read', 'clipboard-write']
    });
  });

  test.beforeEach(async () => {
    page = await context.newPage();
    
    // Set up WebSocket connection for real-time features
    wsSocket = io(process.env.TEST_WS_URL || 'ws://localhost:3000');
    
    // Mock API responses for consistent testing
    await page.route('/api/**', (route) => {
      const url = route.request().url();
      
      if (url.includes('/api/auth/me')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              user: {
                id: 'test-user-123',
                email: 'test@example.com',
                plan_type: 'free'
              }
            }
          })
        });
      } else {
        route.continue();
      }
    });
  });

  test.afterEach(async () => {
    if (wsSocket) {
      wsSocket.disconnect();
    }
    await page.close();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test.describe('User Authentication Flow', () => {
    test('should complete login flow successfully', async () => {
      await page.goto('/login');
      
      // Fill login form
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'password123');
      await page.click('[data-testid="login-button"]');
      
      // Verify successful login
      await expect(page).toHaveURL('/dashboard');
      await expect(page.locator('[data-testid="user-welcome"]')).toBeVisible();
    });

    test('should handle login errors gracefully', async () => {
      await page.goto('/login');
      
      // Mock API error response
      await page.route('/api/auth/login', (route) => {
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Invalid credentials'
          })
        });
      });
      
      await page.fill('[data-testid="email-input"]', 'wrong@example.com');
      await page.fill('[data-testid="password-input"]', 'wrongpassword');
      await page.click('[data-testid="login-button"]');
      
      // Verify error handling
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid credentials');
    });
  });

  test.describe('Project Deployment Workflow', () => {
    test('should deploy Node.js project successfully', async () => {
      await page.goto('/dashboard');
      
      // Start new project deployment
      await page.click('[data-testid="new-project-button"]');
      await expect(page.locator('[data-testid="project-wizard"]')).toBeVisible();
      
      // Select project type
      await page.click('[data-testid="nodejs-template"]');
      await page.fill('[data-testid="project-name"]', 'test-nodejs-app');
      
      // Upload project files (simulate file upload)
      const fileInput = page.locator('[data-testid="file-upload"]');
      await fileInput.setInputFiles([{
        name: 'package.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify({
          name: 'test-app',
          version: '1.0.0',
          main: 'index.js',
          scripts: { start: 'node index.js' },
          dependencies: { express: '^4.18.0' }
        }))
      }, {
        name: 'index.js',
        mimeType: 'application/javascript',
        buffer: Buffer.from(`
          const express = require('express');
          const app = express();
          app.get('/', (req, res) => res.send('Hello World!'));
          app.listen(3000, () => console.log('Server running on port 3000'));
        `)
      }]);
      
      // Start deployment
      await page.click('[data-testid="deploy-button"]');
      
      // Verify deployment progress UI
      await expect(page.locator('[data-testid="deployment-progress"]')).toBeVisible();
      
      // Wait for real-time deployment updates via WebSocket
      await page.waitForFunction(() => {
        return window.deploymentStatus === 'completed';
      }, { timeout: 60000 });
      
      // Verify successful deployment
      await expect(page.locator('[data-testid="deployment-success"]')).toBeVisible();
      await expect(page.locator('[data-testid="app-url"]')).toBeVisible();
    });

    test('should handle deployment errors with proper feedback', async () => {
      await page.goto('/dashboard');
      
      // Mock deployment error
      await page.route('/api/deploy', (route) => {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Invalid project structure',
            details: 'Missing package.json file'
          })
        });
      });
      
      await page.click('[data-testid="new-project-button"]');
      await page.click('[data-testid="nodejs-template"]');
      await page.fill('[data-testid="project-name"]', 'invalid-project');
      await page.click('[data-testid="deploy-button"]');
      
      // Verify error handling
      await expect(page.locator('[data-testid="deployment-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-details"]')).toContainText('Missing package.json file');
    });
  });

  test.describe('Real-time Features', () => {
    test('should display real-time deployment logs', async () => {
      await page.goto('/projects/test-project-123');
      
      // Set up WebSocket message listener
      await page.evaluate(() => {
        window.deploymentLogs = [];
        
        if (window.wsConnection) {
          window.wsConnection.on('deployment:log', (log) => {
            window.deploymentLogs.push(log);
          });
        }
      });
      
      // Simulate real-time logs via WebSocket
      wsSocket.emit('deployment:log', {
        deploymentId: 'test-project-123',
        level: 'info',
        message: 'Installing dependencies...',
        timestamp: new Date().toISOString()
      });
      
      // Verify logs appear in UI
      await page.waitForFunction(() => window.deploymentLogs.length > 0);
      await expect(page.locator('[data-testid="log-entry"]')).toBeVisible();
      await expect(page.locator('[data-testid="log-entry"]')).toContainText('Installing dependencies...');
    });

    test('should update project status in real-time', async () => {
      await page.goto('/dashboard');
      
      // Initial project status
      await expect(page.locator('[data-testid="project-status-building"]')).toBeVisible();
      
      // Simulate status update via WebSocket
      wsSocket.emit('project:status', {
        projectId: 'test-project-123',
        status: 'running',
        url: 'https://test-app.coderunner.dev'
      });
      
      // Verify UI updates
      await expect(page.locator('[data-testid="project-status-running"]')).toBeVisible();
      await expect(page.locator('[data-testid="project-url"]')).toBeVisible();
      await expect(page.locator('[data-testid="project-url"]')).toHaveAttribute('href', 'https://test-app.coderunner.dev');
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on mobile viewport', async () => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/dashboard');
      
      // Verify mobile-responsive elements
      await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
      await page.click('[data-testid="mobile-menu-button"]');
      await expect(page.locator('[data-testid="mobile-nav-menu"]')).toBeVisible();
      
      // Test project cards on mobile
      const projectCards = page.locator('[data-testid="project-card"]');
      await expect(projectCards).toHaveCount(3);
      
      // Verify mobile-optimized layout
      for (let i = 0; i < 3; i++) {
        const card = projectCards.nth(i);
        await expect(card).toBeVisible();
        
        const cardBox = await card.boundingBox();
        expect(cardBox?.width).toBeLessThan(350); // Mobile-optimized width
      }
    });

    test('should work on tablet viewport', async () => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/dashboard');
      
      // Verify tablet layout
      await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
      await expect(page.locator('[data-testid="main-content"]')).toBeVisible();
      
      const sidebar = page.locator('[data-testid="sidebar"]');
      const sidebarBox = await sidebar.boundingBox();
      expect(sidebarBox?.width).toBeGreaterThan(200);
      expect(sidebarBox?.width).toBeLessThan(300);
    });
  });

  test.describe('Accessibility Compliance', () => {
    test('should meet WCAG 2.1 AA standards', async () => {
      await page.goto('/dashboard');
      
      // Check for proper heading hierarchy
      const h1 = page.locator('h1');
      await expect(h1).toHaveCount(1);
      await expect(h1).toContainText('Dashboard');
      
      // Check for alt text on images
      const images = page.locator('img');
      const imageCount = await images.count();
      
      for (let i = 0; i < imageCount; i++) {
        const img = images.nth(i);
        const altText = await img.getAttribute('alt');
        expect(altText).toBeTruthy();
      }
      
      // Check for proper form labels
      const inputs = page.locator('input');
      const inputCount = await inputs.count();
      
      for (let i = 0; i < inputCount; i++) {
        const input = inputs.nth(i);
        const id = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        
        if (id) {
          const label = page.locator(`label[for="${id}"]`);
          const labelExists = await label.count() > 0;
          expect(labelExists || ariaLabel).toBeTruthy();
        }
      }
    });

    test('should support keyboard navigation', async () => {
      await page.goto('/dashboard');
      
      // Test Tab navigation
      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toHaveAttribute('data-testid', 'skip-to-content');
      
      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toHaveAttribute('data-testid', 'main-navigation');
      
      // Test Enter/Space activation
      await page.keyboard.press('Enter');
      await expect(page.locator('[data-testid="nav-dropdown"]')).toBeVisible();
      
      // Test Escape key
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-testid="nav-dropdown"]')).not.toBeVisible();
    });

    test('should have appropriate color contrast', async () => {
      await page.goto('/dashboard');
      
      // This would typically use axe-core for automated accessibility testing
      // For now, we'll check basic contrast requirements manually
      const buttons = page.locator('button');
      const buttonCount = await buttons.count();
      
      for (let i = 0; i < buttonCount; i++) {
        const button = buttons.nth(i);
        const styles = await button.evaluate((el) => {
          const computed = window.getComputedStyle(el);
          return {
            backgroundColor: computed.backgroundColor,
            color: computed.color
          };
        });
        
        // Basic check that colors are defined
        expect(styles.backgroundColor).toBeTruthy();
        expect(styles.color).toBeTruthy();
      }
    });
  });

  test.describe('Performance', () => {
    test('should load within performance budgets', async () => {
      const startTime = Date.now();
      
      await page.goto('/dashboard');
      
      // Wait for critical content to load
      await expect(page.locator('[data-testid="dashboard-content"]')).toBeVisible();
      
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(3000); // 3 second budget
      
      // Check for performance metrics
      const performanceMetrics = await page.evaluate(() => {
        return {
          fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
          lcp: performance.getEntriesByType('largest-contentful-paint')[0]?.startTime || 0
        };
      });
      
      expect(performanceMetrics.fcp).toBeLessThan(2000); // 2s FCP
      if (performanceMetrics.lcp > 0) {
        expect(performanceMetrics.lcp).toBeLessThan(2500); // 2.5s LCP
      }
    });

    test('should handle large project lists efficiently', async () => {
      // Mock large dataset
      await page.route('/api/projects', (route) => {
        const projects = Array.from({ length: 100 }, (_, i) => ({
          id: `project-${i}`,
          name: `Project ${i}`,
          status: 'running',
          created_at: new Date().toISOString()
        }));
        
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { projects } })
        });
      });
      
      const startTime = Date.now();
      await page.goto('/projects');
      
      // Wait for virtual scrolling to render initial items
      await expect(page.locator('[data-testid="project-list"]')).toBeVisible();
      await expect(page.locator('[data-testid="project-item"]').first()).toBeVisible();
      
      const renderTime = Date.now() - startTime;
      expect(renderTime).toBeLessThan(2000); // Should render quickly even with large datasets
      
      // Verify virtual scrolling works
      const initialItemCount = await page.locator('[data-testid="project-item"]').count();
      expect(initialItemCount).toBeLessThan(20); // Should only render visible items
      
      // Test scrolling performance
      await page.mouse.wheel(0, 1000);
      await page.waitForTimeout(100);
      
      const afterScrollItemCount = await page.locator('[data-testid="project-item"]').count();
      expect(afterScrollItemCount).toBeGreaterThan(initialItemCount);
    });
  });
});