'use client'

import { Activity, CalendarDays, Eye, TrendingUp, UserPlus, Users } from 'lucide-react'
import React from 'react'

import { MetricCard } from './MetricCard'
import { errorStyle, loadingStyle, widgetContainerStyle, widgetTitleStyle } from './styles'
import { useMetrics } from './useMetrics'

function calcTrend(current: number, previous: number): { value: number; label: string } | null {
  if (previous === 0) return current > 0 ? { value: 100, label: 'vs prior' } : null
  return { value: ((current - previous) / previous) * 100, label: 'vs prior' }
}

const UserMetricsWidget: React.FC = () => {
  const { data, loading, error } = useMetrics()

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
  const weekTrend = calcTrend(userMetrics.registeredThisWeek, userMetrics.registeredLastWeek)
  const monthTrend = calcTrend(userMetrics.registeredThisMonth, userMetrics.registeredLastMonth)

  const conversionRate =
    userMetrics.totalGuestSessions > 0
      ? ((userMetrics.guestToRegisteredCount / userMetrics.totalGuestSessions) * 100).toFixed(1)
      : '0'

  return (
    <div style={widgetContainerStyle}>
      <h3 style={widgetTitleStyle}>User Statistics</h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <MetricCard
          label="Total registered users"
          value={userMetrics.totalUsers}
          icon={<Users size={20} />}
          accentColor="#6366f1"
          large
        />
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
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <MetricCard
          label="Active users today"
          value={userMetrics.activeUsersToday}
          icon={<Activity size={20} />}
          accentColor="#10b981"
          trend={activeTrend}
          large
        />
        <MetricCard
          label="Registered yesterday"
          value={userMetrics.registeredYesterday}
          icon={<UserPlus size={20} />}
          accentColor="#3b82f6"
          large
        />
        <MetricCard
          label="Registered this week"
          value={userMetrics.registeredThisWeek}
          icon={<CalendarDays size={20} />}
          accentColor="#f59e0b"
          trend={weekTrend}
          large
        />
        <MetricCard
          label="Registered this month"
          value={userMetrics.registeredThisMonth}
          icon={<TrendingUp size={20} />}
          accentColor="#ef4444"
          trend={monthTrend}
          large
        />
      </div>
    </div>
  )
}

export default UserMetricsWidget
