/**
 * Global teardown for E2E tests
 * Stops MongoDB test container after tests complete
 */
import { stopMongoContainer } from '@/utilities/test/mongodb-container'

async function globalTeardown() {
  if (!process.env.CI || process.env.USE_TEST_CONTAINERS === 'true') {
    if (process.env.E2E_DATABASE_URL) {
      console.log('Stopping MongoDB test container...')
      await stopMongoContainer()
    }
  }
}

export default globalTeardown
