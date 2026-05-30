/**
 * Dedup PaymentStats — one-shot cleanup script
 *
 * Finds duplicate (date, currency) rows in payment_stats and merges them by
 * summing all counter fields, keeping the most recently-updated document
 * in each group as the survivor.
 *
 * This must be run BEFORE the unique compound index on (date, currency) is
 * created (i.e. before deploying the PaymentStats change that adds the index).
 * After running this script, the unique index can be created safely.
 *
 * Usage:
 *   pnpm tsx scripts/dedup-payment-stats.ts           # dry-run (no changes)
 *   pnpm tsx scripts/dedup-payment-stats.ts --execute   # actual deduplication
 *
 * @fileType script
 * @domain payments
 * @pattern migration
 */
import { getPayload } from 'payload'

import config from '@payload-config'

interface PaymentStatsDoc {
  _id: { toString(): string }
  date: string
  currency: string
  totalRevenueAgorot?: number
  refundedAgorot?: number
  failedAgorot?: number
  transactionCount?: number
  succeededCount?: number
  refundedCount?: number
  failedCount?: number
  newCustomersCount?: number
  updatedAt?: Date
}

interface DedupGroup {
  date: string
  currency: string
  docs: PaymentStatsDoc[]
}

const COUNTER_FIELDS = [
  'totalRevenueAgorot',
  'refundedAgorot',
  'failedAgorot',
  'transactionCount',
  'succeededCount',
  'refundedCount',
  'failedCount',
  'newCustomersCount',
] as const

async function findDuplicateGroups(db: any): Promise<DedupGroup[]> {
  const collection = db.collection('payment_stats')

  const duplicates = await collection
    .aggregate([
      {
        $group: {
          _id: { date: '$date', currency: '$currency' },
          count: { $sum: 1 },
          docs: {
            $push: {
              _id: '$_id',
              updatedAt: '$updatedAt',
              totalRevenueAgorot: '$totalRevenueAgorot',
              refundedAgorot: '$refundedAgorot',
              failedAgorot: '$failedAgorot',
              transactionCount: '$transactionCount',
              succeededCount: '$succeededCount',
              refundedCount: '$refundedCount',
              failedCount: '$failedCount',
              newCustomersCount: '$newCustomersCount',
            },
          },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray()

  return duplicates.map((d: any) => ({
    date: d._id.date,
    currency: d._id.currency,
    docs: d.docs as PaymentStatsDoc[],
  }))
}

async function mergeGroup(group: DedupGroup): Promise<{
  keeperId: string
  deleteIds: string[]
  merged: Record<string, number>
}> {
  // Sort by updatedAt descending — most recent first
  const sorted = [...group.docs].sort(
    (a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0),
  )

  const keeper = sorted[0]
  const deleteIds: string[] = sorted.slice(1).map((d) => d._id.toString())

  // Sum counter fields from all docs (treat undefined/missing as 0)
  const merged: Record<string, number> = {}
  for (const field of COUNTER_FIELDS) {
    merged[field] = 0
  }

  for (const doc of sorted) {
    for (const field of COUNTER_FIELDS) {
      merged[field] += doc[field] ?? 0
    }
  }

  return { keeperId: keeper._id.toString(), deleteIds, merged }
}

async function main() {
  const execute = process.argv.includes('--execute')

  // eslint-disable-next-line no-console
  console.log(
    execute
      ? '=== DEDUP PAYMENT STATS (execute mode) ==='
      : '=== DEDUP PAYMENT STATS (dry-run) ===',
  )
  // eslint-disable-next-line no-console
  console.log('')

  if (!execute) {
    // eslint-disable-next-line no-console
    console.log('Running in DRY-RUN mode. Pass --execute to apply changes.')
    // eslint-disable-next-line no-console
    console.log('')
  }

  const payload = await getPayload({ config })
  const db = (payload.db as any)?.connection?.db ?? (payload.db as any)?.db

  if (!db) {
    // eslint-disable-next-line no-console
    console.error('Could not access database connection')
    process.exit(1)
  }

  const collection = db.collection('payment_stats')

  // Check if the unique index already exists — if so, dedup is not needed
  try {
    const indexes = await collection.indexes()
    const uniqueDateCurrencyIndex = indexes.find(
      (idx: any) => idx.key?.date === 1 && idx.key?.currency === 1 && idx.unique === true,
    )
    if (uniqueDateCurrencyIndex) {
      // eslint-disable-next-line no-console
      console.log('Unique index on (date, currency) already exists — no dedup needed.')
      process.exit(0)
    }
  } catch {
    // Index check failed — proceed anyway
  }

  const groups = await findDuplicateGroups(db)

  if (groups.length === 0) {
    // eslint-disable-next-line no-console
    console.log('No duplicate (date, currency) groups found — nothing to do.')
    process.exit(0)
  }

  // eslint-disable-next-line no-console
  console.log(`Found ${groups.length} duplicate group(s):\n`)

  let totalDeleted = 0

  for (const group of groups) {
    const { keeperId, deleteIds, merged } = await mergeGroup(group)

    // eslint-disable-next-line no-console
    console.log(
      `  [${group.date}, ${group.currency}]: ${group.docs.length} duplicates → keeper=${keeperId}`,
    )
    // eslint-disable-next-line no-console
    console.log(
      `    Merged counters: totalRevenue=${merged.totalRevenueAgorot}, refunded=${merged.refundedAgorot}, failed=${merged.failedAgorot}, txCount=${merged.transactionCount}, succeeded=${merged.succeededCount}, refundedCnt=${merged.refundedCount}, failedCnt=${merged.failedCount}, newCust=${merged.newCustomersCount}`,
    )

    if (execute) {
      // Update the keeper doc with merged counters
      await collection.updateOne(
        { _id: new (await import('mongodb')).ObjectId(keeperId) },
        {
          $set: {
            totalRevenueAgorot: merged.totalRevenueAgorot,
            refundedAgorot: merged.refundedAgorot,
            failedAgorot: merged.failedAgorot,
            transactionCount: merged.transactionCount,
            succeededCount: merged.succeededCount,
            refundedCount: merged.refundedCount,
            failedCount: merged.failedCount,
            newCustomersCount: merged.newCustomersCount,
          },
        },
      )

      // Delete duplicate docs
      const { ObjectId } = await import('mongodb')
      await collection.deleteMany({
        _id: { $in: deleteIds.map((id) => new ObjectId(id)) },
      })

      totalDeleted += deleteIds.length
    }
  }

  // eslint-disable-next-line no-console
  console.log('')

  if (execute) {
    // eslint-disable-next-line no-console
    console.log(`Deleted ${totalDeleted} duplicate document(s).`)

    // Attempt to create the unique index (best-effort — Payload may already do this)
    try {
      await collection.createIndex(
        { date: 1, currency: 1 },
        { unique: true, name: 'date_currency_unique' },
      )
      // eslint-disable-next-line no-console
      console.log('Created unique index on (date, currency).')
    } catch (err: any) {
      if (err.code === 85 || err.code === 86) {
        // Index already exists with different options — manual intervention needed
        // eslint-disable-next-line no-console
        console.error('Index creation failed (conflicting index exists). Please resolve manually.')
        process.exit(1)
      }
      // eslint-disable-next-line no-console
      console.warn('Could not create unique index:', err.message)
    }

    // eslint-disable-next-line no-console
    console.log('\nDedup complete.')
  } else {
    // eslint-disable-next-line no-console
    console.log(
      `Would delete ${groups.reduce((s, g) => s + g.docs.length - 1, 0)} duplicate document(s).`,
    )
    // eslint-disable-next-line no-console
    console.log('Run with --execute to apply.')
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Dedup failed:', err)
    process.exit(1)
  })
