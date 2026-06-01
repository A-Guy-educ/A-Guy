/**
 * Migration: fix-fixed-coupon-units
 *
 * Finds existing coupons where discountType='fixed' AND discountValue < 100.
 * These coupons were created before the shekel↔agorot fix — the admin typed
 * a shekel amount (e.g. 30 for ₪30) but it was stored as-is (30 agorot = ₪0.30).
 *
 * Without --apply: prints all suspect coupons for manual review.
 * With --apply: multiplies each discountValue by 100 (shekels → agorot) and
 * logs each corrected coupon.
 *
 * Idempotent: re-running with --apply on already-corrected coupons will NOT
 * double-correct them because the beforeChange hook uses the <10000 threshold
 * to detect already-converted values.
 *
 * Usage:
 *   pnpm tsx scripts/fix-fixed-coupon-units.ts          # review mode
 *   pnpm tsx scripts/fix-fixed-coupon-units.ts --apply  # apply fixes
 *
 * @fileType migration-script
 * @domain payments
 */

import { getPayload } from 'payload'

import config from '@payload-config'

interface SuspectCoupon {
  id: string
  code: string
  discountValue: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw doc
  raw: any
}

async function main() {
  const apply = process.argv.includes('--apply')

  const payload = await getPayload({ config })

  console.log('')
  console.log('🔍 Fix Fixed Coupon Units Migration')
  console.log('====================================')
  console.log(`Mode: ${apply ? 'APPLY (will modify data)' : 'REVIEW (read-only)'}`)
  console.log('')

  // Find all fixed coupons with discountValue < 100 (less than ₪1 in agorot)
  // These are almost certainly coupons where the admin typed shekels but
  // no conversion happened — e.g. 30 (₪30) stored as 30 agorot (₪0.30)
  const SUSPECT_THRESHOLD = 100

  let page = 1
  const PAGE_SIZE = 200
  const suspectCoupons: SuspectCoupon[] = []

  while (true) {
    const results = await payload.find({
      collection: 'coupons',
      where: {
        and: [
          { discountType: { equals: 'fixed' } },
          { discountValue: { less_than: SUSPECT_THRESHOLD } },
        ],
      },
      limit: PAGE_SIZE,
      page,
      depth: 0,
      overrideAccess: true,
    })

    for (const doc of results.docs) {
      suspectCoupons.push({
        id: doc.id as string,
        code: doc.code as string,
        discountValue: doc.discountValue as number,
        raw: doc,
      })
    }

    if (!results.hasNextPage) break
    page++
  }

  console.log(
    `Found ${suspectCoupons.length} suspect coupon(s) (fixed + discountValue < ${SUSPECT_THRESHOLD})`,
  )
  console.log('')

  if (suspectCoupons.length === 0) {
    console.log('✅ No suspect coupons found. Nothing to do.')
    return
  }

  // Print table header
  console.log('Suspect coupons:')
  console.log('─'.repeat(70))
  console.log(
    `  ${'ID'.padEnd(24)} ${'CODE'.padEnd(16)} ${'VALUE (agorot)'.padEnd(16)} ${'INTERPRETED AS'}`,
  )
  console.log('─'.repeat(70))

  for (const c of suspectCoupons) {
    const shekels = c.discountValue / 100
    console.log(
      `  ${c.id.padEnd(24)} ${c.code.padEnd(16)} ${String(c.discountValue).padEnd(16)} ₪${shekels.toFixed(2)}`,
    )
  }

  console.log('─'.repeat(70))
  console.log('')

  if (!apply) {
    console.log('ℹ️  Run with --apply to auto-correct these coupons.')
    console.log('    Each correction multiplies discountValue by 100 (shekels → agorot).')
    return
  }

  // ─── Apply mode ────────────────────────────────────────────────────────────
  console.log('⚠️  APPLY MODE — correcting coupons...')
  console.log('')

  let corrected = 0
  let skipped = 0
  let errors = 0

  for (const c of suspectCoupons) {
    try {
      const newValue = Math.round(c.discountValue * 100)
      await payload.update({
        collection: 'coupons',
        id: c.id,
        data: { discountValue: newValue },
        overrideAccess: true,
      })
      console.log(
        `  ✅ ${c.code}: ${c.discountValue} → ${newValue} agorot (was ₪${(c.discountValue / 100).toFixed(2)} → ₪${(newValue / 100).toFixed(2)})`,
      )
      corrected++
    } catch (err) {
      console.log(`  ❌ ${c.code}: error — ${(err as Error).message}`)
      errors++
    }
  }

  console.log('')
  console.log(`Done. corrected=${corrected} errors=${errors}`)

  if (errors > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
