import { getPayload } from 'payload'

import config from '../src/payload.config'
import { logger } from '../src/utilities/logger/logger'

const DEFAULT_TYPE = 'learning'
const BATCH_SIZE = 100

async function migrateLessonTypes() {
  const payload = await getPayload({ config })

  const { totalDocs } = await payload.count({
    collection: 'lessons',
    where: {
      or: [{ type: { exists: false } }, { type: { equals: null } }],
    },
  })

  logger.info({ totalDocs }, 'Starting lesson type migration')

  if (totalDocs === 0) {
    logger.info('No lessons to migrate')
    return
  }

  let processed = 0
  let page = 1

  while (processed < totalDocs) {
    const batch = await payload.find({
      collection: 'lessons',
      where: {
        or: [{ type: { exists: false } }, { type: { equals: null } }],
      },
      limit: BATCH_SIZE,
      page,
    })

    for (const lesson of batch.docs) {
      await payload.update({
        collection: 'lessons',
        id: lesson.id,
        data: {
          type: DEFAULT_TYPE,
        },
      })
      processed += 1
    }

    logger.info({ processed, totalDocs }, 'Migrated lesson batch')
    page += 1
  }

  logger.info('Lesson type migration complete')
}

migrateLessonTypes().catch((error) => {
  const err = error instanceof Error ? error : new Error('Unknown error')
  logger.error({ err }, 'Lesson type migration failed')
  process.exitCode = 1
})
