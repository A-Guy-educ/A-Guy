/**
 * Migration: courseEntitlements → enrollments collection
 *
 * Reads all courseEntitlements from all users, creates Enrollments documents,
 * and preserves metadata. Does NOT delete courseEntitlements for backward
 * compatibility during rollout.
 *
 * Idempotent — safe to re-run. Uses batch processing for efficiency.
 *
 * Usage: pnpm tsx scripts/migrate-course-entitlements-to-enrollments.ts
 */

import { getPayload } from 'payload'

import config from '@payload-config'

interface LegacyEntitlement {
  course?: string | { id?: string }
  grantMethod?: 'admin' | 'payment' | 'code'
  grantedAt?: string
}

interface UserWithEntitlements {
  id: string
  courseEntitlements?: LegacyEntitlement[]
}

async function main() {
  const payload = await getPayload({ config })

  const PAGE_SIZE = 500
  let page = 1
  let usersProcessed = 0
  let enrollmentsCreated = 0
  let duplicatesSkipped = 0
  let errors = 0

  console.log('Starting migration: courseEntitlements → enrollments')
  console.log('NOTE: courseEntitlements will NOT be deleted (backward compatibility)')
  console.log('')

  while (true) {
    const users = await payload.find({
      collection: 'users',
      where: { 'courseEntitlements.course': { exists: true } },
      limit: PAGE_SIZE,
      page,
      depth: 0,
      overrideAccess: true,
    })

    if (page === 1) {
      console.log(`Found ${users.totalDocs} users with entitlements`)
    }

    for (const user of users.docs as unknown as UserWithEntitlements[]) {
      usersProcessed++

      if (!user.courseEntitlements || user.courseEntitlements.length === 0) {
        continue
      }

      for (const entitlement of user.courseEntitlements) {
        const courseId =
          typeof entitlement.course === 'object' ? entitlement.course?.id : entitlement.course

        if (!courseId) continue

        // Check if enrollment already exists (idempotency)
        const existing = await payload.find({
          collection: 'enrollments',
          where: {
            and: [{ user: { equals: user.id } }, { course: { equals: courseId } }],
          },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })

        if (existing.docs.length > 0) {
          duplicatesSkipped++
          continue
        }

        // Create enrollment
        try {
          await payload.create({
            collection: 'enrollments',
            data: {
              user: user.id,
              course: courseId,
              status: 'active',
              grantMethod: entitlement.grantMethod || 'admin',
              source: 'dashboard', // Default source for migrated data
              enrolledAt: entitlement.grantedAt || new Date().toISOString(),
            },
            overrideAccess: true,
          })
          enrollmentsCreated++
        } catch (err) {
          console.error(`Error creating enrollment for user ${user.id}, course ${courseId}:`, err)
          errors++
        }
      }
    }

    if (!users.hasNextPage) break
    page++
  }

  console.log('')
  console.log('=== Migration Summary ===')
  console.log(
    JSON.stringify(
      {
        usersProcessed,
        enrollmentsCreated,
        duplicatesSkipped,
        errors,
      },
      null,
      2,
    ),
  )

  // Post-migration verification
  console.log('')
  console.log('Running verification...')
  const verification = await verifyMigration(payload)
  if (!verification.success) {
    console.error('VERIFICATION FAILED:', verification.message)
    process.exit(1)
  }
  console.log('Verification passed!')
}

async function verifyMigration(
  payload: Awaited<ReturnType<typeof getPayload>>,
): Promise<{ success: boolean; message?: string }> {
  // Count total entitlements in users
  const usersWithEntitlements = await payload.find({
    collection: 'users',
    where: { 'courseEntitlements.course': { exists: true } },
    limit: 0,
    depth: 0,
    overrideAccess: true,
  })

  let totalLegacyEntitlements = 0
  for (const user of usersWithEntitlements.docs as unknown as UserWithEntitlements[]) {
    totalLegacyEntitlements += user.courseEntitlements?.length || 0
  }

  // Count total enrollments
  const totalEnrollments = await payload.find({
    collection: 'enrollments',
    limit: 0,
    depth: 0,
    overrideAccess: true,
  })

  // These should match (minus any that failed)
  if (totalEnrollments.totalDocs < totalLegacyEntitlements) {
    return {
      success: false,
      message: `Enrollment count (${totalEnrollments.totalDocs}) is less than legacy entitlement count (${totalLegacyEntitlements})`,
    }
  }

  return { success: true }
}

main()
  .then(() => {
    console.log('')
    console.log('Migration completed successfully.')
    process.exit(0)
  })
  .catch((err) => {
    console.error('Migration failed:', err)
    process.exit(1)
  })
