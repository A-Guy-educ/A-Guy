'use client'

import { useTranslation } from '@payloadcms/ui'
import { CreditCard, RefreshCw, XCircle } from 'lucide-react'
import React from 'react'
import type { CSSProperties } from 'react'

import {
  gridStyle,
  metricCardStyle,
  metricLabelStyle,
  metricValueSmallStyle,
  loadingStyle,
} from '../ConversionTracking/styles'

import { usePaymentMetricsContext } from './PaymentMetricsProvider'

const widgetContainerStyle: CSSProperties = {
  marginBottom: 24,
}

const widgetTitleStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 600,
  color: 'var(--theme-elevation-1000)',
  margin: '0 0 16px 0',
}

const PaymentStatsWidget: React.FC = () => {
  const { data, loading, error } = usePaymentMetricsContext()
  const { i18n } = useTranslation()

  if (loading) {
    return <div style={loadingStyle}>{i18n.language === 'he' ? 'טוען...' : 'Loading...'}</div>
  }

  if (error) {
    return null
  }

  if (!data) {
    return null
  }

  const { metrics } = data

  return (
    <div style={widgetContainerStyle}>
      <h3 style={widgetTitleStyle}>
        {i18n.language === 'he' ? 'סטטיסטיקת תשלומים' : 'Payment Statistics'}
      </h3>
      <div style={gridStyle as CSSProperties}>
        <div style={metricCardStyle}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 8,
            }}
          >
            <CreditCard size={18} color="var(--theme-success)" />
            <span style={metricLabelStyle}>{i18n.language === 'he' ? 'הושלמו' : 'Completed'}</span>
          </div>
          <div style={metricValueSmallStyle}>{metrics.transactions.completed.toLocaleString()}</div>
        </div>

        <div style={metricCardStyle}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 8,
            }}
          >
            <RefreshCw size={18} color="var(--theme-warning)" />
            <span style={metricLabelStyle}>{i18n.language === 'he' ? 'מוחזרים' : 'Refunded'}</span>
          </div>
          <div style={metricValueSmallStyle}>{metrics.transactions.refunded.toLocaleString()}</div>
        </div>

        <div style={metricCardStyle}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 8,
            }}
          >
            <XCircle size={18} color="var(--theme-error)" />
            <span style={metricLabelStyle}>{i18n.language === 'he' ? 'נכשלו' : 'Failed'}</span>
          </div>
          <div style={metricValueSmallStyle}>{metrics.transactions.failed.toLocaleString()}</div>
        </div>

        <div style={metricCardStyle}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 8,
            }}
          >
            <CreditCard size={18} color="var(--theme-primary)" />
            <span style={metricLabelStyle}>
              {i18n.language === 'he' ? 'מנויים פעילים' : 'Active Subscriptions'}
            </span>
          </div>
          <div style={metricValueSmallStyle}>{metrics.subscriptions.active.toLocaleString()}</div>
        </div>
      </div>
    </div>
  )
}

export default PaymentStatsWidget
