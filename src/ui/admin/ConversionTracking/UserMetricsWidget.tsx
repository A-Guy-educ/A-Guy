'use client'

import { Activity, Eye, RefreshCw, UserPlus } from 'lucide-react'
import React, { useState } from 'react'
import type { CSSProperties } from 'react'

import { MetricCard } from './MetricCard'
import { useMetricsContext } from './MetricsProvider'
import { errorStyle, loadingStyle, widgetContainerStyle, widgetTitleStyle } from './styles'

type RegFilter = 'yesterday' | 'week' | 'month' | 'total'

const REG_OPTIONS: { value: RegFilter; label: string }[] = [
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'total', label: 'Total' },
]

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

function calcTrend(current: number, previous: number): { value: number; label: string } | null {
  if (previous === 0) return current > 0 ? { value: 100, label: 'vs prior' } : null
  return { value: ((current - previous) / previous) * 100, label: 'vs prior' }
}

const UserMetricsWidget: React.FC = () => {
  const { data, loading, error } = useMetricsContext()
  const [regFilter, setRegFilter] = useState<RegFilter>('month')

  if (error === 'admin-only') return null

  if (loading) {
    return (
      <div style={widgetContainerStyle}>
        <div style={loadingStyle}>Loading user metrics...</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={widgetContainerStyle}>
        <div style={errorStyle}>Failed to load user metrics: {error}</div>
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

  // Registration value + trend based on selected filter
  const regMap: Record<RegFilter, { value: number; trend: ReturnType<typeof calcTrend> }> = {
    yesterday: {
      value: userMetrics.registeredYesterday,
      trend: null,
    },
    week: {
      value: userMetrics.registeredThisWeek,
      trend: calcTrend(userMetrics.registeredThisWeek, userMetrics.registeredLastWeek),
    },
    month: {
      value: userMetrics.registeredThisMonth,
      trend: calcTrend(userMetrics.registeredThisMonth, userMetrics.registeredLastMonth),
    },
    total: {
      value: userMetrics.totalUsers,
      trend: null,
    },
  }

  const regData = regMap[regFilter]

  return (
    <div style={widgetContainerStyle}>
      <h3 style={widgetTitleStyle}>User Statistics</h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 16,
        }}
      >
        <MetricCard
          label="Active users today"
          value={userMetrics.activeUsersToday}
          icon={<Activity size={20} />}
          accentColor="#10b981"
          trend={activeTrend}
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
              background: '#3b82f6',
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
              backgroundColor: 'rgba(59,130,246,0.1)',
              color: '#3b82f6',
            }}
          >
            <UserPlus size={20} />
          </div>
          <div style={pillContainerStyle}>
            {REG_OPTIONS.map((opt) => (
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
            Registered
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
                {regData.trend.value.toFixed(0)}% vs prior
              </span>
            </div>
          )}
        </div>

        <MetricCard
          label="Anonymous visitors"
          value={userMetrics.totalGuestSessions}
          icon={<Eye size={20} />}
          accentColor="#8b5cf6"
          large
        />
        <MetricCard
          label="Guest → Registered"
          value={userMetrics.guestToRegisteredCount}
          icon={<UserPlus size={20} />}
          accentColor="#06b6d4"
          suffix={`(${conversionRate}%)`}
          large
        />
        <MetricCard
          label="Retention rate"
          value={Number(retentionRate)}
          icon={<RefreshCw size={20} />}
          accentColor="#10b981"
          suffix="%"
          large
        />
      </div>
    </div>
  )
}

export default UserMetricsWidget
