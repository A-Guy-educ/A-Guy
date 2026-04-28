'use client'

import { useTranslation } from '@payloadcms/ui'
import Link from 'next/link'
import React from 'react'
import type { CSSProperties } from 'react'

import type { Period } from '@/app/api/admin/dashboard-metrics/route'

import { useMetricsContext } from './MetricsProvider'
import { getStrings } from './strings'

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

const DashboardHeader: React.FC = () => {
  const { period, setPeriod, error } = useMetricsContext()
  const { i18n, t } = useTranslation()
  const s = getStrings(i18n.language)

  const periods: { value: Period; label: string }[] = [
    { value: 'week', label: s.period.week },
    { value: 'month', label: s.period.month },
    { value: 'year', label: s.period.year },
  ]

  if (error === 'admin-only') return null

  return (
    <div style={headerStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h2 style={titleStyle}>{s.dashboard}</h2>
        <Link
          href="/admin/chat"
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--theme-elevation-600)',
            textDecoration: 'none',
          }}
        >
          {/* Custom translation key - type assertion needed for custom i18n keys */}
          {(t as (key: string) => string)('admin:chatLink')}
        </Link>
      </div>
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

export default DashboardHeader
