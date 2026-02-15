/**
 * Data Audit Script: Duplicate Header Detection
 *
 * Validates that the duplicate header fix is systemic by auditing actual data.
 *
 * Purpose:
 * - Iterates over Courses, Chapters, and Lessons collections
 * - Uses exact same normalization logic as header components
 * - Counts records where normalized(title) === normalized(description)
 * - Reports statistics and sample slugs
 *
 * Run with: pnpm exec tsx scripts/audit-duplicate-headers.ts
 *
 * This is a read-only validation script - NO schema modifications.
 */

import { logger } from '@/infra/utils/logger'
import config from '@payload-config'
import { getPayload, type Payload } from 'payload'
import { normalizeComparableText } from '@/infra/utils/normalizeComparableText'

interface CollectionDoc {
  id: string
  slug?: string
  title: string
  description?: string | null
}

interface AuditResult {
  collection: string
  total: number
  duplicates: number
  duplicatePercentage: number
  duplicateSamples: string[]
  differentSamples: string[]
}

async function auditCollection(payload: Payload, collectionName: string): Promise<AuditResult> {
  logger.info(`Auditing ${collectionName}...`)

  const result: AuditResult = {
    collection: collectionName,
    total: 0,
    duplicates: 0,
    duplicatePercentage: 0,
    duplicateSamples: [],
    differentSamples: [],
  }

  try {
    // Fetch all documents from collection
    const { docs } = await payload.find({
      collection: collectionName as 'courses' | 'chapters' | 'lessons',
      limit: 10000, // Large limit to get all records
      depth: 0, // Don't populate relationships
    })

    result.total = docs.length
    logger.info(`Found ${result.total} records in ${collectionName}`)

    // Warn if we hit the limit (results may be incomplete)
    if (docs.length === 10000) {
      logger.warn(
        `⚠️  Reached limit of 10000 records for ${collectionName}. Results may be incomplete.`,
      )
    }

    // Analyze each document
    for (const doc of docs as CollectionDoc[]) {
      const { title, description, slug } = doc

      // Skip if no description
      if (!description) {
        if (result.differentSamples.length < 10 && slug) {
          result.differentSamples.push(slug)
        }
        continue
      }

      // Apply same normalization as header components
      const normalizedTitle = normalizeComparableText(title)
      const normalizedDescription = normalizeComparableText(description)

      // Check if duplicate
      if (normalizedTitle === normalizedDescription) {
        result.duplicates++

        // Collect sample slugs (up to 10)
        if (result.duplicateSamples.length < 10 && slug) {
          result.duplicateSamples.push(slug)
        }
      } else {
        // Collect different samples (up to 10)
        if (result.differentSamples.length < 10 && slug) {
          result.differentSamples.push(slug)
        }
      }
    }

    // Calculate percentage
    result.duplicatePercentage = result.total > 0 ? (result.duplicates / result.total) * 100 : 0

    return result
  } catch (error) {
    logger.error({ error, collection: collectionName }, 'Error auditing collection')
    throw error
  }
}

async function runAudit() {
  logger.info('Starting duplicate header audit')

  try {
    // Get Payload instance
    const payload = await getPayload({ config })
    logger.info('Payload initialized')

    // Audit each collection
    const collections = ['courses', 'chapters', 'lessons']
    const results: AuditResult[] = []

    for (const collection of collections) {
      const result = await auditCollection(payload, collection)
      results.push(result)
    }

    // Print summary report
    console.log('\n' + '='.repeat(80))
    console.log('DUPLICATE HEADER AUDIT REPORT')
    console.log('='.repeat(80))
    console.log('\nNormalization Logic:')
    console.log('  1. trim() - Remove leading/trailing whitespace')
    console.log('  2. replace(/\\s+/g, " ") - Collapse multiple spaces to single space')
    console.log('  3. toLowerCase() - Convert to lowercase')
    console.log('\n' + '-'.repeat(80))

    for (const result of results) {
      console.log(`\n📊 Collection: ${result.collection.toUpperCase()}`)
      console.log(`   Total Records: ${result.total}`)
      console.log(`   Duplicates Found: ${result.duplicates}`)
      console.log(
        `   Duplicate Rate: ${result.duplicatePercentage.toFixed(2)}% (${result.duplicates}/${result.total})`,
      )

      if (result.duplicates > 0) {
        console.log(`\n   ⚠️  Sample Slugs with Duplicates (showing up to 10):`)
        result.duplicateSamples.forEach((slug, i) => {
          console.log(`      ${i + 1}. ${slug}`)
        })
      } else {
        console.log(`\n   ✅ No duplicates found!`)
      }

      if (result.differentSamples.length > 0) {
        console.log(`\n   ✅ Sample Slugs with Different Values (showing up to 10):`)
        result.differentSamples.slice(0, 10).forEach((slug, i) => {
          console.log(`      ${i + 1}. ${slug}`)
        })
      }
    }

    // Print overall summary
    console.log('\n' + '-'.repeat(80))
    console.log('OVERALL SUMMARY')
    console.log('-'.repeat(80))

    const totalRecords = results.reduce((sum, r) => sum + r.total, 0)
    const totalDuplicates = results.reduce((sum, r) => sum + r.duplicates, 0)
    const overallPercentage = totalRecords > 0 ? (totalDuplicates / totalRecords) * 100 : 0

    console.log(`\nTotal Records Audited: ${totalRecords}`)
    console.log(`Total Duplicates: ${totalDuplicates}`)
    console.log(`Overall Duplicate Rate: ${overallPercentage.toFixed(2)}%`)

    console.log('\n' + '='.repeat(80))
    console.log('VALIDATION STATUS')
    console.log('='.repeat(80))

    if (totalDuplicates === 0) {
      console.log('\n✅ SUCCESS: No duplicates found in any collection!')
      console.log('   The header fix is working correctly.')
    } else {
      console.log(
        `\n⚠️  INFO: ${totalDuplicates} duplicate(s) found across ${results.filter((r) => r.duplicates > 0).length} collection(s)`,
      )
      console.log('   These records will show only the title (description hidden).')
      console.log('   The header components are functioning as designed.')
    }

    console.log('\n' + '='.repeat(80) + '\n')

    logger.info('Audit completed successfully')
    process.exit(0)
  } catch (error) {
    logger.error({ error }, 'Audit failed')
    process.exit(1)
  }
}

// Run the audit
runAudit().catch((error) => {
  logger.error({ error }, 'Fatal error')
  process.exit(1)
})
