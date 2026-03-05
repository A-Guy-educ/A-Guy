/**
 * Backfill content locale fields on existing data
 *
 * Sets locale = 'he' (Hebrew) on all existing content for backward compatibility.
 * Idempotent — safe to run multiple times.
 *
 * Usage: npx tsx scripts/backfill-content-locale.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { DEFAULT_CONTENT_LOCALE } from '@/server/payload/fields/contentLocale'

async function backfillCollection(
  payload: Awaited<ReturnType<typeof getPayload>>,
  collection: string,
  localeField: string = 'locale',
) {
  const docs = await payload.find({
    collection: collection as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    where: {
      or: [
        { [localeField]: { exists: false } },
        { [localeField]: { equals: null } },
        { [localeField]: { equals: '' } },
      ],
    },
    limit: 10000,
    overrideAccess: true,
  })

  let updated = 0
  for (const doc of docs.docs) {
    await payload.update({
      collection: collection as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      id: doc.id,
      data: { [localeField]: DEFAULT_CONTENT_LOCALE } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      overrideAccess: true,
    })
    updated++
  }

  return { total: docs.totalDocs, updated }
}

async function backfillPromptKeys(payload: Awaited<ReturnType<typeof getPayload>>) {
  const docs = await payload.find({
    collection: 'prompts' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    where: {
      or: [
        { promptKey: { exists: false } },
        { promptKey: { equals: null } },
        { promptKey: { equals: '' } },
      ],
    },
    limit: 10000,
    overrideAccess: true,
  })

  let updated = 0
  for (const doc of docs.docs) {
    const legacyKey = (doc as any).key // eslint-disable-line @typescript-eslint/no-explicit-any
    if (legacyKey) {
      await payload.update({
        collection: 'prompts' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        id: doc.id,
        data: { promptKey: legacyKey } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        overrideAccess: true,
      })
      updated++
    }
  }

  return { total: docs.totalDocs, updated }
}

async function backfillGlobalVariants(
  payload: Awaited<ReturnType<typeof getPayload>>,
  globalSlug: 'header' | 'footer',
) {
  const data = await payload.findGlobal({ slug: globalSlug })

  // Already migrated — has variants array
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((data as any).variants && Array.isArray((data as any).variants)) {
    return { migrated: false, reason: 'already has variants' }
  }

  // Has flat navItems — wrap into variants
  const navItems = (data as any).navItems // eslint-disable-line @typescript-eslint/no-explicit-any
  if (navItems && Array.isArray(navItems)) {
    await payload.updateGlobal({
      slug: globalSlug,
      data: {
        variants: [{ locale: DEFAULT_CONTENT_LOCALE, navItems }],
      } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      overrideAccess: true,
    })
    return { migrated: true, navItemCount: navItems.length }
  }

  return { migrated: false, reason: 'no navItems found' }
}

async function main() {
  const payload = await getPayload({ config })

  console.log('=== Content Locale Backfill ===\n')

  // Collections with locale field
  for (const collection of ['courses', 'pages', 'posts', 'categories', 'prompts']) {
    const result = await backfillCollection(payload, collection)
    console.log(`${collection}: ${result.updated}/${result.total} updated`)
  }

  // Conversations with preferredLocale field
  const convResult = await backfillCollection(payload, 'conversations', 'preferredLocale')
  console.log(`conversations (preferredLocale): ${convResult.updated}/${convResult.total} updated`)

  // Prompt key migration
  const promptKeyResult = await backfillPromptKeys(payload)
  console.log(
    `prompts (key→promptKey): ${promptKeyResult.updated}/${promptKeyResult.total} migrated`,
  )

  // Header/Footer variants
  for (const global of ['header', 'footer'] as const) {
    const result = await backfillGlobalVariants(payload, global)
    console.log(`${global}: ${JSON.stringify(result)}`)
  }

  console.log('\n=== Backfill Complete ===')

  process.exit(0)
}

main().catch((err) => {
  console.error('Backfill failed:', err)
  process.exit(1)
})
