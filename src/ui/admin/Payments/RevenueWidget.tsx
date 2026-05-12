'use client'

import { useTranslation } from '@payloadcms/ui'
import { Currency } from 'lucide-react'
import React from 'react'
import type { CSSProperties } from 'react'

import { metricCardLargeStyle, metricLabelStyle, loadingStyle } from '../ConversionTracking/styles'

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

const revenueValueStyle: CSSProperties = {
  fontSize: 36,
  fontWeight: 700,
  color: 'var(--theme-elevation-1000)',
  lineHeight: 1.2,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

const revenueCurrencyStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 500,
  opacity: 0.7,
}

const RevenueWidget: React.FC = () => {
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
  const revenueAmount = metrics.revenue.total.toLocaleString()

  return (
    <div style={widgetContainerStyle}>
      <h3 style={widgetTitleStyle}>{i18n.language === 'he' ? 'הכנסות' : 'Revenue'}</h3>
      <div style={metricCardLargeStyle}>
        <span style={metricLabelStyle}>
          {i18n.language === 'he' ? 'סה״כ הכנסות' : 'Total Revenue'}
        </span>
        <div style={revenueValueStyle}>
          <Currency size={28} color="var(--theme-success)" />
          <span>{revenueAmount}</span>
          <span style={revenueCurrencyStyle}>{metrics.revenue.currency}</span>
        </div>
      </div>
    </div>
  )
}

export default RevenueWidget
