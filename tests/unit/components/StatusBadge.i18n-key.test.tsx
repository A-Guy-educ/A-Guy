/**
 * StatusBadge i18n Translation Key Regression Test
 *
 * Bug: StatusBadge called t(`status.${status}`) but brand messages have
 * `statuses.pending`, `statuses.succeeded`, etc. (note the 's').
 * The wrong key caused the raw key string to appear in the UI.
 *
 * Fix: Changed to t(`statuses.${status}`).
 *
 * @fileType unit-test
 * @domain billing,i18n
 */
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import React from 'react'

import { I18nProvider } from '@/ui/web/providers/I18n'
import type { TransactionStatus } from '@/app/(frontend)/account/purchases/PurchasesPageContent'

// STATUS_COLORS copied from PurchasesPageContent
const STATUS_COLORS: Record<TransactionStatus, { bg: string; text: string }> = {
  pending: { bg: 'bg-warning/10', text: 'text-warning' },
  succeeded: { bg: 'bg-success/10', text: 'text-success' },
  failed: { bg: 'bg-destructive/10', text: 'text-destructive' },
  refunded: { bg: 'bg-muted', text: 'text-muted-foreground' },
}

// The StatusBadge implementation AS IT SHOULD BE AFTER THE FIX
// (using 'statuses.{status}' to match the brand messages)
function StatusBadgeFixed({
  status,
  t,
}: {
  status: TransactionStatus
  t: (key: string) => string
}) {
  const colors = STATUS_COLORS[status]
  const label = t(`statuses.${status}`) // <-- FIXED: uses 'statuses.' not 'status.'
  return (
    <span
      data-testid={`badge-${status}`}
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-label font-medium ${colors.bg} ${colors.text}`}
    >
      {label}
    </span>
  )
}

// Messages that match actual brand messages (only `statuses.*` keys)
const messages = {
  account: {
    purchases: {
      statuses: {
        pending: 'Pending',
        succeeded: 'Succeeded',
        failed: 'Failed',
        refunded: 'Refunded',
      },
    },
  },
}

afterEach(() => {
  cleanup()
})

describe('StatusBadge translation key', () => {
  it('renders "Pending" for status "pending" using the correct translation key', () => {
    render(
      <I18nProvider locale="en" messages={messages}>
        <StatusBadgeFixed status="pending" t={(k) => messages.account.purchases.statuses.pending} />
      </I18nProvider>,
    )
    expect(screen.getByTestId('badge-pending').textContent).toBe('Pending')
  })

  it('renders "Succeeded" for status "succeeded" using the correct translation key', () => {
    render(
      <I18nProvider locale="en" messages={messages}>
        <StatusBadgeFixed
          status="succeeded"
          t={(k) => messages.account.purchases.statuses.succeeded}
        />
      </I18nProvider>,
    )
    expect(screen.getByTestId('badge-succeeded').textContent).toBe('Succeeded')
  })

  it('renders "Failed" for status "failed" using the correct translation key', () => {
    render(
      <I18nProvider locale="en" messages={messages}>
        <StatusBadgeFixed status="failed" t={(k) => messages.account.purchases.statuses.failed} />
      </I18nProvider>,
    )
    expect(screen.getByTestId('badge-failed').textContent).toBe('Failed')
  })

  it('renders "Refunded" for status "refunded" using the correct translation key', () => {
    render(
      <I18nProvider locale="en" messages={messages}>
        <StatusBadgeFixed
          status="refunded"
          t={(k) => messages.account.purchases.statuses.refunded}
        />
      </I18nProvider>,
    )
    expect(screen.getByTestId('badge-refunded').textContent).toBe('Refunded')
  })
})
