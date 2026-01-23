/**
 * Global setup for E2E tests
 * Starts MongoDB test container before tests run, or uses CI service container
 */
import { startMongoContainer } from '@/infra/utils/test/mongodb-container'

async function globalSetup() {
  // In CI with USE_MONGO_SERVICE, use the service container directly
  if (process.env.USE_MONGO_SERVICE === 'true') {
    console.log('Using MongoDB service container for E2E tests (USE_MONGO_SERVICE=true)')
    process.env.E2E_DATABASE_URL = 'mongodb://localhost:27017/test?directConnection=true'
    return
  }

  // For local development or CI without service container, use testcontainers
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

export default globalSetup
