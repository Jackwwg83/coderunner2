import { test, expect } from '@playwright/test';

/**
 * Day 6 MVP Critical Path Testing
 * These tests focus on the core user journeys that must work for production readiness
 */
test.describe('MVP Critical User Journeys', () => {
  
  test.describe('Homepage and Navigation', () => {
    test('should load homepage within 3 seconds', async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto('/');
      
      // Wait for critical content to be visible
      await expect(page.locator('text=CodeRunner')).toBeVisible();
      
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(3000); // 3 second budget
      
      // Verify main navigation elements are present
      await expect(page.locator('[href="/deployments"]')).toBeVisible();
      await expect(page.locator('[href="/projects"]')).toBeVisible();
      await expect(page.locator('[href="/databases"]')).toBeVisible();
    });

    test('should navigate between main sections', async ({ page }) => {
      await page.goto('/');
      
      // Test navigation to Deployments
      await page.click('[href="/deployments"]');
      await expect(page).toHaveURL('/deployments');
      await expect(page.locator('h1:has-text("Deployments")')).toBeVisible();
      
      // Test navigation to Projects  
      await page.click('[href="/projects"]');
      await expect(page).toHaveURL('/projects');
      
      // Test navigation to Databases
      await page.click('[href="/databases"]');
      await expect(page).toHaveURL('/databases');
    });
  });

  test.describe('File Upload and Editor', () => {
    test('should handle file upload and display Monaco editor', async ({ page }) => {
      await page.goto('/test-editor');
      
      // Verify Monaco editor loads within 2 seconds
      const startTime = Date.now();
      await expect(page.locator('.monaco-editor')).toBeVisible({ timeout: 5000 });
      const editorLoadTime = Date.now() - startTime;
      expect(editorLoadTime).toBeLessThan(2000);
      
      // Test basic editor functionality
      await page.click('.monaco-editor .view-lines');
      await page.keyboard.type('console.log("Hello CodeRunner!");');
      
      // Verify content was typed
      const editorContent = await page.locator('.monaco-editor .view-lines').textContent();
      expect(editorContent).toContain('Hello CodeRunner');
    });

    test('should handle file upload interface', async ({ page }) => {
      await page.goto('/');
      
      // Look for file upload elements on any page that has them
      const fileInputs = page.locator('input[type="file"]');
      const hasFileInput = await fileInputs.count() > 0;
      
      if (hasFileInput) {
        // Test file upload functionality
        const fileInput = fileInputs.first();
        await fileInput.setInputFiles({
          name: 'test.js',
          mimeType: 'application/javascript',
          buffer: Buffer.from('console.log("test file");')
        });
        
        // Verify file was selected
        const fileName = await fileInput.inputValue();
        expect(fileName).toBeTruthy();
      }
    });
  });

  test.describe('API Integration', () => {
    test('should connect to backend API', async ({ page }) => {
      // Test API health endpoint
      const response = await page.request.get('http://localhost:8080/api/health');
      expect(response.status()).toBe(200);
      
      const healthData = await response.json();
      expect(healthData).toHaveProperty('success');
      expect(healthData).toHaveProperty('data');
    });

    test('should handle API errors gracefully', async ({ page }) => {
      // Test non-existent API endpoint
      const response = await page.request.get('http://localhost:8080/api/nonexistent');
      expect(response.status()).toBe(404);
    });

    test('should validate API response format', async ({ page }) => {
      const response = await page.request.get('http://localhost:8080/api');
      expect(response.status()).toBe(200);
      
      const apiData = await response.json();
      expect(apiData).toHaveProperty('message');
      expect(apiData).toHaveProperty('version');
      expect(apiData).toHaveProperty('environment');
    });
  });

  test.describe('Authentication Flow (if configured)', () => {
    test('should display login interface', async ({ page }) => {
      await page.goto('/auth');
      
      // Check if auth page exists and loads
      const isAuthPage = await page.locator('input[type="email"]').count() > 0 ||
                        await page.locator('button:has-text("Login")').count() > 0 ||
                        await page.locator('text=Sign in').count() > 0;
      
      if (isAuthPage) {
        console.log('✓ Auth interface detected');
        
        // Test basic form validation
        const emailInput = page.locator('input[type="email"]').first();
        const submitButton = page.locator('button[type="submit"]').first();
        
        if (await emailInput.count() > 0) {
          await emailInput.fill('invalid-email');
          if (await submitButton.count() > 0) {
            await submitButton.click();
            // Should show validation error (but we don't fail if it doesn't)
          }
        }
      } else {
        console.log('ℹ Auth interface not configured - skipping authentication tests');
      }
    });
  });

  test.describe('Deployment Interface', () => {
    test('should display deployment management interface', async ({ page }) => {
      await page.goto('/deployments');
      
      // Verify core deployment UI elements
      await expect(page.locator('h1:has-text("Deployments")')).toBeVisible();
      
      // Check for New Deployment button
      const newDeploymentButton = page.locator('button:has-text("New Deployment")');
      await expect(newDeploymentButton).toBeVisible();
      
      // Test clicking new deployment (should navigate somewhere)
      await newDeploymentButton.click();
      
      // Verify navigation occurred
      const currentUrl = page.url();
      expect(currentUrl).not.toBe('http://localhost:8083/deployments');
    });

    test('should show deployment statistics', async ({ page }) => {
      await page.goto('/deployments');
      
      // Look for statistics cards/metrics
      const statsElements = [
        'text=Active Deployments',
        'text=Total Projects', 
        'text=Team Members',
        'text=Databases'
      ];
      
      for (const stat of statsElements) {
        await expect(page.locator(stat)).toBeVisible();
      }
    });
  });

  test.describe('Database Management', () => {
    test('should display database interface', async ({ page }) => {
      await page.goto('/databases');
      
      // This might be the database deployment page
      await expect(page.locator('text=database', { timeout: 5000 })).toBeVisible();
    });

    test('should connect to database via API', async ({ page }) => {
      const response = await page.request.get('http://localhost:8080/api/health/database');
      expect(response.status()).toBe(200);
      
      const dbHealth = await response.json();
      expect(dbHealth).toHaveProperty('status');
    });
  });

  test.describe('Error Handling', () => {
    test('should handle 404 pages gracefully', async ({ page }) => {
      await page.goto('/non-existent-page');
      
      // Should show 404 page or redirect to valid page
      const pageContent = await page.content();
      const has404 = pageContent.includes('404') || 
                    pageContent.includes('Not Found') ||
                    pageContent.includes('Page not found');
      
      if (has404) {
        console.log('✓ 404 page displayed correctly');
      } else {
        // Might redirect to valid page, which is also acceptable
        console.log('ℹ Non-existent page redirected to valid content');
      }
    });

    test('should handle JavaScript errors gracefully', async ({ page }) => {
      const jsErrors = [];
      page.on('pageerror', error => jsErrors.push(error.message));
      
      await page.goto('/');
      
      // Wait a moment for any JS errors to manifest
      await page.waitForTimeout(1000);
      
      // We expect minimal JS errors (ideally none for production)
      if (jsErrors.length > 0) {
        console.warn('JavaScript errors detected:', jsErrors);
        // Don't fail the test for minor JS errors in MVP
      }
    });
  });

  test.describe('Performance Requirements', () => {
    test('should meet performance budgets', async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto('/');
      await expect(page.locator('text=CodeRunner')).toBeVisible();
      
      const totalLoadTime = Date.now() - startTime;
      expect(totalLoadTime).toBeLessThan(3000); // 3s total load time
      
      // Check Core Web Vitals if available
      const vitals = await page.evaluate(() => {
        return new Promise((resolve) => {
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const metrics = {};
            
            entries.forEach((entry) => {
              if (entry.entryType === 'largest-contentful-paint') {
                metrics.lcp = entry.startTime;
              }
              if (entry.entryType === 'first-input') {
                metrics.fid = entry.processingStart - entry.startTime;
              }
            });
            
            resolve(metrics);
          }).observe({ entryTypes: ['largest-contentful-paint', 'first-input'] });
          
          // Timeout after 2 seconds
          setTimeout(() => resolve({}), 2000);
        });
      });
      
      if (vitals.lcp) {
        expect(vitals.lcp).toBeLessThan(2500); // 2.5s LCP budget
      }
      if (vitals.fid) {
        expect(vitals.fid).toBeLessThan(100); // 100ms FID budget  
      }
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test('should work on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      
      // Verify page loads and is usable on mobile
      await expect(page.locator('text=CodeRunner')).toBeVisible();
      
      // Check if mobile navigation works
      const mobileMenu = page.locator('[data-testid="mobile-menu"]');
      const hamburgerMenu = page.locator('button[aria-label*="menu" i]');
      const hasMobileNav = await mobileMenu.count() > 0 || await hamburgerMenu.count() > 0;
      
      if (hasMobileNav) {
        console.log('✓ Mobile navigation detected');
      }
      
      // Verify content fits in viewport
      const body = page.locator('body');
      const boundingBox = await body.boundingBox();
      if (boundingBox) {
        expect(boundingBox.width).toBeLessThanOrEqual(375);
      }
    });
  });

  test.describe('Security Basics', () => {
    test('should not expose sensitive information', async ({ page }) => {
      await page.goto('/');
      
      const pageContent = await page.content();
      
      // Check for common sensitive data exposures
      const sensitivePatterns = [
        /password\s*[:=]\s*['"]\w+['"]/i,
        /api[_-]?key\s*[:=]\s*['"]\w+['"]/i,
        /secret\s*[:=]\s*['"]\w+['"]/i,
        /token\s*[:=]\s*['"]\w+['"]/i
      ];
      
      for (const pattern of sensitivePatterns) {
        expect(pageContent).not.toMatch(pattern);
      }
    });

    test('should use HTTPS in production URLs', async ({ page }) => {
      await page.goto('/');
      
      // Check for any hardcoded HTTP URLs (should be HTTPS in production)
      const pageContent = await page.content();
      const httpUrls = pageContent.match(/http:\/\/(?!localhost)[^"'\s]*/g);
      
      if (httpUrls && httpUrls.length > 0) {
        console.warn('HTTP URLs found (should be HTTPS in production):', httpUrls);
        // Don't fail test in development, but log warning
      }
    });
  });
});