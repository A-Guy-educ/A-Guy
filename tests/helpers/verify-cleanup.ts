/**
 * Verification helper to assert no test data was left behind.
 *
 * Usage in afterAll:
 * ```typescript
 * afterAll(async () => {
 *   await tracker.cleanup()
 *   await verifyNoTestData(payload, testUserEmail)
 * })
 * ```
 */
import type { Payload } from 'payload'

interface VerifyResult {
  clean: boolean
  leftover: { collection: string; count: number }[]
}

/**
 * Verify that no test data remains for a given user email pattern.
 * Pass the email (or prefix) used during the test to check for leftovers.
 */
export async function verifyNoTestData(
  payload: Payload,
  testEmailPattern: string,
): Promise<VerifyResult> {
  const leftover: { collection: string; count: number }[] = []

  // Check for leftover users matching the test email pattern
  try {
    const users = await payload.find({
      collection: 'users',
      where: { email: { like: testEmailPattern } },
      limit: 1,
      overrideAccess: true,
    })
    if (users.totalDocs > 0) {
      leftover.push({ collection: 'users', count: users.totalDocs })
    }
  } catch {
    // Collection may not exist in this test env
  }

  return {
    clean: leftover.length === 0,
    leftover,
  }
}

/**
 * Verify that no records exist for a specific user ID across
 * common test-generated collections.
 */
export async function verifyUserDataCleaned(
  payload: Payload,
  userId: string,
): Promise<VerifyResult> {
  const leftover: { collection: string; count: number }[] = []

  const collectionsToCheck = [
    { slug: 'conversations', field: 'user' },
    { slug: 'memory_items', field: 'userId' },
    { slug: 'user-progress', field: 'user' },
    { slug: 'user_settings', field: 'user' },
  ]

  for (const { slug, field } of collectionsToCheck) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (payload as any).find({
        collection: slug,
        where: { [field]: { equals: userId } },
        limit: 1,
        overrideAccess: true,
      })

      if (result.totalDocs > 0) {
        leftover.push({ collection: slug, count: result.totalDocs })
      }
    } catch {
      // Collection may not exist
    }
  }

  return {
    clean: leftover.length === 0,
    leftover,
  }
}
