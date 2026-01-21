import { getPayload } from 'payload'
import config from '@payload-config'

import { logger } from '@/utilities/logger'

async function migrateLocalAuthEnabled() {
  const payload = await getPayload({ config })

  const result = await payload.update({
    collection: 'users',
    where: { localAuthEnabled: { exists: false } },
    data: { localAuthEnabled: true },
  })

  logger.info({ migrated: result.docs.length }, 'Migrated localAuthEnabled defaults')
}

migrateLocalAuthEnabled().catch((error: unknown) => {
  logger.error({ err: error }, 'Failed to migrate localAuthEnabled defaults')
  process.exitCode = 1
})
