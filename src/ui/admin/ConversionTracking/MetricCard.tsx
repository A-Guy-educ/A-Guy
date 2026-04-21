'use client'

import { Info } from 'lucide-react'
import React, { useState } from 'react'

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
  hint?: string
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
  hint,
}) => {
  const [showHint, setShowHint] = useState(false)
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

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        <span style={{ ...metricLabelStyle, marginBottom: 0 }}>{label}</span>
        {hint && (
          <div
            style={{ position: 'relative', display: 'inline-flex', cursor: 'help' }}
            onMouseEnter={() => setShowHint(true)}
            onMouseLeave={() => setShowHint(false)}
          >
            <Info size={13} color="var(--theme-elevation-400)" style={{ flexShrink: 0 }} />
            {showHint && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 'calc(100% + 6px)',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  backgroundColor: 'var(--theme-elevation-1000)',
                  color: 'var(--theme-elevation-0)',
                  padding: '8px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  lineHeight: 1.4,
                  width: 220,
                  zIndex: 1000,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  pointerEvents: 'none',
                }}
              >
                {hint}
              </div>
            )}
          </div>
        )}
      </div>
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
