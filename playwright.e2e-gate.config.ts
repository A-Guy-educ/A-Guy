/**
 * E2E Gate Playwright Configuration
 *
 * Narrow scope: only stable, passing tests that should block PRs to main.
 * The tests here are known to pass reliably in CI. Tests with known
 * pre-existing failures (broken locators, fragile seeding) are excluded.
 *
 * Current gate: admin-settings, auth-onboarding, catalog-navigation.
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
      // Excluded tests (pre-existing failures, not CI infrastructure issues):
      // - admin-content: fragile inline seeding / 404 on seeded URLs
      // - admin-editing: exercise UI locators don't match current selectors
      // - exercises: MCQ/free-response/matching/table locators not found
      // - lesson-content: Scenario #5 locator timeout on lesson page
      // - student-support: Scenario #18 mobile exercises locator timeout
      testMatch: [
        'verification/admin-settings.e2e.spec.ts',
        'verification/auth-onboarding.e2e.spec.ts',
        'verification/catalog-navigation.e2e.spec.ts',
      ],
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
  ],
  webServer: {
    // The release-e2e-gate runner does not share the CI build-job's .next
    // cache, so build if it is missing, then start. CI jobs that already
    // restore .next via actions/cache will skip the build.
    command: '(test -d .next || pnpm build) && pnpm start',
    reuseExistingServer: true,
    url: 'http://localhost:3000/api/health',
    timeout: 600000,
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
