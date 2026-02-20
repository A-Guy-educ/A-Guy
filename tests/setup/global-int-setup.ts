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
}
