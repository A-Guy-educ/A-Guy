import { MongoDBContainer, StartedMongoDBContainer } from '@testcontainers/mongodb'
import { isProductionDatabase } from './test-db-constraint'

/**
 * Global container instance for tests
 * This ensures we reuse the same container across test files
 */
let mongoContainer: StartedMongoDBContainer | null = null

/**
 * Check if we're running in CI with a MongoDB service container
 * In this case, we skip testcontainers and use the service directly
 */
function isUsingMongoService(): boolean {
  return process.env.USE_MONGO_SERVICE === 'true'
}

/**
 * Start MongoDB test container or use CI service container
 * Returns connection URI using localhost (for proper host resolution)
 *
 * In CI with USE_MONGO_SERVICE=true:
 * - Returns the service container URL directly (mongodb://localhost:27017/test)
 * - Skips testcontainers entirely for faster CI
 *
 * Locally or without service:
 * - Starts a testcontainer
 * - Throws error if DATABASE_URL is set to MongoDB Atlas
 */
export async function startMongoContainer(): Promise<string> {
  // In CI with service container, use it directly
  if (isUsingMongoService()) {
    console.log('Using MongoDB service container (USE_MONGO_SERVICE=true)')
    return 'mongodb://localhost:27017/test?directConnection=true'
  }

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
 * No-op when using CI service container (USE_MONGO_SERVICE=true)
 */
export async function stopMongoContainer(): Promise<void> {
  // Service container is managed by CI, not us
  if (process.env.USE_MONGO_SERVICE === 'true') {
    return
  }

  if (mongoContainer) {
    await mongoContainer.stop()
    mongoContainer = null
  }
}

/**
 * Example usage in Vitest:
 *
 * import { beforeAll, afterAll, describe, it, expect } from 'vitest'
 * import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'
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
