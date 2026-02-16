import type { Payload } from 'payload'

/**
 * Backfills the adminTitle field for chapters that don't have it set.
 *
 * This migration ensures all existing chapters have a computed adminTitle
 * in the format: "Chapter Title — Course Title"
 *
 * This is needed because the afterRead hook fails when Payload strips fields
 * via select: { adminTitle: true } (used by admin relationship dropdowns).
 *
 * Once this migration runs, all chapters will have adminTitle persisted in DB,
 * so relationship dropdowns will display the correct label without N+1 queries.
 *
 * @param payload - The Payload instance
 * @returns Object with counts of updated, skipped, and errored chapters
 */
export async function backfillChapterAdminTitles(
  payload: Payload,
): Promise<{ updated: number; skipped: number; errors: number }> {
  let updated = 0
  let skipped = 0
  let errors = 0
  const batchSize = 500
  let page = 1
  let hasMore = true

  while (hasMore) {
    try {
      // Query chapters that need adminTitle backfilled
      const result = await payload.find({
        collection: 'chapters',
        where: {
          or: [
            { adminTitle: { equals: null } },
            { adminTitle: { equals: '' } },
            { adminTitle: { exists: false } },
          ],
        },
        limit: batchSize,
        page,
        depth: 0,
        overrideAccess: true,
      })

      const chapters = result.docs

      if (chapters.length === 0) {
        hasMore = false
        break
      }

      // Process each chapter in batch
      for (const chapter of chapters) {
        try {
          let courseTitle: string | null = null

          // Fetch the related course to get its title
          if (chapter.course && typeof chapter.course === 'string') {
            try {
              const course = await payload.findByID({
                collection: 'courses',
                id: chapter.course,
                depth: 0,
                overrideAccess: true,
              })
              courseTitle = (course as { title?: string })?.title || null
            } catch {
              // If course lookup fails, we'll use just the chapter title
              payload.logger?.error(
                `Error fetching course ${chapter.course} for chapter ${chapter.id}`,
              )
            }
          }

          const chapterTitle = chapter.title || 'Untitled'
          const adminTitle = courseTitle ? `${chapterTitle} — ${courseTitle}` : chapterTitle

          // Update the chapter with adminTitle set
          // Use skipAdminTitleRecompute context to avoid triggering the beforeChange hook's redundant lookup
          await payload.update({
            collection: 'chapters',
            id: chapter.id,
            data: { adminTitle },
            context: { skipAdminTitleRecompute: true },
          })

          updated++
        } catch {
          errors++
          payload.logger?.error(`Error backfilling adminTitle for chapter ${chapter.id}`)
        }
      }

      // Check if we need more pages
      if (chapters.length < batchSize) {
        hasMore = false
      } else {
        page++
      }
    } catch {
      payload.logger?.error('Error querying chapters for adminTitle backfill')
      errors++
      hasMore = false
    }
  }

  // Count already-completed chapters for logging
  try {
    const { totalDocs } = await payload.find({
      collection: 'chapters',
      where: {
        and: [
          { adminTitle: { exists: true } },
          { adminTitle: { not_equals: null } },
          { adminTitle: { not_equals: '' } },
        ],
      },
      limit: 0,
      overrideAccess: true,
    })
    skipped = totalDocs
  } catch {
    // Ignore counting errors - we still updated what we could
  }

  return { updated, skipped, errors }
}

/**
 * onInit wrapper for the backfill migration.
 *
 * This ensures the backfill runs automatically on server startup.
 * It's idempotent - it only updates chapters that need it.
 */
export async function runBackfillOnInit(payload: Payload): Promise<void> {
  const { updated, skipped, errors } = await backfillChapterAdminTitles(payload)

  if (updated > 0 || errors > 0) {
    payload.logger?.info(
      `Backfilled ${updated} chapter adminTitles (${skipped} already set, ${errors} errors)`,
    )
  }
}
