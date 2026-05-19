/**
 * TransactionStatusCell — color-coded status badge for the Transactions list view.
 *
 * @fileType component
 * @domain admin
 * @ai-summary Shows Hebrew label with color badge for transaction status
 */

'use client'

import React from 'react'

type TransactionStatus = 'pending' | 'succeeded' | 'failed' | 'refunded'

const STATUS_CONFIG: Record<
  TransactionStatus,
  { label: string; labelHe: string; classes: string }
> = {
  pending: {
    label: 'Pending',
    labelHe: 'בהמתנה',
    classes:
      'bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))] border border-[hsl(var(--warning)/0.3)]',
  },
  succeeded: {
    label: 'Succeeded',
    labelHe: 'הושלם',
    classes:
      'bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))] border border-[hsl(var(--success)/0.3)]',
  },
  failed: {
    label: 'Failed',
    labelHe: 'נכשל',
    classes:
      'bg-[hsl(var(--error)/0.15)] text-[hsl(var(--error))] border border-[hsl(var(--error)/0.3)]',
  },
  refunded: {
    label: 'Refunded',
    labelHe: 'הוחזר',
    classes:
      'bg-[hsl(var(--muted-foreground)/0.1)] text-[hsl(var(--muted-foreground))] border border-[hsl(var(--muted-foreground)/0.2)]',
  },
}

interface TransactionStatusCellProps {
  cellData?: string
  fieldData?: TransactionStatus
}

export const TransactionStatusCell: React.FC<TransactionStatusCellProps> = ({
  cellData,
  fieldData,
}: TransactionStatusCellProps) => {
  const status = (cellData || fieldData || 'pending') as TransactionStatus
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-label font-semibold ${config.classes}`}
    >
      {config.labelHe}
    </span>
  )
}
