import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Test directory
  testDir: './tests/e2e',
  
  // Run tests in files in parallel
  fullyParallel: true,
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  
  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter configuration
  reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    process.env.CI ? ['github'] : ['list']
  ],
  
  // Global test configuration
  use: {
    // Base URL for all tests  
    baseURL: process.env.BASE_URL || 'http://localhost:8083',
    
    // Browser context options
    viewport: { width: 1280, height: 720 },
    
    // Collect trace on retry
    trace: process.env.CI ? 'retain-on-failure' : 'on-first-retry',
    
    // Record video on failure
    video: process.env.CI ? 'retain-on-failure' : 'off',
    
    // Take screenshot on failure
    screenshot: 'only-on-failure',
    
    // Action timeout
    actionTimeout: 10000,
    
    // Navigation timeout
    navigationTimeout: 30000,
  },
  
  // Test timeout
  timeout: 30000,
  
  // Global setup and teardown
  globalSetup: require.resolve('./tests/e2e/global-setup'),
  globalTeardown: require.resolve('./tests/e2e/global-teardown'),
  
  // Configure projects for major browsers
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Use prepared auth state
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    
    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    
    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    
    // Mobile browsers
    {
      name: 'Mobile Chrome',
      use: { 
        ...devices['Pixel 5'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    
    {
      name: 'Mobile Safari',
      use: { 
        ...devices['iPhone 12'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    
    // API testing
    {
      name: 'api',
      testMatch: /.*api\.spec\.ts/,
      use: {
        baseURL: process.env.BASE_URL || 'http://localhost:3000',
      },
    },
  ],
  
  // Development server configuration
  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:8083',
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL || 'postgres://test:test@localhost:5432/coderunner_test',
    },
  },
  
  // Output directory
  outputDir: 'test-results/',
  
  // Test result directory
  reportSlowTests: {
    max: 5,
    threshold: 15000, // 15 seconds
  },
  
  // Expect options
  expect: {
    // Global expect timeout
    timeout: 10000,
    
    // Screenshot comparison options
    toHaveScreenshot: {
      mode: 'local',
      threshold: 0.2,
    },
    
    // Visual comparison options
    toMatchSnapshot: {
      threshold: 0.2,
    },
  },
});