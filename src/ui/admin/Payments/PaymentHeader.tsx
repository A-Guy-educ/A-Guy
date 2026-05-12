'use client'

import { useTranslation } from '@payloadcms/ui'
import React from 'react'
import type { CSSProperties } from 'react'

import type { PaymentPeriod } from '@/app/api/admin/payments/dashboard-metrics/route'

import { usePaymentMetricsContext } from './PaymentMetricsProvider'

const headerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 20,
}

const titleStyle: CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  color: 'var(--theme-elevation-1000)',
  margin: 0,
}

const filterContainerStyle: CSSProperties = {
  display: 'flex',
  gap: 4,
  backgroundColor: 'var(--theme-elevation-100)',
  borderRadius: 8,
  padding: 3,
}

const filterBtnBase: CSSProperties = {
  padding: '6px 14px',
  fontSize: 13,
  fontWeight: 500,
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  transition: 'all 0.15s',
}

const PaymentHeader: React.FC = () => {
  const { period, setPeriod, error } = usePaymentMetricsContext()
  const { i18n } = useTranslation()

  const periods: { value: PaymentPeriod; label: string }[] = [
    { value: 'week', label: i18n.language === 'he' ? 'שבוע' : 'Week' },
    { value: 'month', label: i18n.language === 'he' ? 'חודש' : 'Month' },
    { value: 'year', label: i18n.language === 'he' ? 'שנה' : 'Year' },
  ]

  if (error === 'admin-only') return null

  return (
    <div style={headerStyle}>
      <h2 style={titleStyle}>{i18n.language === 'he' ? 'תשלומים' : 'Payments'}</h2>
      <div style={filterContainerStyle}>
        {periods.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            style={{
              ...filterBtnBase,
              backgroundColor: period === p.value ? 'var(--theme-elevation-0)' : 'transparent',
              color:
                period === p.value ? 'var(--theme-elevation-1000)' : 'var(--theme-elevation-500)',
              boxShadow: period === p.value ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default PaymentHeader
