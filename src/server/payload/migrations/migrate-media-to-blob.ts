/**
 * Migration Script: Update Media URLs to Vercel Blob
 *
 * This script finds media documents with relative URLs and updates them
 * to use the full Vercel Blob URLs for files that already exist in blob storage.
 */

import { list } from '@vercel/blob'
import { config as loadEnvVars } from 'dotenv'
import 'dotenv/config'
import { getPayload } from 'payload'

import { logger } from '@/infra/utils/logger/logger'
import config from '@payload-config'

// Load environment variables
loadEnvVars({ path: '.env.local' })
loadEnvVars({ path: '.env' })

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN
const BLOB_BASE_URL = 'https://pd8gxkxxaj3lzovc.public.blob.vercel-storage.com'
const BATCH_SIZE = 50

/**
 * Extract filename from a relative URL
 */
function extractFilename(url: string): string | null {
  if (!url) return null
  const match = url.match(/\/api\/media\/file\/(.+)$/) || url.match(/\/media\/(.+)$/)
  return match ? decodeURIComponent(match[1]) : null
}

/**
 * Main migration function
 */
async function migrateMediaUrls() {
  logger.info('Starting media URL migration to Vercel Blob...')

  if (!BLOB_TOKEN) {
    logger.error('BLOB_READ_WRITE_TOKEN not found')
    process.exit(1)
  }

  const payload = await getPayload({ config })

  // Get all files already in blob storage (raw API, no prefix issues)
  const blobResult = await list({ token: BLOB_TOKEN })
  const blobFilenames = new Set(blobResult.blobs.map((b) => b.pathname))

  logger.info({ blobCount: blobFilenames.size }, 'Files found in Vercel Blob')

  // Find all media documents with relative URLs
  const { totalDocs } = await payload.count({
    collection: 'media',
    where: {
      or: [{ url: { like: '/api/media/' } }, { url: { like: '/media/' } }],
    },
    overrideAccess: true,
  })

  if (totalDocs === 0) {
    logger.info('No media documents with relative URLs found. Migration complete.')
    return
  }

  logger.info({ totalDocs }, 'Found media documents with relative URLs')

  let processed = 0
  let updated = 0
  let skipped = 0
  let notFound = 0

  let page = 1

  while (processed < totalDocs) {
    const batch = await payload.find({
      collection: 'media',
      where: {
        or: [{ url: { like: '/api/media/' } }, { url: { like: '/media/' } }],
      },
      limit: BATCH_SIZE,
      page,
      overrideAccess: true,
    })

    if (batch.docs.length === 0) {
      break
    }

    logger.info(
      { page, batchSize: batch.docs.length, processed, total: totalDocs },
      'Processing batch...',
    )

    for (const doc of batch.docs) {
      const url = doc.url
      if (!url) {
        skipped++
        continue
      }

      const filename = extractFilename(url)
      if (!filename) {
        skipped++
        continue
      }

      // Check if file exists in blob storage
      if (blobFilenames.has(filename)) {
        const blobUrl = `${BLOB_BASE_URL}/${filename}`

        try {
          await payload.update({
            collection: 'media',
            id: doc.id,
            data: { url: blobUrl },
            overrideAccess: true,
          })

          logger.info({ docId: doc.id, filename, newUrl: blobUrl }, 'Updated media URL')
          updated++
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          logger.error(
            { docId: doc.id, filename, error: errorMessage },
            'Failed to update media URL',
          )
          skipped++
        }
      } else {
        logger.warn({ docId: doc.id, filename }, 'File not found in Vercel Blob')
        notFound++
      }
    }

    processed += batch.docs.length
    page++
  }

  // Summary
  logger.info(
    {
      total: totalDocs,
      updated,
      skipped,
      notFound,
    },
    'Media URL migration completed',
  )
}

// Run the migration
migrateMediaUrls()
  .then(() => {
    logger.info('Migration script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    const err = error instanceof Error ? error : new Error('Unknown error')
    logger.error({ err }, 'Migration script failed')
    process.exitCode = 1
  })
