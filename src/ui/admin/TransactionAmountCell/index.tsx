/**
 * TransactionAmountCell — formats transaction amount from agorot to currency display.
 *
 * @fileType component
 * @domain admin
 * @ai-summary Displays formatted currency amount in the Transactions list view
 */

'use client'

import React from 'react'

const CURRENCY_SYMBOLS: Record<string, string> = {
  ILS: '₪',
  USD: '$',
  EUR: '€',
}

function formatAmount(amountAgorot: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] || currency
  if (currency === 'ILS') {
    const shekels = amountAgorot / 100
    return `${symbol}${shekels.toFixed(2)}`
  }
  return `${amountAgorot} ${currency}`
}

interface TransactionAmountCellProps {
  cellData?: number
  fieldData?: { amount: number; currency: string }
}

export const TransactionAmountCell: React.FC<TransactionAmountCellProps> = ({
  cellData,
  fieldData,
}: TransactionAmountCellProps) => {
  const amount = cellData ?? fieldData?.amount ?? 0
  const currency = fieldData?.currency ?? 'ILS'

  return (
    <span className="text-label font-semibold text-foreground">
      {formatAmount(amount, currency)}
    </span>
  )
}
