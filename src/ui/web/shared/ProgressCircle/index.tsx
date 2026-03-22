'use client'

import type { ReactNode } from 'react'

interface ProgressCircleProps {
  percentage: number
  size?: number
  strokeWidth?: number
  strokeColor?: string
  className?: string
  children?: ReactNode
}

export function ProgressCircle({
  percentage,
  size = 60,
  strokeWidth = 4,
  strokeColor,
  className = '',
  children,
}: ProgressCircleProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percentage / 100) * circumference

  const resolvedColor =
    strokeColor ?? (percentage >= 100 ? 'hsl(var(--success))' : 'hsl(var(--primary))')

  return (
    <svg width={size} height={size} className={className}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={resolvedColor}
        strokeOpacity={0.2}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={resolvedColor}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-500 ease-out"
        style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
      />
      {children ??
        (percentage > 0 ? (
          <text
            x="50%"
            y="50%"
            textAnchor="middle"
            dy=".3em"
            className="text-sm font-semibold fill-foreground"
          >
            {Math.round(percentage)}%
          </text>
        ) : null)}
    </svg>
  )
}
