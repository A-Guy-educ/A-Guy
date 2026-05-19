/**
 * RevenueWidget — displays total revenue, refunds, failed payments, and success rate.
 *
 * @fileType component
 * @domain admin
 * @ai-summary Revenue metric cards for the admin dashboard
 */

'use client'

import { DollarSign, RefreshCw, XCircle, TrendingUp } from 'lucide-react'
import React from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from '@payloadcms/ui'

import { ACCENT } from '@/ui/admin/ConversionTracking/colors'
import { useMetricsContext } from '@/ui/admin/ConversionTracking/MetricsProvider'
import { getStrings } from '@/ui/admin/ConversionTracking/strings'
import {
  errorStyle,
  loadingStyle,
  revenueCardStyle,
  revenueLabelStyle,
  revenueValueStyle,
  widgetContainerStyle,
  widgetTitleStyle,
} from '@/ui/admin/ConversionTracking/styles'

const revenueGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 16,
}

interface CurrencyRevenue {
  [currencyCode: string]: number
}

function formatCurrency(totalRevenueAgorot: CurrencyRevenue, currency = 'ILS'): string {
  const amount = totalRevenueAgorot[currency] ?? Object.values(totalRevenueAgorot)[0] ?? 0
  const units = amount / 100
  const symbols: Record<string, string> = { ILS: '₪', USD: '$', EUR: '€' }
  const symbol = symbols[currency] || currency
  return `${symbol}${units.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

const RevenueWidget: React.FC = () => {
  const { data, loading, error } = useMetricsContext()
  const { i18n } = useTranslation()
  const s = getStrings(i18n.language)

  if (error === 'admin-only') return null

  if (loading) {
    return (
      <div style={widgetContainerStyle}>
        <h3 style={widgetTitleStyle}>{s.revenueAndTransactions}</h3>
        <div style={loadingStyle}>{s.loading(s.revenueAndTransactions.toLowerCase())}</div>
      </div>
    )
  }

  if (error || !data?.revenueMetrics) {
    return (
      <div style={widgetContainerStyle}>
        <h3 style={widgetTitleStyle}>{s.revenueAndTransactions}</h3>
        <div style={errorStyle}>
          {s.failedToLoad(s.revenueAndTransactions.toLowerCase())}: {error}
        </div>
      </div>
    )
  }

  const { revenueMetrics } = data
  const totalRevenue = revenueMetrics.totalRevenueAgorot

  // If no transactions at all, show empty state
  const hasTransactions = revenueMetrics.transactionCount > 0

  const cards = [
    {
      label: s.totalRevenue,
      value: hasTransactions ? formatCurrency(totalRevenue) : `—`,
      icon: <DollarSign size={18} />,
      color: ACCENT.emerald,
    },
    {
      label: s.refunds,
      value: hasTransactions ? formatCurrency({ ILS: revenueMetrics.refundedAgorot }) : `—`,
      icon: <RefreshCw size={18} />,
      color: ACCENT.amber,
    },
    {
      label: s.failedPayments,
      value: hasTransactions ? formatCurrency({ ILS: revenueMetrics.failedAgorot }) : `—`,
      icon: <XCircle size={18} />,
      color: ACCENT.red,
    },
    {
      label: s.successRate,
      value: hasTransactions ? `${revenueMetrics.successRate.toFixed(1)}%` : `—`,
      icon: <TrendingUp size={18} />,
      color: ACCENT.blue,
    },
  ]

  if (!hasTransactions) {
    return (
      <div style={widgetContainerStyle}>
        <h3 style={widgetTitleStyle}>{s.revenueAndTransactions}</h3>
        <div
          style={{
            padding: 24,
            textAlign: 'center',
            color: 'var(--theme-elevation-500)',
            fontSize: 14,
          }}
        >
          {s.noTransactionsYet}
        </div>
      </div>
    )
  }

  return (
    <div style={widgetContainerStyle}>
      <h3 style={widgetTitleStyle}>{s.revenueAndTransactions}</h3>
      <div style={revenueGridStyle}>
        {cards.map((card) => (
          <div key={card.label} style={revenueCardStyle}>
            <div style={{ color: card.color, marginBottom: 4 }}>{card.icon}</div>
            <div style={revenueLabelStyle}>{card.label}</div>
            <div style={revenueValueStyle}>{card.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default RevenueWidget
