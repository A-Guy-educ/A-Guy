'use client'

import { useTranslation } from '@payloadcms/ui'
import { Activity, Eye, RefreshCw, UserPlus } from 'lucide-react'
import React from 'react'

import { ACCENT } from './colors'
import { MetricCard } from './MetricCard'
import { useMetricsContext } from './MetricsProvider'
import { getStrings } from './strings'
import {
  errorStyle,
  loadingStyle,
  registeredCardContainerStyle,
  registeredCardDetailBoxStyle,
  registeredCardIconStyle,
  registeredCardRowLabelStyle,
  registeredCardRowRightStyle,
  registeredCardRowStyle,
  registeredCardRowValueStyle,
  registeredCardStripStyle,
  registeredCardSubheadingStyle,
  registeredCardTopStyle,
  registeredCardTotalStyle,
  registeredTrendBadgeStyle,
  widgetContainerStyle,
  widgetTitleStyle,
} from './styles'

interface RegisteredUsersCardProps {
  totalUsers: number
  registeredYesterday: number
  registeredThisWeek: number
  registeredLastWeek: number
  registeredThisMonth: number
  registeredLastMonth: number
  s: ReturnType<typeof getStrings>
}

function calcTrend(
  current: number,
  previous: number,
): { value: number; isPositive: boolean } | null {
  if (previous === 0) return current > 0 ? { value: 100, isPositive: true } : null
  const value = ((current - previous) / previous) * 100
  return { value, isPositive: value >= 0 }
}

const RegisteredUsersCard: React.FC<RegisteredUsersCardProps> = ({
  totalUsers,
  registeredYesterday,
  registeredThisWeek,
  registeredLastWeek,
  registeredThisMonth,
  registeredLastMonth,
  s,
}) => {
  const weekTrend = calcTrend(registeredThisWeek, registeredLastWeek)
  const monthTrend = calcTrend(registeredThisMonth, registeredLastMonth)

  const rows: Array<{
    label: string
    value: number
    trend: { value: number; isPositive: boolean } | null
  }> = [
    { label: s.registrationYesterday, value: registeredYesterday, trend: null },
    { label: s.registeredLastWeek, value: registeredThisWeek, trend: weekTrend },
    { label: s.registeredLastMonth, value: registeredThisMonth, trend: monthTrend },
  ]

  return (
    <div style={registeredCardContainerStyle}>
      {/* Top decorative strip */}
      <div style={registeredCardStripStyle} />

      {/* Central data area */}
      <div style={registeredCardTopStyle}>
        {/* Icon container */}
        <div style={registeredCardIconStyle}>
          <UserPlus size={22} />
        </div>

        {/* Large total number */}
        <div style={registeredCardTotalStyle}>{totalUsers.toLocaleString()}</div>

        {/* Subheading */}
        <div style={registeredCardSubheadingStyle}>{s.registered}</div>
      </div>

      {/* Detail area with breakdown */}
      <div style={registeredCardDetailBoxStyle}>
        {rows.map((row, idx) => (
          <div
            key={row.label}
            style={{
              ...registeredCardRowStyle,
              borderBottom: idx < rows.length - 1 ? '1px solid var(--theme-elevation-200)' : 'none',
            }}
          >
            {/* Time description */}
            <span style={registeredCardRowLabelStyle}>{row.label}</span>

            {/* Number + trend badge */}
            <div style={registeredCardRowRightStyle}>
              <span style={registeredCardRowValueStyle}>{row.value.toLocaleString()}</span>
              {row.trend && isFinite(row.trend.value) && (
                <div style={registeredTrendBadgeStyle(row.trend.isPositive)}>
                  <span>{row.trend.isPositive ? '▲' : '▼'}</span>
                  <span>
                    {row.trend.isPositive ? '+' : ''}
                    {row.trend.value.toFixed(0)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const UserMetricsWidget: React.FC = () => {
  const { data, loading, error, period } = useMetricsContext()
  const { i18n } = useTranslation()
  const s = getStrings(i18n.language)

  function calcActiveTrend(
    current: number,
    previous: number,
  ): { value: number; label: string } | null {
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
  const activeTrend = calcActiveTrend(
    userMetrics.activeUsersToday,
    userMetrics.activeUsersYesterday,
  )

  const conversionRate =
    userMetrics.totalGuestSessions > 0
      ? ((userMetrics.guestToRegisteredCount / userMetrics.totalGuestSessions) * 100).toFixed(1)
      : '0'

  const retentionRate =
    userMetrics.returningUsersTotal > 0
      ? ((userMetrics.returningUsers / userMetrics.returningUsersTotal) * 100).toFixed(1)
      : '0'

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

        <RegisteredUsersCard
          totalUsers={userMetrics.totalUsers}
          registeredYesterday={userMetrics.registeredYesterday}
          registeredThisWeek={userMetrics.registeredThisWeek}
          registeredLastWeek={userMetrics.registeredLastWeek}
          registeredThisMonth={userMetrics.registeredThisMonth}
          registeredLastMonth={userMetrics.registeredLastMonth}
          s={s}
        />

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
