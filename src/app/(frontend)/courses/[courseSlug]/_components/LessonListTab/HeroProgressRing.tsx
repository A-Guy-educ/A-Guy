'use client'

interface HeroProgressRingProps {
  percent: number
  size?: number
  strokeWidth?: number
}

/**
 * Circular progress ring used in the lessons hero card.
 *
 * All colors come from the design-system CSS variables
 * (`--primary`, `--success`) so the ring adapts to light/dark themes.
 */
export function HeroProgressRing({ percent, size = 64, strokeWidth = 4 }: HeroProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, percent))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clamped / 100) * circumference
  const stroke = clamped >= 100 ? 'hsl(var(--success))' : 'hsl(var(--primary))'

  return (
    <div
      className="relative shrink-0 rounded-full border border-border/60 bg-background/40"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={stroke}
          strokeOpacity={0.2}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={stroke}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 500ms ease' }}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-body-xs font-bold font-mono text-foreground"
        aria-label={`${Math.round(clamped)}%`}
      >
        {Math.round(clamped)}%
      </span>
    </div>
  )
}
