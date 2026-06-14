/**
 * NeedsAttentionWidget — displays payment issues requiring admin attention.
 *
 * Shows 4 metric cards:
 * - Stuck grants: succeeded transactions without entitlements granted
 * - Stuck receipts: succeeded transactions without email sent (5-min grace window)
 * - Partial refunds: succeeded transactions with refundedAmount > 0
 * - Stuck webhooks: unprocessed webhook events older than 15 minutes
 *
 * When all counts are 0, shows a quiet "all clear" state.
 * When any count > 0, that card highlights in warning color.
 *
 * @fileType component
 * @domain admin
 * @ai-summary Payment attention metrics for the admin dashboard
 */

'use client'

import { AlertTriangle, CheckCircle2, Mail, Webhook } from 'lucide-react'
import React from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from '@payloadcms/ui'

import { useMetricsContext } from './MetricsProvider'
import { getStrings } from './strings'
import { loadingStyle, widgetContainerStyle, widgetTitleStyle } from './styles'

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 12,
}

const cardStyle: CSSProperties = {
  padding: '16px 18px',
  backgroundColor: 'var(--theme-elevation-50)',
  border: '1px solid var(--theme-elevation-200)',
  borderRadius: 8,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  textDecoration: 'none',
  color: 'inherit',
  transition: 'all 0.15s',
  cursor: 'pointer',
}

const warningCardStyle: CSSProperties = {
  ...cardStyle,
  backgroundColor: 'var(--theme-warning-100)',
  borderColor: 'var(--theme-warning)',
}

const cardLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--theme-elevation-500)',
  marginBottom: 2,
}

const warningCardLabelStyle: CSSProperties = {
  ...cardLabelStyle,
  color: 'var(--theme-warning)',
}

const cardValueStyle: CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  color: 'var(--theme-elevation-1000)',
  lineHeight: 1.2,
}

const warningCardValueStyle: CSSProperties = {
  ...cardValueStyle,
  color: 'var(--theme-warning)',
}

const cardRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
}

const iconStyle: CSSProperties = {
  flexShrink: 0,
}

const allClearStyle: CSSProperties = {
  padding: '24px',
  backgroundColor: 'var(--theme-success-100)',
  borderRadius: 8,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  color: 'var(--theme-success)',
  fontSize: 14,
  fontWeight: 500,
}

interface AttentionCardProps {
  label: string
  count: number
  href: string
  icon: React.ReactNode
  iconColor: string
}

function AttentionCard({ label, count, href, icon, iconColor }: AttentionCardProps) {
  const hasIssue = count > 0
  return (
    <a href={href} style={hasIssue ? warningCardStyle : cardStyle}>
      <div style={cardRowStyle}>
        <span style={{ ...iconStyle, color: iconColor }}>{icon}</span>
        <span style={hasIssue ? warningCardLabelStyle : cardLabelStyle}>{label}</span>
      </div>
      <span style={hasIssue ? warningCardValueStyle : cardValueStyle}>
        {count.toLocaleString()}
      </span>
    </a>
  )
}

const NeedsAttentionWidget: React.FC = () => {
  const { data, loading, error } = useMetricsContext()
  const { i18n } = useTranslation()
  const s = getStrings(i18n.language)

  if (error === 'admin-only') return null

  if (loading) {
    return (
      <div style={widgetContainerStyle}>
        <h3 style={widgetTitleStyle}>{s.needsAttention}</h3>
        <div style={loadingStyle}>{s.loading(s.needsAttention.toLowerCase())}</div>
      </div>
    )
  }

  if (error || !data?.paymentAttentionMetrics) {
    return (
      <div style={widgetContainerStyle}>
        <h3 style={widgetTitleStyle}>{s.needsAttention}</h3>
        <div style={loadingStyle}>
          {s.failedToLoad(s.needsAttention.toLowerCase())}: {error}
        </div>
      </div>
    )
  }

  const { stuckGrants, stuckReceipts, partialRefunds, stuckWebhooks } = data.paymentAttentionMetrics
  const totalIssues = stuckGrants + stuckReceipts + partialRefunds + stuckWebhooks

  // All clear state — quiet success indicator when everything is fine
  if (totalIssues === 0) {
    return (
      <div style={widgetContainerStyle}>
        <h3 style={widgetTitleStyle}>{s.needsAttention}</h3>
        <div style={allClearStyle}>
          <CheckCircle2 size={16} />
          {s.allClear}
        </div>
      </div>
    )
  }

  const now = new Date()
  const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString()
  const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000).toISOString()

  return (
    <div style={widgetContainerStyle}>
      <h3 style={widgetTitleStyle}>{s.needsAttention}</h3>
      <div style={gridStyle}>
        <AttentionCard
          label={s.stuckGrants}
          count={stuckGrants}
          href={`/admin/collections/transactions?where[status][equals]=succeeded&where[entitlementsGrantedAt][exists]=false`}
          icon={<AlertTriangle size={16} />}
          iconColor="var(--theme-warning)"
        />
        <AttentionCard
          label={s.stuckReceipts}
          count={stuckReceipts}
          href={`/admin/collections/transactions?where[status][equals]=succeeded&where[emailSentAt][exists]=false&where[createdAt][less_than]=${fiveMinAgo}`}
          icon={<Mail size={16} />}
          iconColor="var(--theme-warning)"
        />
        <AttentionCard
          label={s.partialRefunds}
          count={partialRefunds}
          href={`/admin/collections/transactions?where[status][equals]=succeeded&where[refundedAmount][greater_than]=0`}
          icon={<AlertTriangle size={16} />}
          iconColor="var(--theme-warning)"
        />
        <AttentionCard
          label={s.stuckWebhooks}
          count={stuckWebhooks}
          href={`/admin/collections/webhook-events?where[processed][equals]=false&where[receivedAt][less_than]=${fifteenMinAgo}`}
          icon={<Webhook size={16} />}
          iconColor="var(--theme-warning)"
        />
      </div>
    </div>
  )
}

export default NeedsAttentionWidget
