/**
 * Cleanup orphan course entitlements
 *
 * Iterates all users with non-empty `courseEntitlements`, checks if each
 * referenced course still exists, and removes entitlements pointing to
 * deleted courses. Logs a summary at the end.
 *
 * Idempotent — safe to re-run.
 *
 * Usage: pnpm tsx scripts/cleanup-orphan-entitlements.ts
 */
import { getPayload, NotFound } from 'payload'

import config from '@payload-config'

interface Entitlement {
  course?: string | { id?: string }
  grantMethod?: 'admin' | 'payment' | 'code'
  grantedAt?: string
}

interface UserDoc {
  id: string
  email?: string
  courseEntitlements?: Entitlement[]
}

async function main() {
  const payload = await getPayload({ config })

  // Cache existence checks for course IDs to avoid duplicate findByID calls
  const courseExistsCache = new Map<string, boolean>()

  const checkCourseExists = async (courseId: string): Promise<boolean> => {
    if (courseExistsCache.has(courseId)) {
      return courseExistsCache.get(courseId)!
    }
    try {
      await payload.findByID({
        collection: 'courses',
        id: courseId,
        overrideAccess: true,
        depth: 0,
      })
      courseExistsCache.set(courseId, true)
      return true
    } catch (err) {
      // Only treat "course not found" as missing. Other errors (network,
      // auth, DB) must bubble up so we don't delete real entitlements on
      // transient failures.
      if (err instanceof NotFound || (err as { status?: number })?.status === 404) {
        courseExistsCache.set(courseId, false)
        return false
      }
      throw err
    }
  }

  const PAGE_SIZE = 500
  let page = 1
  let usersScanned = 0
  let usersAffected = 0
  let orphansRemoved = 0

  while (true) {
    const users = await payload.find({
      collection: 'users',
      where: { 'courseEntitlements.course': { exists: true } },
      limit: PAGE_SIZE,
      page,
      overrideAccess: true,
      depth: 0,
    })

    if (page === 1) {
      // eslint-disable-next-line no-console
      console.log(`Scanning ${users.totalDocs} user(s) with entitlements...`)
    }

    for (const user of users.docs as unknown as UserDoc[]) {
      usersScanned++
      const original = user.courseEntitlements || []
      if (original.length === 0) continue

      const filtered: Entitlement[] = []
      let removedFromUser = 0

      for (const ent of original) {
        const courseId = typeof ent.course === 'object' ? ent.course?.id : ent.course
        if (!courseId) {
          // Entitlement with no course ref — drop it
          removedFromUser++
          continue
        }
        const exists = await checkCourseExists(String(courseId))
        if (exists) {
          filtered.push(ent)
        } else {
          removedFromUser++
        }
      }

      if (removedFromUser === 0) continue

      await payload.update({
        collection: 'users',
        id: user.id,
        data: { courseEntitlements: filtered },
        overrideAccess: true,
      })

      usersAffected++
      orphansRemoved += removedFromUser
      // eslint-disable-next-line no-console
      console.log(
        `  • Removed ${removedFromUser} orphan entitlement(s) from user ${user.email || user.id}`,
      )
    }

    if (!users.hasNextPage) break
    page++
  }

  // eslint-disable-next-line no-console
  console.log('\n=== Cleanup Summary ===')
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ usersScanned, usersAffected, orphansRemoved }, null, 2))
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Cleanup failed:', err)
    process.exit(1)
  })
