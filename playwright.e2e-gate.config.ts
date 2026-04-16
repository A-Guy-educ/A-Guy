/**
 * E2E Gate Playwright Configuration
 *
 * Narrow scope: only critical tests that should block PRs to main.
 * - tests/e2e/verification/ — pre-launch verification suite
 * - tests/e2e/analytics-events.e2e.spec.ts — analytics event firing
 *
 * All other tests (pdf-embed, qa scenarios, etc.) are excluded.
 */
import { defineConfig, devices } from '@playwright/test'

import { config } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

config({ path: path.resolve(dirname, '.env') })
config({ path: path.resolve(dirname, '.env.test'), override: true })

const databaseUrl =
  process.env.E2E_DATABASE_URL || process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/test'

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',
  forbidOnly: !!process.env.CI,
  retries: 2,
  maxFailures: 10,
  workers: 2,
  reporter: 'html',
  use: {
    baseURL: process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      testDir: './tests/e2e',
      testMatch: ['verification/**/*.spec.ts', 'analytics-events.e2e.spec.ts'],
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
  ],
  webServer: {
    command: 'test -d .next && pnpm start',
    reuseExistingServer: true,
    url: 'http://localhost:3000/api/health',
    timeout: 120000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      PAYLOAD_SECRET: process.env.PAYLOAD_SECRET || 'test-secret-key-for-integration-tests-only',
      DATABASE_URL: databaseUrl,
      NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000',
      NODE_OPTIONS: process.env.NODE_OPTIONS || '',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
      SKIP_BUILD: 'true',
      NODE_ENV: 'test',
      NEXT_PUBLIC_GA4_MEASUREMENT_ID: 'G-TESTMOCK123',
      NEXT_PUBLIC_MIXPANEL_TOKEN: 'mp-test-mock-token',
    },
  },
})
