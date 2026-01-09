import { MongoDBContainer, StartedMongoDBContainer } from '@testcontainers/mongodb'

/**
 * Global container instance for tests
 * This ensures we reuse the same container across test files
 */
let mongoContainer: StartedMongoDBContainer | null = null

/**
 * Start MongoDB test container
 * Returns connection URI using localhost (for proper host resolution)
 */
export async function startMongoContainer(): Promise<string> {
  if (!mongoContainer) {
    // Use MongoDB 6 which doesn't require replica sets by default
    // MongoDB 7+ requires replica sets which causes hostname resolution issues
    mongoContainer = await new MongoDBContainer('mongo:6').withReuse().start()
  }

  // Get the mapped port and use localhost for proper resolution
  const port = mongoContainer.getMappedPort(27017)

  // Use localhost with directConnection=true to bypass replica set discovery
  // This avoids issues with container hostnames in replica set configuration
  // directConnection=true forces direct connection to this host, ignoring replica set
  return `mongodb://localhost:${port}/test?directConnection=true`
}

/**
 * Stop MongoDB test container
 */
export async function stopMongoContainer(): Promise<void> {
  if (mongoContainer) {
    await mongoContainer.stop()
    mongoContainer = null
  }
}

/**
 * Example usage in Vitest:
 *
 * import { beforeAll, afterAll, describe, it, expect } from 'vitest'
 * import { startMongoContainer, stopMongoContainer } from '@/utilities/test/mongodb-container'
 *
 * describe('MongoDB Integration Tests', () => {
 *   let mongoUri: string
 *
 *   beforeAll(async () => {
 *     mongoUri = await startMongoContainer()
 *     // Connect your MongoDB client here
 *   })
 *
 *   afterAll(async () => {
 *     await stopMongoContainer()
 *   })
 *
 *   it('should connect to MongoDB', async () => {
 *     // Your test here
 *   })
 * })
 */
