import { defineConfig, devices } from '@playwright/test'

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import { config } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Load .env file (same as development environment)
// Environment variables can be overridden via CI secrets or process.env
config({ path: path.resolve(dirname, '.env') })

// Validate DATABASE_URL in CI environment
// In CI, we should use MongoDB Atlas (via secrets), not localhost
if (process.env.CI && !process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL must be set in CI environment. ' +
      'Set it in GitHub Secrets (Settings → Secrets and variables → Actions) or workflow env. ' +
      'For MongoDB Atlas, use: mongodb+srv://username:password@cluster.mongodb.net/database',
  )
}

// Determine DATABASE_URL: use provided value or fallback to localhost for local E2E tests only
const databaseUrl = process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/test'

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    // baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
  ],
  webServer: {
    command: 'rm -rf .next && pnpm build && test -d .next && pnpm start',
    reuseExistingServer: !process.env.CI,
    url: 'http://localhost:3000/api/health', // Use dedicated health endpoint (fast, no blocking operations)
    timeout: 300000, // 5 minutes for build + server start (MongoDB connection can be slow, static generation may take time)
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      PAYLOAD_SECRET: process.env.PAYLOAD_SECRET || 'test-secret-key-for-integration-tests-only',
      DATABASE_URL: databaseUrl,
      NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000',
      NODE_OPTIONS: process.env.NODE_OPTIONS || '',
      SUMMARY_MAINTENANCE_ENABLED: process.env.SUMMARY_MAINTENANCE_ENABLED || 'true',
      MEMORY_EXTRACTION_ENABLED: process.env.MEMORY_EXTRACTION_ENABLED || 'true',
      MEMORY_RETRIEVAL_ENABLED: process.env.MEMORY_RETRIEVAL_ENABLED || 'true',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    },
  },
})
