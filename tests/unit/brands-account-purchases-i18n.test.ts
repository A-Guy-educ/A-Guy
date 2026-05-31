/**
 * Brand Account Purchases i18n Keys Test
 *
 * @fileType unit-test
 * @domain brands,i18n
 * @ai-summary Verifies that account.purchases.* i18n keys exist in brand messages.
 *
 * The purchases pages (account/purchases and account/purchases/[transactionId])
 * use useTranslations('account.purchases') to resolve keys like title, refresh,
 * status.*, etc. These keys must exist in the brand messages to avoid raw key
 * names being displayed to users.
 */

import { describe, expect, it } from 'vitest'
import { getBrand } from '@/brands'
import enBaseMessages from '../../src/i18n/en.json'
import heBaseMessages from '../../src/i18n/he.json'

function mergeMessages(base: Record<string, unknown>, brand: Record<string, unknown>) {
  return { ...base, ...brand }
}

describe('account.purchases i18n keys in brand messages', () => {
  const brand = getBrand()
  const enMessages = mergeMessages(enBaseMessages, brand.messages.en ?? {})
  const heMessages = mergeMessages(heBaseMessages, brand.messages.he ?? {})

  function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
    const keys = path.split('.')
    let value: unknown = obj
    for (const k of keys) {
      if (value && typeof value === 'object' && k in (value as Record<string, unknown>)) {
        value = (value as Record<string, unknown>)[k]
      } else {
        return undefined
      }
    }
    return typeof value === 'string' ? value : undefined
  }

  const requiredKeys: Array<{ key: string; en: string; he: string }> = [
    // PurchasesPageContent.tsx
    { key: 'account.purchases.title', en: 'My Purchases', he: 'הרכישות שלי' },
    { key: 'account.purchases.refresh', en: 'Refresh', he: 'רענן' },
    { key: 'account.purchases.unknownProduct', en: 'Unknown Product', he: 'מוצר לא ידוע' },
    { key: 'account.purchases.couponApplied', en: 'Coupon: {code}', he: 'קופון: {code}' },
    { key: 'account.purchases.empty.title', en: 'No purchases yet', he: 'אין רכישות עדיין' },
    {
      key: 'account.purchases.empty.description',
      en: "You haven't made any purchases. Browse our products to get started.",
      he: 'טרם ביצעת רכישות. עיין במוצרים שלנו כדי להתחיל.',
    },
    { key: 'account.purchases.empty.cta', en: 'Browse Products', he: 'עיין במוצרים' },
    // Status badges (shared across both pages)
    // Note: JSON cannot have duplicate keys, so status types use 'statuses' object
    // while the field label uses 'statusLabel'. The component uses t('status.${status}')
    // for badges and t('status') for the label; the brand messages must use
    // 'statuses' for types to avoid the duplicate key issue.
    { key: 'account.purchases.statuses.pending', en: 'Pending', he: 'בהמתנה' },
    { key: 'account.purchases.statuses.succeeded', en: 'Succeeded', he: 'הושלם' },
    { key: 'account.purchases.statuses.failed', en: 'Failed', he: 'נכשל' },
    { key: 'account.purchases.statuses.refunded', en: 'Refunded', he: 'הוחזר' },
    // TransactionDetailContent.tsx
    { key: 'account.purchases.refreshStatus', en: 'Refresh Status', he: 'רענן סטטוס' },
    { key: 'account.purchases.unlockedItems', en: 'Unlocked Items', he: 'פריטים שנפתחו' },
    { key: 'account.purchases.courses', en: 'Courses', he: 'קורסים' },
    { key: 'account.purchases.features', en: 'Features', he: 'תכונות' },
    { key: 'account.purchases.refunded', en: 'Refunded', he: 'הוחזר' },
    { key: 'account.purchases.refundedAmount', en: 'Refunded amount', he: 'סכום החזר' },
    {
      key: 'account.purchases.errorLoading',
      en: 'Failed to load transaction',
      he: 'טעינת העסקה נכשלה',
    },
    { key: 'account.purchases.tryAgain', en: 'Try Again', he: 'נסה שוב' },
    { key: 'account.purchases.notFound', en: 'Transaction not found', he: 'העסקה לא נמצאה' },
    { key: 'account.purchases.backToPurchases', en: 'Back to Purchases', he: 'חזרה לרכישות' },
    { key: 'account.purchases.purchasedOn', en: 'Purchased on', he: 'נרכש ב' },
    { key: 'account.purchases.amount', en: 'Amount', he: 'סכום' },
    { key: 'account.purchases.provider', en: 'Provider', he: 'ספק' },
    { key: 'account.purchases.transactionId', en: 'Transaction ID', he: 'מזהה עסקה' },
    { key: 'account.purchases.statusLabel', en: 'Status', he: 'סטטוס' },
    { key: 'account.purchases.coupon', en: 'Coupon', he: 'קופון' },
    {
      key: 'account.purchases.pendingHelpText',
      en: 'Your payment is being processed. This may take a few moments.',
      he: 'התשלום שלך מעובד. זה עשוי לקחת מספר רגעים.',
    },
    { key: 'account.purchases.viewProduct', en: 'View Product', he: 'צפה במוצר' },
  ]

  for (const { key, en, he } of requiredKeys) {
    it(`English: "${key}" resolves to "${en}" (not raw key)`, () => {
      const value = getNestedValue(enMessages as Record<string, unknown>, key)
      expect(value, `Expected "${en}" but got "${value}" (key may be missing or raw)`).toBe(en)
    })

    it(`Hebrew: "${key}" resolves to "${he}" (not raw key)`, () => {
      const value = getNestedValue(heMessages as Record<string, unknown>, key)
      expect(value, `Expected "${he}" but got "${value}" (key may be missing or raw)`).toBe(he)
    })
  }
})
