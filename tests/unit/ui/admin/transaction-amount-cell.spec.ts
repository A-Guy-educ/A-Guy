/**
 * Unit tests: TransactionAmountCell wired in Transactions collection (#2526)
 *
 * Verifies that the Transactions collection config wires the amount field
 * to the TransactionAmountCell component for formatted display in admin list.
 *
 * Bug: Amount shown as raw integer (e.g., 3900) instead of formatted
 * currency (e.g., ₪39.00) in admin list view at
 * /admin/collections/transactions.
 *
 * Fix: Add admin.components.Cell to the amount field pointing to
 * TransactionAmountCell, which formats agorot → ₪XX.XX.
 *
 * @fileType unit-test
 * @domain admin
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

describe('Transactions collection amount field cell (#2526)', () => {
  const transactionsPath = path.resolve(
    process.cwd(),
    'src/server/payload/collections/Transactions.ts',
  )

  it('should have an amount field with a custom Cell component', () => {
    const content = readFileSync(transactionsPath, 'utf-8')

    // The amount field should have admin.components.Cell configured
    // This ensures the admin list shows formatted currency instead of raw integer
    expect(content).toContain("name: 'amount'")
    expect(content).toContain('Cell')
    expect(content).toContain('TransactionAmountCell')
  })

  it('should reference TransactionAmountCell component for the amount field', () => {
    const content = readFileSync(transactionsPath, 'utf-8')

    // The cell path should follow Payload's @/ path alias convention
    expect(content).toContain('@/ui/admin/TransactionAmountCell#TransactionAmountCell')
  })
})
