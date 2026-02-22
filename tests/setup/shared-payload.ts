/**
 * Shared test fixture for integration tests
 *
 * This module provides a singleton MongoDB container and Payload instance
 * that can be shared across all integration tests, dramatically improving
 * test execution time.
 *
 * Thread-safe for parallel test execution.
 *
 * Usage in test files:
 * ```typescript
 * import { getSharedPayload } from '../../setup/shared-payload'
 *
 * let payload: Payload
 *
 * beforeAll(async () => {
 *   payload = await getSharedPayload()
 * })
 * ```
 */

import type { Payload } from 'payload'
import { getPayload } from 'payload'

let payload: Payload | undefined
let mongoUri: string | undefined
let initPromise: Promise<Payload> | undefined

/**
 * Get or create the shared Payload instance
 *
 * Thread-safe: Uses a promise lock to prevent race conditions.
 * On first call, this will:
 * 1. Start a MongoDB container (if not already running)
 * 2. Initialize Payload
 * 3. Return the same instance for all subsequent calls
 *
 * Subsequent calls while initializing will await the same promise.
 */
export async function getSharedPayload(): Promise<Payload> {
  if (payload) {
    return payload
  }

  // If initialization is in progress, wait for it
  if (initPromise) {
    return initPromise
  }

  // Start initialization
  initPromise = initializePayload()

  return initPromise
}

async function initializePayload(): Promise<Payload> {
  // Double-check after acquiring lock
  if (payload) {
    return payload
  }

  // Import dynamically to avoid issues with test setup timing
  const { startMongoContainer } = await import('@/infra/utils/test/mongodb-container')
  const config = await import('@payload-config')

  // Start MongoDB container (singleton - will reuse if already started)
  mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  // Initialize Payload
  payload = await getPayload({ config: config.default })

  console.log('[shared-payload] Initialized new Payload instance')

  return payload
}

/**
 * Get the current shared Payload instance without initializing
 * Returns undefined if not yet initialized
 */
export function getSharedPayloadInstance(): Payload | undefined {
  return payload
}

/**
 * Clean up the shared Payload instance
 * Called automatically by the global teardown
 */
export async function cleanupSharedPayload(): Promise<void> {
  if (payload?.db?.destroy) {
    await payload.db.destroy()
    console.log('[shared-payload] Destroyed shared Payload instance')
    payload = undefined
  }
}

/**
 * Get the MongoDB URI used by the shared instance
 */
export function getSharedMongoUri(): string | undefined {
  return mongoUri
}
