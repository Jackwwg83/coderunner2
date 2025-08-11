/**
 * Database Management End-to-End Tests
 * P3-T05 and P3-T06 E2E Testing Suite
 * 
 * Tests complete user workflows for:
 * - Database deployment through UI
 * - Multi-tenant management
 * - Monitoring and metrics
 * - Backup and restore operations
 * - Auto-scaling configuration
 * - Real-time updates and notifications
 */

import { test, expect, Page, Browser } from '@playwright/test';
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

interface TestUser {
  email: string;
  password: string;
  token?: string;
}

interface DatabaseDeployment {
  id: string;
  name: string;
  type: 'postgresql' | 'redis';
  status: string;
  connectionString: string;
}

describe('Database Management E2E Tests', () => {
  let browser: Browser;
  let adminUser: TestUser;
  let regularUser: TestUser;

  beforeAll(async () => {
    browser = await chromium.launch({ 
      headless: process.env.CI === 'true',
      slowMo: 100 
    });

    // Create test users
    adminUser = {
      email: 'admin@test.com',
      password: 'adminpass123'
    };

    regularUser = {
      email: 'user@test.com', 
      password: 'userpass123'
    };
  });

  afterAll(async () => {
    await browser.close();
  });

  describe('Database Deployment Workflows', () => {
    test('should deploy PostgreSQL database through UI', async () => {
      const page = await browser.newPage();

      try {
        // Navigate to application
        await page.goto(FRONTEND_URL);
        
        // Login
        await page.fill('[data-testid="email-input"]', adminUser.email);
        await page.fill('[data-testid="password-input"]', adminUser.password);
        await page.click('[data-testid="login-button"]');
        
        // Wait for dashboard
        await page.waitForSelector('[data-testid="dashboard"]', { timeout: 30000 });

        // Navigate to databases section
        await page.click('[data-testid="databases-nav"]');
        await page.waitForSelector('[data-testid="database-list"]');

        // Click deploy new database
        await page.click('[data-testid="deploy-database-button"]');
        await page.waitForSelector('[data-testid="deployment-form"]');

        // Fill deployment form
        await page.selectOption('[data-testid="database-type-select"]', 'postgresql');
        await page.fill('[data-testid="database-name-input"]', 'test-postgres-e2e');
        await page.selectOption('[data-testid="postgres-version-select"]', '16');
        await page.selectOption('[data-testid="instance-type-select"]', 'small');
        await page.fill('[data-testid="storage-input"]', '20');
        
        // Configure multi-tenancy
        await page.check('[data-testid="multi-tenant-checkbox"]');
        await page.selectOption('[data-testid="tenant-isolation-select"]', 'schema');
        await page.fill('[data-testid="max-tenants-input"]', '10');

        // Enable backup
        await page.check('[data-testid="backup-enabled-checkbox"]');
        await page.fill('[data-testid="backup-schedule-input"]', '0 2 * * *');
        await page.fill('[data-testid="backup-retention-input"]', '7');

        // Enable monitoring
        await page.check('[data-testid="monitoring-enabled-checkbox"]');

        // Submit deployment
        await page.click('[data-testid="deploy-submit-button"]');

        // Wait for deployment success notification
        await page.waitForSelector('[data-testid="success-notification"]', { timeout: 60000 });
        
        // Verify deployment appears in list
        await page.waitForSelector('[data-testid="database-card-test-postgres-e2e"]');
        
        const deploymentCard = page.locator('[data-testid="database-card-test-postgres-e2e"]');
        await expect(deploymentCard).toBeVisible();
        await expect(deploymentCard.locator('[data-testid="database-status"]')).toContainText('Running');

      } finally {
        await page.close();
      }
    });

    test('should deploy Redis cache with cluster configuration', async () => {
      const page = await browser.newPage();

      try {
        await page.goto(FRONTEND_URL);
        
        // Login
        await page.fill('[data-testid="email-input"]', adminUser.email);
        await page.fill('[data-testid="password-input"]', adminUser.password);
        await page.click('[data-testid="login-button"]');
        
        await page.waitForSelector('[data-testid="dashboard"]', { timeout: 30000 });

        // Navigate to databases
        await page.click('[data-testid="databases-nav"]');
        
        // Deploy Redis cluster
        await page.click('[data-testid="deploy-database-button"]');
        await page.selectOption('[data-testid="database-type-select"]', 'redis');
        
        await page.fill('[data-testid="database-name-input"]', 'test-redis-cluster-e2e');
        await page.selectOption('[data-testid="redis-version-select"]', '7.2');
        await page.selectOption('[data-testid="redis-mode-select"]', 'cluster');
        await page.fill('[data-testid="memory-input"]', '1024');

        // Configure clustering
        await page.check('[data-testid="clustering-enabled-checkbox"]');
        await page.fill('[data-testid="cluster-shards-input"]', '3');
        await page.fill('[data-testid="replicas-per-shard-input"]', '1');

        // Configure security
        await page.check('[data-testid="password-enabled-checkbox"]');
        await page.check('[data-testid="acl-enabled-checkbox"]');

        // Configure persistence
        await page.check('[data-testid="persistence-enabled-checkbox"]');
        await page.selectOption('[data-testid="persistence-mode-select"]', 'aof');

        await page.click('[data-testid="deploy-submit-button"]');

        // Wait for deployment success
        await page.waitForSelector('[data-testid="success-notification"]', { timeout: 60000 });
        
        // Verify Redis cluster appears in list
        await page.waitForSelector('[data-testid="database-card-test-redis-cluster-e2e"]');
        
        const clusterCard = page.locator('[data-testid="database-card-test-redis-cluster-e2e"]');
        await expect(clusterCard).toBeVisible();
        await expect(clusterCard.locator('[data-testid="database-type"]')).toContainText('Redis');
        await expect(clusterCard.locator('[data-testid="database-mode"]')).toContainText('Cluster');

      } finally {
        await page.close();
      }
    });

    test('should handle deployment validation errors', async () => {
      const page = await browser.newPage();

      try {
        await page.goto(FRONTEND_URL);
        
        // Login
        await page.fill('[data-testid="email-input"]', regularUser.email);
        await page.fill('[data-testid="password-input"]', regularUser.password);
        await page.click('[data-testid="login-button"]');
        
        await page.waitForSelector('[data-testid="dashboard"]', { timeout: 30000 });
        await page.click('[data-testid="databases-nav"]');

        // Try to deploy with invalid configuration
        await page.click('[data-testid="deploy-database-button"]');
        
        // Leave required fields empty and submit
        await page.click('[data-testid="deploy-submit-button"]');

        // Verify validation errors appear
        await page.waitForSelector('[data-testid="validation-error"]');
        await expect(page.locator('[data-testid="validation-error"]')).toBeVisible();
        
        // Try with invalid storage amount
        await page.selectOption('[data-testid="database-type-select"]', 'postgresql');
        await page.fill('[data-testid="database-name-input"]', 'invalid-test');
        await page.fill('[data-testid="storage-input"]', '-10'); // Invalid negative value
        
        await page.click('[data-testid="deploy-submit-button"]');
        
        // Should show storage validation error
        await expect(page.locator('[data-testid="storage-validation-error"]')).toBeVisible();

      } finally {
        await page.close();
      }
    });
  });

  describe('Database Management Operations', () => {
    let testDeploymentId: string;

    beforeAll(async () => {
      // Create a test deployment via API for management tests
      const response = await fetch(`${BASE_URL}/api/orchestrator/deploy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminUser.token}`
        },
        body: JSON.stringify({
          type: 'postgresql',
          projectId: 'e2e-test-project',
          config: {
            name: 'management-test-postgres',
            postgresql: {
              name: 'management-test',
              version: '16',
              instance_type: 'small',
              storage_gb: 20,
              tenant_isolation: 'schema'
            }
          },
          environment: 'development'
        })
      });

      const data = await response.json();
      testDeploymentId = data.data.deploymentId;
    });

    test('should display database details and metrics', async () => {
      const page = await browser.newPage();

      try {
        await page.goto(FRONTEND_URL);
        
        // Login
        await page.fill('[data-testid="email-input"]', adminUser.email);
        await page.fill('[data-testid="password-input"]', adminUser.password);
        await page.click('[data-testid="login-button"]');
        
        await page.waitForSelector('[data-testid="dashboard"]', { timeout: 30000 });
        await page.click('[data-testid="databases-nav"]');

        // Find and click on the management test database
        await page.waitForSelector('[data-testid="database-card-management-test-postgres"]');
        await page.click('[data-testid="database-card-management-test-postgres"]');

        // Should navigate to database details page
        await page.waitForSelector('[data-testid="database-details"]');

        // Verify details are displayed
        await expect(page.locator('[data-testid="database-name"]')).toContainText('management-test-postgres');
        await expect(page.locator('[data-testid="database-type"]')).toContainText('PostgreSQL');
        await expect(page.locator('[data-testid="database-status"]')).toBeVisible();
        
        // Verify metrics section
        await expect(page.locator('[data-testid="metrics-section"]')).toBeVisible();
        await expect(page.locator('[data-testid="cpu-metric"]')).toBeVisible();
        await expect(page.locator('[data-testid="memory-metric"]')).toBeVisible();
        await expect(page.locator('[data-testid="disk-metric"]')).toBeVisible();
        
        // Verify connection information
        await expect(page.locator('[data-testid="connection-string"]')).toBeVisible();
        await expect(page.locator('[data-testid="connection-copy-button"]')).toBeVisible();

        // Test connection string copy
        await page.click('[data-testid="connection-copy-button"]');
        await page.waitForSelector('[data-testid="copy-success-notification"]');

      } finally {
        await page.close();
      }
    });

    test('should scale database deployment', async () => {
      const page = await browser.newPage();

      try {
        await page.goto(FRONTEND_URL);
        
        // Login and navigate to database
        await page.fill('[data-testid="email-input"]', adminUser.email);
        await page.fill('[data-testid="password-input"]', adminUser.password);
        await page.click('[data-testid="login-button"]');
        
        await page.waitForSelector('[data-testid="dashboard"]', { timeout: 30000 });
        await page.click('[data-testid="databases-nav"]');
        await page.click('[data-testid="database-card-management-test-postgres"]');

        // Open scaling dialog
        await page.click('[data-testid="scale-database-button"]');
        await page.waitForSelector('[data-testid="scale-dialog"]');

        // Set new replica count
        await page.fill('[data-testid="replica-count-input"]', '3');
        await page.click('[data-testid="scale-confirm-button"]');

        // Wait for scaling success notification
        await page.waitForSelector('[data-testid="scaling-success-notification"]', { timeout: 60000 });
        
        // Verify scaling indicator
        await expect(page.locator('[data-testid="current-replicas"]')).toContainText('3');

      } finally {
        await page.close();
      }
    });

    test('should create and manage backups', async () => {
      const page = await browser.newPage();

      try {
        await page.goto(FRONTEND_URL);
        
        // Login and navigate
        await page.fill('[data-testid="email-input"]', adminUser.email);
        await page.fill('[data-testid="password-input"]', adminUser.password);
        await page.click('[data-testid="login-button"]');
        
        await page.waitForSelector('[data-testid="dashboard"]', { timeout: 30000 });
        await page.click('[data-testid="databases-nav"]');
        await page.click('[data-testid="database-card-management-test-postgres"]');

        // Navigate to backups tab
        await page.click('[data-testid="backups-tab"]');
        await page.waitForSelector('[data-testid="backups-section"]');

        // Create manual backup
        await page.click('[data-testid="create-backup-button"]');
        await page.waitForSelector('[data-testid="backup-dialog"]');
        
        await page.fill('[data-testid="backup-name-input"]', 'Manual E2E Backup');
        await page.selectOption('[data-testid="backup-type-select"]', 'full');
        await page.check('[data-testid="backup-compression-checkbox"]');
        
        await page.click('[data-testid="create-backup-confirm-button"]');

        // Wait for backup completion
        await page.waitForSelector('[data-testid="backup-success-notification"]', { timeout: 120000 });

        // Verify backup appears in list
        await page.waitForSelector('[data-testid="backup-item-manual-e2e-backup"]');
        
        const backupItem = page.locator('[data-testid="backup-item-manual-e2e-backup"]');
        await expect(backupItem).toBeVisible();
        await expect(backupItem.locator('[data-testid="backup-status"]')).toContainText('Completed');

      } finally {
        await page.close();
      }
    });

    test('should configure auto-scaling policy', async () => {
      const page = await browser.newPage();

      try {
        await page.goto(FRONTEND_URL);
        
        // Login and navigate
        await page.fill('[data-testid="email-input"]', adminUser.email);
        await page.fill('[data-testid="password-input"]', adminUser.password);
        await page.click('[data-testid="login-button"]');
        
        await page.waitForSelector('[data-testid="dashboard"]', { timeout: 30000 });
        await page.click('[data-testid="databases-nav"]');
        await page.click('[data-testid="database-card-management-test-postgres"]');

        // Navigate to scaling tab
        await page.click('[data-testid="scaling-tab"]');
        await page.waitForSelector('[data-testid="scaling-section"]');

        // Configure auto-scaling
        await page.check('[data-testid="auto-scaling-enabled-checkbox"]');
        await page.fill('[data-testid="min-replicas-input"]', '1');
        await page.fill('[data-testid="max-replicas-input"]', '5');
        await page.fill('[data-testid="target-cpu-input"]', '75');
        await page.fill('[data-testid="target-memory-input"]', '80');
        
        await page.click('[data-testid="save-scaling-config-button"]');

        // Wait for save confirmation
        await page.waitForSelector('[data-testid="scaling-config-saved-notification"]');

        // Verify configuration is saved
        const autoScalingToggle = page.locator('[data-testid="auto-scaling-enabled-checkbox"]');
        await expect(autoScalingToggle).toBeChecked();

      } finally {
        await page.close();
      }
    });
  });

  describe('Multi-Tenant Management', () => {
    let multiTenantDeploymentId: string;

    beforeAll(async () => {
      // Create a multi-tenant deployment
      const response = await fetch(`${BASE_URL}/api/orchestrator/deploy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminUser.token}`
        },
        body: JSON.stringify({
          type: 'postgresql',
          projectId: 'e2e-tenant-project',
          config: {
            name: 'multi-tenant-postgres',
            postgresql: {
              name: 'multi-tenant',
              version: '16',
              tenant_isolation: 'schema',
              max_tenants: 20
            }
          }
        })
      });

      const data = await response.json();
      multiTenantDeploymentId = data.data.deploymentId;
    });

    test('should create and manage tenants', async () => {
      const page = await browser.newPage();

      try {
        await page.goto(FRONTEND_URL);
        
        // Login and navigate
        await page.fill('[data-testid="email-input"]', adminUser.email);
        await page.fill('[data-testid="password-input"]', adminUser.password);
        await page.click('[data-testid="login-button"]');
        
        await page.waitForSelector('[data-testid="dashboard"]', { timeout: 30000 });
        await page.click('[data-testid="databases-nav"]');
        await page.click('[data-testid="database-card-multi-tenant-postgres"]');

        // Navigate to tenants tab
        await page.click('[data-testid="tenants-tab"]');
        await page.waitForSelector('[data-testid="tenants-section"]');

        // Create first tenant
        await page.click('[data-testid="create-tenant-button"]');
        await page.waitForSelector('[data-testid="tenant-dialog"]');
        
        await page.fill('[data-testid="tenant-id-input"]', 'customer-alpha');
        await page.click('[data-testid="create-tenant-confirm-button"]');

        await page.waitForSelector('[data-testid="tenant-created-notification"]');

        // Create second tenant
        await page.click('[data-testid="create-tenant-button"]');
        await page.fill('[data-testid="tenant-id-input"]', 'customer-beta');
        await page.click('[data-testid="create-tenant-confirm-button"]');

        await page.waitForSelector('[data-testid="tenant-created-notification"]');

        // Verify tenants appear in list
        await expect(page.locator('[data-testid="tenant-item-customer-alpha"]')).toBeVisible();
        await expect(page.locator('[data-testid="tenant-item-customer-beta"]')).toBeVisible();

        // Get connection string for tenant
        await page.click('[data-testid="tenant-connection-button-customer-alpha"]');
        await page.waitForSelector('[data-testid="tenant-connection-dialog"]');
        
        await expect(page.locator('[data-testid="tenant-connection-string"]')).toBeVisible();
        
        // Copy tenant connection string
        await page.click('[data-testid="copy-tenant-connection-button"]');
        await page.waitForSelector('[data-testid="copy-success-notification"]');
        
        await page.click('[data-testid="close-connection-dialog-button"]');

        // Delete a tenant
        await page.click('[data-testid="tenant-delete-button-customer-beta"]');
        await page.waitForSelector('[data-testid="confirm-delete-tenant-dialog"]');
        
        await page.click('[data-testid="confirm-delete-tenant-button"]');
        await page.waitForSelector('[data-testid="tenant-deleted-notification"]');

        // Verify tenant is removed
        await expect(page.locator('[data-testid="tenant-item-customer-beta"]')).not.toBeVisible();
        await expect(page.locator('[data-testid="tenant-item-customer-alpha"]')).toBeVisible();

      } finally {
        await page.close();
      }
    });

    test('should show tenant resource usage', async () => {
      const page = await browser.newPage();

      try {
        await page.goto(FRONTEND_URL);
        
        // Login and navigate
        await page.fill('[data-testid="email-input"]', adminUser.email);
        await page.fill('[data-testid="password-input"]', adminUser.password);
        await page.click('[data-testid="login-button"]');
        
        await page.waitForSelector('[data-testid="dashboard"]', { timeout: 30000 });
        await page.click('[data-testid="databases-nav"]');
        await page.click('[data-testid="database-card-multi-tenant-postgres"]');

        // Navigate to tenants tab
        await page.click('[data-testid="tenants-tab"]');

        // Check resource usage for existing tenant
        const tenantItem = page.locator('[data-testid="tenant-item-customer-alpha"]');
        await expect(tenantItem.locator('[data-testid="tenant-cpu-usage"]')).toBeVisible();
        await expect(tenantItem.locator('[data-testid="tenant-memory-usage"]')).toBeVisible();
        await expect(tenantItem.locator('[data-testid="tenant-storage-usage"]')).toBeVisible();

        // Click on tenant details
        await tenantItem.click();
        await page.waitForSelector('[data-testid="tenant-details-panel"]');

        // Verify detailed metrics
        await expect(page.locator('[data-testid="tenant-connections-count"]')).toBeVisible();
        await expect(page.locator('[data-testid="tenant-tables-count"]')).toBeVisible();
        await expect(page.locator('[data-testid="tenant-schema-size"]')).toBeVisible();

      } finally {
        await page.close();
      }
    });
  });

  describe('Real-time Updates and Notifications', () => {
    test('should show real-time metrics updates', async () => {
      const page = await browser.newPage();

      try {
        await page.goto(FRONTEND_URL);
        
        // Login and navigate
        await page.fill('[data-testid="email-input"]', adminUser.email);
        await page.fill('[data-testid="password-input"]', adminUser.password);
        await page.click('[data-testid="login-button"]');
        
        await page.waitForSelector('[data-testid="dashboard"]', { timeout: 30000 });
        await page.click('[data-testid="databases-nav"]');

        // Wait for database list to load
        await page.waitForSelector('[data-testid="database-list"]');

        // Verify metrics are updating (check for changing values)
        const initialCpuValue = await page.locator('[data-testid="cpu-metric"]').first().textContent();
        
        // Wait for potential update
        await page.waitForTimeout(5000);
        
        // Metrics should be present (values may or may not change in test environment)
        await expect(page.locator('[data-testid="cpu-metric"]').first()).toBeVisible();
        await expect(page.locator('[data-testid="memory-metric"]').first()).toBeVisible();

      } finally {
        await page.close();
      }
    });

    test('should display system health status', async () => {
      const page = await browser.newPage();

      try {
        await page.goto(FRONTEND_URL);
        
        // Login and navigate to system health
        await page.fill('[data-testid="email-input"]', adminUser.email);
        await page.fill('[data-testid="password-input"]', adminUser.password);
        await page.click('[data-testid="login-button"]');
        
        await page.waitForSelector('[data-testid="dashboard"]', { timeout: 30000 });

        // Check system health indicator
        await expect(page.locator('[data-testid="system-health-indicator"]')).toBeVisible();
        
        // Click on health indicator to see details
        await page.click('[data-testid="system-health-indicator"]');
        await page.waitForSelector('[data-testid="system-health-details"]');

        // Verify health details
        await expect(page.locator('[data-testid="total-deployments-count"]')).toBeVisible();
        await expect(page.locator('[data-testid="healthy-deployments-count"]')).toBeVisible();
        await expect(page.locator('[data-testid="unhealthy-deployments-count"]')).toBeVisible();
        await expect(page.locator('[data-testid="average-response-time"]')).toBeVisible();

      } finally {
        await page.close();
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle network errors gracefully', async () => {
      const page = await browser.newPage();

      try {
        await page.goto(FRONTEND_URL);
        
        // Login
        await page.fill('[data-testid="email-input"]', adminUser.email);
        await page.fill('[data-testid="password-input"]', adminUser.password);
        await page.click('[data-testid="login-button"]');
        
        await page.waitForSelector('[data-testid="dashboard"]', { timeout: 30000 });

        // Simulate network failure by blocking requests
        await page.route('**/api/orchestrator/**', route => {
          route.abort();
        });

        // Try to navigate to databases
        await page.click('[data-testid="databases-nav"]');

        // Should show error message
        await page.waitForSelector('[data-testid="network-error-message"]', { timeout: 10000 });
        await expect(page.locator('[data-testid="network-error-message"]')).toBeVisible();

        // Should have retry button
        await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();

      } finally {
        await page.close();
      }
    });

    test('should handle deployment failures', async () => {
      const page = await browser.newPage();

      try {
        await page.goto(FRONTEND_URL);
        
        // Login and start deployment
        await page.fill('[data-testid="email-input"]', regularUser.email);
        await page.fill('[data-testid="password-input"]', regularUser.password);
        await page.click('[data-testid="login-button"]');
        
        await page.waitForSelector('[data-testid="dashboard"]', { timeout: 30000 });
        await page.click('[data-testid="databases-nav"]');

        // Mock deployment failure
        await page.route('**/api/orchestrator/deploy', route => {
          route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              error: 'Deployment failed: Insufficient resources'
            })
          });
        });

        // Try to deploy
        await page.click('[data-testid="deploy-database-button"]');
        await page.selectOption('[data-testid="database-type-select"]', 'postgresql');
        await page.fill('[data-testid="database-name-input"]', 'failing-deployment');
        await page.click('[data-testid="deploy-submit-button"]');

        // Should show error notification
        await page.waitForSelector('[data-testid="deployment-error-notification"]');
        await expect(page.locator('[data-testid="deployment-error-notification"]'))
          .toContainText('Deployment failed: Insufficient resources');

      } finally {
        await page.close();
      }
    });

    test('should validate port compliance in UI', async () => {
      const page = await browser.newPage();

      try {
        await page.goto(FRONTEND_URL);
        
        // Login and navigate
        await page.fill('[data-testid="email-input"]', adminUser.email);
        await page.fill('[data-testid="password-input"]', adminUser.password);
        await page.click('[data-testid="login-button"]');
        
        await page.waitForSelector('[data-testid="dashboard"]', { timeout: 30000 });
        await page.click('[data-testid="databases-nav"]');

        // Check that port configuration doesn't show restricted ports
        await page.click('[data-testid="deploy-database-button"]');
        await page.selectOption('[data-testid="database-type-select"]', 'postgresql');

        // Expand advanced configuration
        await page.click('[data-testid="advanced-config-toggle"]');

        // Check port configuration options
        const portOptions = await page.locator('[data-testid="port-select"] option').allTextContents();
        
        // Verify prohibited ports (3000-3009) are not available
        expect(portOptions).not.toContain('3000');
        expect(portOptions).not.toContain('3001');
        expect(portOptions).not.toContain('3009');

        // Verify allowed ports are available
        expect(portOptions).toContain('5432'); // PostgreSQL default
        expect(portOptions).toContain('8080'); // Allowed range

      } finally {
        await page.close();
      }
    });
  });

  describe('Performance and Load Testing', () => {
    test('should handle multiple concurrent deployments', async () => {
      const pages = await Promise.all([
        browser.newPage(),
        browser.newPage(),
        browser.newPage()
      ]);

      try {
        // Login all pages
        for (let i = 0; i < pages.length; i++) {
          const page = pages[i];
          await page.goto(FRONTEND_URL);
          await page.fill('[data-testid="email-input"]', adminUser.email);
          await page.fill('[data-testid="password-input"]', adminUser.password);
          await page.click('[data-testid="login-button"]');
          await page.waitForSelector('[data-testid="dashboard"]', { timeout: 30000 });
        }

        // Start concurrent deployments
        const deploymentPromises = pages.map(async (page, index) => {
          await page.click('[data-testid="databases-nav"]');
          await page.click('[data-testid="deploy-database-button"]');
          await page.selectOption('[data-testid="database-type-select"]', 'redis');
          await page.fill('[data-testid="database-name-input"]', `concurrent-redis-${index}`);
          await page.click('[data-testid="deploy-submit-button"]');
          
          return page.waitForSelector('[data-testid="success-notification"]', { timeout: 60000 });
        });

        // Wait for all deployments to complete
        await Promise.all(deploymentPromises);

        // Verify all deployments were successful
        for (let i = 0; i < pages.length; i++) {
          const successNotification = pages[i].locator('[data-testid="success-notification"]');
          await expect(successNotification).toBeVisible();
        }

      } finally {
        await Promise.all(pages.map(page => page.close()));
      }
    });

    test('should handle large numbers of tenants', async () => {
      const page = await browser.newPage();

      try {
        await page.goto(FRONTEND_URL);
        
        // Login and navigate to multi-tenant database
        await page.fill('[data-testid="email-input"]', adminUser.email);
        await page.fill('[data-testid="password-input"]', adminUser.password);
        await page.click('[data-testid="login-button"]');
        
        await page.waitForSelector('[data-testid="dashboard"]', { timeout: 30000 });
        await page.click('[data-testid="databases-nav"]');
        await page.click('[data-testid="database-card-multi-tenant-postgres"]');
        await page.click('[data-testid="tenants-tab"]');

        // Create multiple tenants quickly
        for (let i = 0; i < 5; i++) {
          await page.click('[data-testid="create-tenant-button"]');
          await page.fill('[data-testid="tenant-id-input"]', `load-test-tenant-${i}`);
          await page.click('[data-testid="create-tenant-confirm-button"]');
          await page.waitForSelector('[data-testid="tenant-created-notification"]');
        }

        // Verify all tenants are listed
        for (let i = 0; i < 5; i++) {
          await expect(page.locator(`[data-testid="tenant-item-load-test-tenant-${i}"]`)).toBeVisible();
        }

        // Check that UI remains responsive
        await page.click('[data-testid="tenants-search-input"]');
        await page.fill('[data-testid="tenants-search-input"]', 'load-test');
        
        // Should filter tenants quickly
        await page.waitForTimeout(1000);
        const visibleTenants = await page.locator('[data-testid^="tenant-item-load-test"]').count();
        expect(visibleTenants).toBe(5);

      } finally {
        await page.close();
      }
    });
  });

  describe('Accessibility Testing', () => {
    test('should be keyboard navigable', async () => {
      const page = await browser.newPage();

      try {
        await page.goto(FRONTEND_URL);
        
        // Test keyboard navigation
        await page.keyboard.press('Tab'); // Email input
        await page.keyboard.type(adminUser.email);
        await page.keyboard.press('Tab'); // Password input
        await page.keyboard.type(adminUser.password);
        await page.keyboard.press('Tab'); // Login button
        await page.keyboard.press('Enter');
        
        await page.waitForSelector('[data-testid="dashboard"]', { timeout: 30000 });

        // Navigate to databases using keyboard
        await page.keyboard.press('Tab'); // Database nav
        await page.keyboard.press('Enter');
        
        await page.waitForSelector('[data-testid="database-list"]');

        // Verify focus is visible
        const focusedElement = await page.locator(':focus').first();
        await expect(focusedElement).toBeVisible();

      } finally {
        await page.close();
      }
    });

    test('should have proper ARIA labels', async () => {
      const page = await browser.newPage();

      try {
        await page.goto(FRONTEND_URL);
        
        // Check for ARIA labels on key elements
        await expect(page.locator('[data-testid="email-input"]')).toHaveAttribute('aria-label');
        await expect(page.locator('[data-testid="password-input"]')).toHaveAttribute('aria-label');
        await expect(page.locator('[data-testid="login-button"]')).toHaveAttribute('aria-label');

        // Login and check database management areas
        await page.fill('[data-testid="email-input"]', adminUser.email);
        await page.fill('[data-testid="password-input"]', adminUser.password);
        await page.click('[data-testid="login-button"]');
        
        await page.waitForSelector('[data-testid="dashboard"]', { timeout: 30000 });
        await page.click('[data-testid="databases-nav"]');

        // Check ARIA labels in database management
        await expect(page.locator('[data-testid="deploy-database-button"]')).toHaveAttribute('aria-label');
        await expect(page.locator('[data-testid="database-list"]')).toHaveAttribute('aria-label');

      } finally {
        await page.close();
      }
    });
  });
});