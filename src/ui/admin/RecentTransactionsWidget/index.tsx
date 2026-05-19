/**
 * RecentTransactionsWidget — displays the 5 most recent transactions with status badges.
 *
 * @fileType component
 * @domain admin
 * @ai-summary Recent transactions list for the admin dashboard
 */

'use client'

import { ExternalLink } from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from '@payloadcms/ui'

import { getStrings } from '@/ui/admin/ConversionTracking/strings'
import {
  errorStyle,
  loadingStyle,
  statusErrorStyle,
  statusSuccessStyle,
  statusWarningStyle,
  transactionRowStyle,
  widgetContainerStyle,
  widgetTitleStyle,
} from '@/ui/admin/ConversionTracking/styles'

type TransactionStatus = 'pending' | 'succeeded' | 'failed' | 'refunded'

interface TransactionUser {
  email?: string
}

interface TransactionProduct {
  name?: string
}

interface Transaction {
  id: string
  createdAt: string
  amount: number
  currency: string
  status: TransactionStatus
  user?: TransactionUser
  product?: TransactionProduct
}

interface TransactionsResponse {
  docs: Transaction[]
}

const panelStyle: CSSProperties = {
  padding: 20,
  backgroundColor: 'var(--theme-elevation-50)',
  border: '1px solid var(--theme-elevation-200)',
  borderRadius: 8,
}

const STATUS_BADGE_STYLE: Record<TransactionStatus, CSSProperties> = {
  succeeded: statusSuccessStyle,
  failed: statusErrorStyle,
  refunded: statusErrorStyle,
  pending: statusWarningStyle,
}

function formatCurrency(amount: number, currency = 'ILS'): string {
  const units = amount / 100
  const symbols: Record<string, string> = { ILS: '₪', USD: '$', EUR: '€' }
  return `${symbols[currency] || currency}${units.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const RecentTransactionsWidget: React.FC = () => {
  const { i18n } = useTranslation()
  const s = getStrings(i18n.language)

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/collections/transactions?limit=5&sort=-createdAt&depth=2', {
        credentials: 'include',
      })
      if (!res.ok) {
        if (res.status === 403) {
          setError('admin-only')
          return
        }
        throw new Error(`HTTP ${res.status}`)
      }
      const json = (await res.json()) as TransactionsResponse
      setTransactions(json.docs ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchTransactions()
  }, [fetchTransactions])

  if (loading) {
    return (
      <div style={widgetContainerStyle}>
        <h3 style={widgetTitleStyle}>{s.recentTransactions}</h3>
        <div style={loadingStyle}>{s.loading(s.recentTransactions.toLowerCase())}</div>
      </div>
    )
  }

  if (error === 'admin-only') return null

  if (error) {
    return (
      <div style={widgetContainerStyle}>
        <h3 style={widgetTitleStyle}>{s.recentTransactions}</h3>
        <div style={errorStyle}>
          {s.failedToLoad(s.recentTransactions.toLowerCase())}: {error}
        </div>
      </div>
    )
  }

  return (
    <div style={widgetContainerStyle}>
      <h3 style={widgetTitleStyle}>{s.recentTransactions}</h3>
      <div style={panelStyle}>
        {transactions.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--theme-elevation-400)' }}>
            {s.noTransactionsYet}
          </div>
        ) : (
          transactions.map((tx) => (
            <div key={tx.id} style={transactionRowStyle}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                <span
                  style={{ fontSize: 13, fontWeight: 500, color: 'var(--theme-elevation-800)' }}
                >
                  {tx.product?.name ?? '—'}
                </span>
                <span style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>
                  {tx.user?.email ?? '—'} · {formatDate(tx.createdAt)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{ fontSize: 13, fontWeight: 700, color: 'var(--theme-elevation-1000)' }}
                >
                  {formatCurrency(tx.amount, tx.currency || 'ILS')}
                </span>
                <span
                  style={{
                    ...STATUS_BADGE_STYLE[tx.status],
                    padding: '2px 8px',
                    borderRadius: 12,
                    fontSize: 11,
                    fontWeight: 600,
                    display: 'inline-block',
                  }}
                >
                  {tx.status}
                </span>
                <a
                  href={`/admin/collections/transactions/${tx.id}`}
                  style={{ color: 'var(--theme-elevation-400)', display: 'flex' }}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink size={13} />
                </a>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default RecentTransactionsWidget
