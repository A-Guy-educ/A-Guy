'use client'

import { useTranslation } from '@payloadcms/ui'
import { Activity, Eye, RefreshCw, UserPlus } from 'lucide-react'
import React, { useState } from 'react'
import type { CSSProperties } from 'react'

import { ACCENT, tint } from './colors'
import { MetricCard } from './MetricCard'
import { useMetricsContext } from './MetricsProvider'
import { getStrings } from './strings'
import { errorStyle, loadingStyle, widgetContainerStyle, widgetTitleStyle } from './styles'

type RegFilter = 'yesterday' | 'week' | 'month' | 'total'

const pillContainerStyle: CSSProperties = {
  display: 'flex',
  gap: 3,
  backgroundColor: 'var(--theme-elevation-100)',
  borderRadius: 6,
  padding: 2,
}

const pillBtnStyle: CSSProperties = {
  padding: '4px 10px',
  fontSize: 11,
  fontWeight: 500,
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
}

const UserMetricsWidget: React.FC = () => {
  const { data, loading, error, period } = useMetricsContext()
  const { i18n } = useTranslation()
  const s = getStrings(i18n.language)
  const [regFilter, setRegFilter] = useState<RegFilter>('month')

  function calcTrend(current: number, previous: number): { value: number; label: string } | null {
    if (previous === 0) return current > 0 ? { value: 100, label: s.vsPrior } : null
    return { value: ((current - previous) / previous) * 100, label: s.vsPrior }
  }

  const periodLabel =
    period === 'week'
      ? s.periodLabelWeek
      : period === 'year'
        ? s.periodLabelYear
        : s.periodLabelMonth

  if (error === 'admin-only') return null

  if (loading) {
    return (
      <div style={widgetContainerStyle}>
        <div style={loadingStyle}>{s.loading(s.userStatistics.toLowerCase())}</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={widgetContainerStyle}>
        <div style={errorStyle}>
          {s.failedToLoad(s.userStatistics.toLowerCase())}: {error}
        </div>
      </div>
    )
  }

  const { userMetrics } = data
  const activeTrend = calcTrend(userMetrics.activeUsersToday, userMetrics.activeUsersYesterday)

  const conversionRate =
    userMetrics.totalGuestSessions > 0
      ? ((userMetrics.guestToRegisteredCount / userMetrics.totalGuestSessions) * 100).toFixed(1)
      : '0'

  const retentionRate =
    userMetrics.returningUsersTotal > 0
      ? ((userMetrics.returningUsers / userMetrics.returningUsersTotal) * 100).toFixed(1)
      : '0'

  const regOptions: { value: RegFilter; label: string }[] = [
    { value: 'yesterday', label: s.registrationYesterday },
    { value: 'week', label: s.registrationWeek },
    { value: 'month', label: s.registrationMonth },
    { value: 'total', label: s.registrationTotal },
  ]

  const regMap: Record<RegFilter, { value: number; trend: ReturnType<typeof calcTrend> }> = {
    yesterday: { value: userMetrics.registeredYesterday, trend: null },
    week: {
      value: userMetrics.registeredThisWeek,
      trend: calcTrend(userMetrics.registeredThisWeek, userMetrics.registeredLastWeek),
    },
    month: {
      value: userMetrics.registeredThisMonth,
      trend: calcTrend(userMetrics.registeredThisMonth, userMetrics.registeredLastMonth),
    },
    total: { value: userMetrics.totalUsers, trend: null },
  }

  const regData = regMap[regFilter]

  return (
    <div style={widgetContainerStyle}>
      <h3 style={widgetTitleStyle}>{s.userStatistics}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
        <MetricCard
          label={s.activeUsersToday}
          value={userMetrics.activeUsersToday}
          icon={<Activity size={20} />}
          accentColor={ACCENT.emerald}
          trend={activeTrend}
          hint={s.activeUsersHint}
          large
        />

        {/* Registration card with inline filter */}
        <div
          style={{
            padding: 24,
            backgroundColor: 'var(--theme-elevation-50)',
            border: '1px solid var(--theme-elevation-200)',
            borderRadius: 8,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 3,
              background: ACCENT.blue,
            }}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 40,
              height: 40,
              borderRadius: 8,
              marginBottom: 12,
              backgroundColor: tint(ACCENT.blue),
              color: ACCENT.blue,
            }}
          >
            <UserPlus size={20} />
          </div>
          <div style={pillContainerStyle}>
            {regOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRegFilter(opt.value)}
                style={{
                  ...pillBtnStyle,
                  backgroundColor:
                    regFilter === opt.value ? 'var(--theme-elevation-0)' : 'transparent',
                  color:
                    regFilter === opt.value
                      ? 'var(--theme-elevation-1000)'
                      : 'var(--theme-elevation-500)',
                  boxShadow: regFilter === opt.value ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 700,
              color: 'var(--theme-elevation-1000)',
              lineHeight: 1.2,
              marginTop: 8,
            }}
          >
            {regData.value.toLocaleString()}
          </div>
          <span
            style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--theme-elevation-500)',
              marginTop: 4,
            }}
          >
            {s.registered}
          </span>
          {regData.trend && isFinite(regData.trend.value) && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                marginTop: 6,
                padding: '2px 8px',
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 600,
                backgroundColor:
                  regData.trend.value >= 0 ? 'var(--theme-success-100)' : 'var(--theme-error-100)',
                color: regData.trend.value >= 0 ? 'var(--theme-success)' : 'var(--theme-error)',
              }}
            >
              <span>{regData.trend.value >= 0 ? '▲' : '▼'}</span>
              <span>
                {regData.trend.value >= 0 ? '+' : ''}
                {regData.trend.value.toFixed(0)}% {s.vsPrior}
              </span>
            </div>
          )}
        </div>

        <MetricCard
          label={s.anonymousVisitors}
          value={userMetrics.totalGuestSessions}
          icon={<Eye size={20} />}
          accentColor={ACCENT.violet}
          hint={s.anonymousVisitorsHint}
          large
        />
        <MetricCard
          label={s.guestToRegistered}
          value={userMetrics.guestToRegisteredCount}
          icon={<UserPlus size={20} />}
          accentColor={ACCENT.cyan}
          suffix={`(${conversionRate}%)`}
          hint={s.guestToRegisteredHint}
          large
        />
        <MetricCard
          label={s.retentionRate}
          value={Number(retentionRate)}
          icon={<RefreshCw size={20} />}
          accentColor={ACCENT.emerald}
          suffix="%"
          hint={s.retentionRateHint(periodLabel)}
          large
        />
      </div>
    </div>
  )
}

export default UserMetricsWidget
