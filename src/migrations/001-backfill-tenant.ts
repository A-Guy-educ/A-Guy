import { getPayload, type CollectionSlug } from 'payload'

import config from '../payload.config'
import { getDefaultTenantSlug } from '../lib/tenant/get-default-tenant'
import { logger } from '../utilities/logger/logger'

const BATCH_SIZE = 100
const COLLECTIONS_TO_BACKFILL: CollectionSlug[] = [
  'courses',
  'chapters',
  'lessons',
  'exercises',
  'media',
  'user-progress',
]

async function ensureDefaultTenant(payload: Awaited<ReturnType<typeof getPayload>>) {
  const slug = getDefaultTenantSlug()

  const existing = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: slug } },
    limit: 1,
    overrideAccess: true,
  })

  if (existing.docs[0]) {
    return existing.docs[0].id
  }

  const created = await payload.create({
    collection: 'tenants',
    data: {
      name: slug,
      slug,
      status: 'active',
    },
    overrideAccess: true,
  })

  return created.id
}

async function backfillCollection(
  payload: Awaited<ReturnType<typeof getPayload>>,
  collection: CollectionSlug,
  tenantId: string,
) {
  const { totalDocs } = await payload.count({
    collection,
    where: {
      or: [{ tenant: { exists: false } }, { tenant: { equals: null } }],
    },
    overrideAccess: true,
  })

  if (!totalDocs) {
    logger.info({ collection }, 'No tenant backfill needed')
    return
  }

  logger.info({ collection, totalDocs }, 'Starting tenant backfill')

  let processed = 0
  let page = 1

  while (processed < totalDocs) {
    const batch = await payload.find({
      collection,
      where: {
        or: [{ tenant: { exists: false } }, { tenant: { equals: null } }],
      },
      limit: BATCH_SIZE,
      page,
      overrideAccess: true,
    })

    for (const doc of batch.docs) {
      await payload.update({
        collection,
        id: doc.id,
        data: {
          tenant: tenantId,
        },
        overrideAccess: true,
      })
      processed += 1
    }

    logger.info({ collection, processed, totalDocs }, 'Tenant backfill batch completed')
    page += 1
  }
}

async function runTenantBackfill() {
  const payload = await getPayload({ config })
  const tenantId = await ensureDefaultTenant(payload)

  for (const collection of COLLECTIONS_TO_BACKFILL) {
    await backfillCollection(payload, collection, tenantId)
  }

  logger.info({ tenantId }, 'Tenant backfill completed')
}

runTenantBackfill().catch((error) => {
  const err = error instanceof Error ? error : new Error('Unknown error')
  logger.error({ err }, 'Tenant backfill failed')
  process.exitCode = 1
})
