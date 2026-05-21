/**
 * @fileType utility
 * @domain lessons
 * @pattern idempotent-backfill
 * @ai-summary Creates intro ContentPage for existing lessons without one
 */

import type { Payload } from 'payload'

export async function backfillLessonIntroContentPages(
  payload: Payload,
): Promise<{ created: number; skipped: number; errors: number }> {
  let created = 0
  let skipped = 0
  let errors = 0
  const batchSize = 100
  let page = 1
  let hasMore = true

  while (hasMore) {
    const result = await payload.find({
      collection: 'lessons',
      where: {
        or: [{ introContentPage: { exists: false } }, { introContentPage: { equals: null } }],
      },
      limit: batchSize,
      page,
      depth: 0,
      overrideAccess: true,
    })

    const lessons = result.docs

    if (lessons.length === 0) {
      hasMore = false
      break
    }

    for (const lesson of lessons) {
      try {
        const tenantId =
          lesson.tenant && typeof lesson.tenant === 'object' && 'id' in lesson.tenant
            ? (lesson.tenant as { id: string }).id
            : (lesson.tenant as string | null)

        const title = `הקדמה ל-${lesson.title || 'Untitled'}`
        const timestamp = Date.now().toString(36)
        const slug = `hagdima-le-${lesson.slug || lesson.id}-${timestamp}`

        const newPage = await payload.create({
          collection: 'content-pages',
          data: {
            lesson: lesson.id,
            title,
            slug,
            body: [] as never[],
            status: 'published',
            isActive: true,
            tenant: tenantId ?? undefined,
          } as never,
          context: { _skipIntroCreation: true, _skipBlockSync: true },
          overrideAccess: true,
        })

        await payload.update({
          collection: 'lessons',
          id: lesson.id,
          data: { introContentPage: newPage.id },
          context: { _skipIntroCreation: true },
          overrideAccess: true,
        })

        created++
      } catch (e) {
        errors++
        payload.logger?.warn(`Failed to create intro for lesson ${lesson.id}: ${e}`)
      }
    }

    if (lessons.length < batchSize) {
      hasMore = false
    } else {
      page++
    }
  }

  // Count already-processed lessons for logging
  try {
    const { totalDocs } = await payload.find({
      collection: 'lessons',
      where: {
        and: [{ introContentPage: { exists: true } }, { introContentPage: { not_equals: null } }],
      },
      limit: 0,
      overrideAccess: true,
    })
    skipped = totalDocs - created
  } catch {
    // Ignore counting errors
  }

  return { created, skipped, errors }
}

/**
 * onInit wrapper for the backfill migration.
 *
 * This ensures the backfill runs automatically on server startup.
 * It's idempotent - it only creates pages for lessons that need them.
 */
export async function runBackfillOnInit(payload: Payload): Promise<void> {
  const { created, skipped, errors } = await backfillLessonIntroContentPages(payload)

  if (created > 0 || errors > 0) {
    payload.logger?.info(
      `Created ${created} intro content pages (${skipped} skipped, ${errors} errors)`,
    )
  }
}
