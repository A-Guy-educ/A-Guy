/**
 * Seed the A-Guy platform introduction page
 *
 * Creates (or updates) the "About A-Guy" page from docs/a-guy/intro.md content.
 * Idempotent — safe to run multiple times (upserts by slug).
 *
 * Usage: npx tsx scripts/seed-intro-page.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { introPage } from '@/server/payload/endpoints/seed/intro-page'

async function main() {
  const payload = await getPayload({ config })
  const pageData = introPage()

  // Check if page already exists
  const existing = await payload.find({
    collection: 'pages',
    where: { slug: { equals: pageData.slug } },
    limit: 1,
    overrideAccess: true,
  })

  if (existing.docs.length > 0) {
    const doc = existing.docs[0]
    await payload.update({
      collection: 'pages',
      id: doc.id,
      data: pageData,
      overrideAccess: true,
    })
    payload.logger.info(`Updated existing "About A-Guy" page (id: ${doc.id})`)
  } else {
    const doc = await payload.create({
      collection: 'pages',
      data: pageData,
      overrideAccess: true,
    })
    payload.logger.info(`Created "About A-Guy" page (id: ${doc.id})`)
  }

  payload.logger.info('Done! Visit /about to see the page.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Failed to seed intro page:', err)
  process.exit(1)
})
