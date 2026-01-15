import { MongoDBContainer, StartedMongoDBContainer } from '@testcontainers/mongodb'
import { isProductionDatabase } from './test-db-constraint'

/**
 * Global container instance for tests
 * This ensures we reuse the same container across test files
 */
let mongoContainer: StartedMongoDBContainer | null = null

/**
 * Start MongoDB test container
 * Returns connection URI using localhost (for proper host resolution)
 *
 * Throws error if DATABASE_URL is set to MongoDB Atlas (tests using testcontainers
 * should not have Atlas configured - vector search tests use Atlas directly without testcontainers)
 */
export async function startMongoContainer(): Promise<string> {
  // Check if DATABASE_URL is set to Atlas - tests using testcontainers shouldn't have Atlas configured
  const currentDbUrl = process.env.DATABASE_URL
  if (currentDbUrl && isProductionDatabase(currentDbUrl)) {
    throw new Error(
      `❌ Cannot start testcontainers: DATABASE_URL is set to MongoDB Atlas!\n` +
        `DATABASE_URL: ${currentDbUrl.replace(/:[^:@]+@/, ':****@')}\n\n` +
        `Tests using testcontainers (startMongoContainer()) must NOT have Atlas configured.\n` +
        `Vector search tests use Atlas directly without testcontainers.\n\n` +
        `Solution: Unset DATABASE_URL or set it to a testcontainers URL before calling startMongoContainer()`,
    )
  }

  if (!mongoContainer) {
    // Use MongoDB 6 which doesn't require replica sets by default
    // MongoDB 7+ requires replica sets which causes hostname resolution issues
    // Note: Removed .withReuse() to avoid stale container references
    // Containers are cleaned up properly in stopMongoContainer()
    mongoContainer = await new MongoDBContainer('mongo:6').start()
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
