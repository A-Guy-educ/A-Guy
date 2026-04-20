'use client'

import React from 'react'

import {
  accentBarStyle,
  iconContainerStyle,
  metricCardLargeStyle,
  metricCardStyle,
  metricLabelStyle,
  metricValueSmallStyle,
  metricValueStyle,
  trendBadgeStyle,
} from './styles'

interface MetricCardProps {
  label: string
  value: number
  icon?: React.ReactNode
  iconColor?: string
  accentColor?: string
  trend?: { value: number; label: string } | null
  large?: boolean
  suffix?: string
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  icon,
  iconColor,
  accentColor,
  trend,
  large = false,
  suffix,
}) => {
  const isPositive = trend ? trend.value >= 0 : true
  const trendText = trend
    ? `${isPositive ? '+' : ''}${isFinite(trend.value) ? trend.value.toFixed(0) : '—'}% ${trend.label}`
    : null

  return (
    <div style={large ? metricCardLargeStyle : metricCardStyle}>
      {accentColor && <div style={accentBarStyle(accentColor)} />}

      {icon && (
        <div
          style={{
            ...iconContainerStyle,
            backgroundColor: iconColor ? `${iconColor}18` : 'var(--theme-elevation-100)',
            color: iconColor || 'var(--theme-elevation-700)',
          }}
        >
          {icon}
        </div>
      )}

      <span style={metricLabelStyle}>{label}</span>
      <div style={large ? metricValueStyle : metricValueSmallStyle}>
        {value.toLocaleString()}
        {suffix && (
          <span style={{ fontSize: '0.5em', fontWeight: 400, marginLeft: 6, opacity: 0.7 }}>
            {suffix}
          </span>
        )}
      </div>

      {trend && isFinite(trend.value) && (
        <div style={trendBadgeStyle(isPositive)}>
          <span>{isPositive ? '▲' : '▼'}</span>
          <span>{trendText}</span>
        </div>
      )}
    </div>
  )
}
