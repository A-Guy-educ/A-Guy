/**
 * Global setup/teardown for integration tests
 *
 * This file manages the MongoDB connection lifecycle for all integration tests.
 * The teardown function ensures all DB connections are properly closed,
 * preventing connection leaks and test runner hangs.
 */

export async function setup() {
  // Payload singleton will be initialized by individual test files
  // This hook is a placeholder for future shared setup
  console.log('[global-int-setup] Integration test suite starting')
}

export async function teardown() {
  // Clean up shared Payload instance if it exists
  try {
    const { cleanupSharedPayload } = await import('./shared-payload')
    await cleanupSharedPayload()
  } catch {
    // Fine — shared-payload may not be used
  }

  // Safety net: destroy any remaining DB connections
  try {
    const { getPayload } = await import('payload')
    const config = await import('@payload-config')
    const payload = await getPayload({ config: config.default })
    if (payload?.db?.destroy) {
      await payload.db.destroy()
    }
    console.log('[global-int-teardown] DB connection destroyed')
  } catch {
    // Fine — Payload may not have initialized (tests were skipped)
    console.log('[global-int-teardown] No Payload instance to clean up')
  }

  // Clean up MongoDB container (only when not using CI service)
  if (process.env.USE_MONGO_SERVICE !== 'true') {
    try {
      const { forceStopMongoContainer } = await import('@/infra/utils/test/mongodb-container')
      await forceStopMongoContainer()
      console.log('[global-int-teardown] MongoDB container stopped')
    } catch {
      console.log('[global-int-teardown] No MongoDB container to clean up')
    }
  }
}
