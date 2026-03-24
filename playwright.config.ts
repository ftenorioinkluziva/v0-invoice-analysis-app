import { defineConfig, devices } from '@playwright/test'

const hasE2ECredentials = Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD)

const guestProjects = [
  {
    name: 'chromium',
    use: {
      ...devices['Desktop Chrome'],
      ...(hasE2ECredentials ? { storageState: 'e2e/.auth/user.json' } : {}),
    },
    testIgnore: /.*\.setup\.ts/,
    ...(hasE2ECredentials ? { dependencies: ['setup-auth'] } : {}),
  },
  {
    name: 'mobile',
    use: {
      ...devices['iPhone 14'],
      ...(hasE2ECredentials ? { storageState: 'e2e/.auth/user.json' } : {}),
    },
    testIgnore: /.*\.setup\.ts/,
    ...(hasE2ECredentials ? { dependencies: ['setup-auth'] } : {}),
  },
]

const projects = hasE2ECredentials
  ? [
      {
        name: 'setup-auth',
        testMatch: /auth\.setup\.ts/,
        use: { ...devices['Desktop Chrome'] },
      },
      ...guestProjects,
    ]
  : guestProjects

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects,
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
})
