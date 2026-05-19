/**
 * TopProductsWidget — displays top 5 products by revenue as a ranked list with progress bars.
 *
 * @fileType component
 * @domain admin
 * @ai-summary Top products ranked by revenue for the admin dashboard
 */

'use client'

import React from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from '@payloadcms/ui'

import { CHART_PALETTE } from '@/ui/admin/ConversionTracking/colors'
import { useMetricsContext } from '@/ui/admin/ConversionTracking/MetricsProvider'
import { getStrings } from '@/ui/admin/ConversionTracking/strings'
import {
  errorStyle,
  loadingStyle,
  widgetContainerStyle,
  widgetTitleStyle,
} from '@/ui/admin/ConversionTracking/styles'

const panelStyle: CSSProperties = {
  padding: 20,
  backgroundColor: 'var(--theme-elevation-50)',
  border: '1px solid var(--theme-elevation-200)',
  borderRadius: 8,
}

const enrollmentRowStyle: CSSProperties = {
  padding: '10px 0',
  borderBottom: '1px solid var(--theme-elevation-100)',
}

const enrollmentLabelStyle: CSSProperties = {
  fontSize: 13,
  color: 'var(--theme-elevation-800)',
  marginBottom: 4,
  display: 'flex',
  justifyContent: 'space-between',
}

const barContainerStyle: CSSProperties = {
  height: 6,
  backgroundColor: 'var(--theme-elevation-100)',
  borderRadius: 3,
  overflow: 'hidden',
}

function formatRevenue(agorot: number, currency = 'ILS'): string {
  const units = agorot / 100
  const symbols: Record<string, string> = { ILS: '₪', USD: '$', EUR: '€' }
  return `${symbols[currency] || currency}${units.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`
}

const TopProductsWidget: React.FC = () => {
  const { data, loading, error } = useMetricsContext()
  const { i18n } = useTranslation()
  const s = getStrings(i18n.language)

  if (error === 'admin-only') return null

  if (loading) {
    return (
      <div style={widgetContainerStyle}>
        <h3 style={widgetTitleStyle}>{s.topProducts}</h3>
        <div style={loadingStyle}>{s.loading(s.topProducts.toLowerCase())}</div>
      </div>
    )
  }

  if (error || !data?.revenueMetrics) {
    return (
      <div style={widgetContainerStyle}>
        <h3 style={widgetTitleStyle}>{s.topProducts}</h3>
        <div style={errorStyle}>
          {s.failedToLoad(s.topProducts.toLowerCase())}: {error}
        </div>
      </div>
    )
  }

  const { topProducts } = data.revenueMetrics

  return (
    <div style={widgetContainerStyle}>
      <h3 style={widgetTitleStyle}>{s.topProducts}</h3>
      <div style={panelStyle}>
        {topProducts.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--theme-elevation-400)' }}>
            {s.noTransactionsYet}
          </div>
        ) : (
          topProducts.slice(0, 5).map((product, i) => {
            const maxAgorot = topProducts[0]?.agorot || 1
            const pct = (product.agorot / maxAgorot) * 100
            const color = CHART_PALETTE[i % CHART_PALETTE.length]
            const displayName = product.productName.startsWith('__DELETED__:')
              ? `${s.deletedCourse} (${product.productName.slice(12)})`
              : product.productName

            return (
              <div key={product.productName} style={enrollmentRowStyle}>
                <div style={enrollmentLabelStyle}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: 13,
                        color: 'var(--theme-elevation-600)',
                        width: 18,
                      }}
                    >
                      {i + 1}.
                    </span>
                    <span style={{ fontWeight: 500 }}>{displayName}</span>
                  </span>
                  <span style={{ fontWeight: 700, color: 'var(--theme-elevation-1000)' }}>
                    {formatRevenue(product.agorot)}
                  </span>
                </div>
                <div style={barContainerStyle}>
                  <div
                    style={{
                      height: '100%',
                      width: `${pct}%`,
                      backgroundColor: color,
                      borderRadius: 3,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default TopProductsWidget
