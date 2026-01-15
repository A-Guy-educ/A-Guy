/**
 * Global setup for E2E tests
 * Starts MongoDB test container before tests run
 */
import { startMongoContainer } from '@/utilities/test/mongodb-container'

async function globalSetup() {
  // In CI, use provided DATABASE_URL if available (MongoDB Atlas for vector search)
  // Otherwise, start testcontainers
  if (!process.env.CI || process.env.USE_TEST_CONTAINERS === 'true') {
    if (
      !process.env.DATABASE_URL ||
      process.env.DATABASE_URL.includes('localhost') ||
      process.env.DATABASE_URL.includes('127.0.0.1')
    ) {
      console.log('Starting MongoDB test container for E2E tests...')
      const testDbUrl = await startMongoContainer()
      process.env.E2E_DATABASE_URL = testDbUrl
      console.log(`Test database URL configured: ${testDbUrl.replace(/:[^:@]+@/, ':****@')}`)
    }
  }
}

export default globalSetup
