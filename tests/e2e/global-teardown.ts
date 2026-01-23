/**
 * Global teardown for E2E tests
 * Stops MongoDB test container after tests complete
 * No-op when using CI service container (USE_MONGO_SERVICE=true)
 */
import { stopMongoContainer } from '@/infra/utils/test/mongodb-container'

async function globalTeardown() {
  // Service container is managed by CI, not us
  if (process.env.USE_MONGO_SERVICE === 'true') {
    return
  }

  if (process.env.E2E_DATABASE_URL) {
    console.log('Stopping MongoDB test container...')
    await stopMongoContainer()
  }
}

export default globalTeardown
