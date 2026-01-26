/**
 * Enforces that integration and E2E tests ONLY use testcontainers
 * Prevents accidental use of production/shared databases in tests
 */

import { getConfigValue } from '@/lib/config/runtime/bootstrap-config'

/**
 * Check if we're running in a test environment
 */
export function isTestEnvironment(): boolean {
  return (
    getConfigValue('NODE_ENV') === 'test' ||
    getConfigValue('VITEST', { throwIfNotFound: false }) === 'true' ||
    getConfigValue('PLAYWRIGHT_TEST', { throwIfNotFound: false }) === 'true' ||
    typeof getConfigValue('VITEST_WORKER_ID', { throwIfNotFound: false }) !== 'undefined' ||
    process.argv.some((arg) => arg.includes('vitest') || arg.includes('playwright'))
  )
}

/**
 * Check if we're running vector search tests (which require MongoDB Atlas)
 */
function isVectorSearchTest(): boolean {
  // Check if explicitly allowed via env var
  if (getConfigValue('ALLOW_ATLAS_FOR_VECTOR_SEARCH', { throwIfNotFound: false }) === 'true') {
    return true
  }

  // Check if running vector search test files
  const testFiles = process.argv.filter(
    (arg) => arg.includes('.spec.ts') || arg.includes('.test.ts'),
  )
  const vectorSearchTestFiles = ['vector-search', 'memory-system']
  return testFiles.some((file) => vectorSearchTestFiles.some((pattern) => file.includes(pattern)))
}

/**
 * Check if DATABASE_URL points to a production/shared database
 */
export function isProductionDatabase(url: string): boolean {
  if (!url) return false

  const lowerUrl = url.toLowerCase()

  // MongoDB Atlas - allow for vector search tests, block for others
  if (lowerUrl.includes('mongodb+srv://') || lowerUrl.includes('.mongodb.net')) {
    // Allow Atlas for vector search tests (they need it)
    if (isVectorSearchTest()) {
      return false
    }
    // Block Atlas for all other tests (must use testcontainers)
    return true
  }

  // Production hostnames (adjust as needed)
  const productionHosts = ['atlas', 'production', 'prod']
  if (productionHosts.some((host) => lowerUrl.includes(host))) {
    // Allow for vector search tests
    if (isVectorSearchTest()) {
      return false
    }
    return true
  }

  // Shared localhost database (not testcontainers)
  // Testcontainers use random ports, so we check for default port 27017
  // and ensure it's not a testcontainers URL
  if (
    lowerUrl.includes('mongodb://127.0.0.1:27017') ||
    lowerUrl.includes('mongodb://localhost:27017')
  ) {
    // Allow if it has directConnection=true (testcontainers pattern)
    // or if it's explicitly marked as test
    if (lowerUrl.includes('directConnection=true') || lowerUrl.includes('/test')) {
      return false
    }
    // Otherwise, it's a shared database - block it
    return true
  }

  return false
}

/**
 * Validate that test environment uses testcontainers
 * Throws error if production database detected
 *
 * Exception: Vector search tests are allowed to use MongoDB Atlas
 */
export function enforceTestContainersOnly(): void {
  if (!isTestEnvironment()) {
    return // Not in test mode, skip validation
  }

  const dbUrl = process.env.DATABASE_URL

  if (!dbUrl) {
    throw new Error(
      'DATABASE_URL not set in test environment. ' +
        'Tests must use testcontainers. Use startMongoContainer() from @/infra/utils/test/mongodb-container',
    )
  }

  // Allow MongoDB Atlas for vector search tests (they require it)
  if (
    isVectorSearchTest() &&
    (dbUrl.includes('mongodb+srv://') || dbUrl.includes('.mongodb.net'))
  ) {
    console.log('⚠️  Using MongoDB Atlas for vector search tests (vector search requires Atlas)')
    return // Allow Atlas for vector search tests
  }

  if (isProductionDatabase(dbUrl)) {
    throw new Error(
      `❌ SECURITY: Production database detected in test environment!\n` +
        `DATABASE_URL: ${dbUrl.replace(/:[^:@]+@/, ':****@')}\n\n` +
        `Tests MUST use testcontainers, not production/shared databases.\n` +
        `Exception: Vector search tests may use MongoDB Atlas (set ALLOW_ATLAS_FOR_VECTOR_SEARCH=true)\n\n` +
        `For integration tests: Use startMongoContainer() in beforeAll hook\n` +
        `For E2E tests: Configure testcontainers in playwright.config.ts globalSetup\n\n` +
        `See: src/utilities/test/mongodb-container.ts`,
    )
  }
}

/**
 * Get test database URL - enforces testcontainers
 * Use this in test setup instead of reading DATABASE_URL directly
 */
export function getTestDatabaseUrl(): string {
  enforceTestContainersOnly()
  return process.env.DATABASE_URL!
}
