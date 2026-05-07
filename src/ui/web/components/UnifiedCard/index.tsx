'use client'

import { loadingManager } from '@/infra/loading/LoadingManager'
import { LOADING_KEYS } from '@/infra/loading/keys'
import { cn } from '@/infra/utils/ui'
import { ContentStatusBadge } from '@/ui/web/shared/ContentStatusBadge'
import { ProgressCircle } from '@/ui/web/shared/ProgressCircle'
import { CheckCircle } from 'lucide-react'
import type { ReactNode } from 'react'

export interface UnifiedCardProps {
  /** Main title */
  title: string
  /** Muted description text */
  description?: string | ReactNode
  /** Grade/label badge text (e.g. "Grade 8") */
  label?: string | null
  /** Badge text shown top-right */
  badge?: string
  /** Course lesson card variant — accent bar on top instead of left */
  variant?: 'default' | 'lesson'
  /** Accent color for bar and progress ring — defaults to primary */
  accentColor?: string
  /** Shows "Your Course" pill badge top-left */
  isOwned?: boolean
  /** Content lock status — maps to ContentStatusBadge values */
  contentStatus?: 'none' | 'soon' | 'justAdded' | 'custom' | null
  contentStatusExpiresAt?: string
  contentStatusLabel?: string
  /** Progress percentage 0–100 — shows circle ring */
  progress?: number
  /** Label shown inside progress circle (e.g. "1 / 3") */
  progressLabel?: string
  /** Optional subtitle text shown below the title (e.g. progress status) */
  subtitle?: ReactNode
  /** CTA button label — if omitted, card links via buttonHref */
  buttonLabel?: string | ReactNode
  /** Makes entire card a link to this URL */
  buttonHref?: string
  /** Fires on button click. Return false to prevent navigation when buttonHref is set */
  onButtonClick?: () => boolean | void
  /** Additional className on inner button */
  buttonClassName?: string
  /** Extra content rendered before the divider */
  children?: ReactNode
  className?: string
  /** Makes the entire card a link to this URL */
  cardHref?: string
  /** Fires on card click when cardHref is set */
  cardOnClick?: (e: React.MouseEvent) => void
  /** Additional className for the label badge (e.g. 'text-[11.5px]' for 15% larger exam label) */
  labelBadgeClassName?: string
}

export function UnifiedCard({
  title,
  description,
  label,
  badge,
  variant = 'default',
  accentColor,
  isOwned,
  contentStatus,
  contentStatusExpiresAt,
  contentStatusLabel,
  progress,
  progressLabel,
  subtitle,
  buttonLabel,
  buttonHref,
  onButtonClick,
  buttonClassName,
  children,
  className,
  cardHref,
  cardOnClick,
  labelBadgeClassName,
}: UnifiedCardProps) {
  const isSoon = contentStatus === 'soon'
  const color = accentColor ?? 'hsl(var(--primary))'
  const showProgress = progress !== undefined
  const showDivider = buttonLabel || buttonHref || children

  // Build a valid hsla() string for the gradient overlay
  const gradientColor = (() => {
    // CSS var: "hsl(var(--tab-learn))" → "hsl(var(--tab-learn) / 0.6)"
    const varMatch = color.match(/^hsl\(var\((--[^)]+)\)\)$/)
    if (varMatch) return `hsl(var(${varMatch[1]}) / 0.6)`
    // Plain hsl: "hsl(217 91% 60%)" → "hsl(217 91% 60% / 0.6)"
    const hslMatch = color.match(/^hsl\(([^)]+)\)$/)
    if (hslMatch) return `hsl(${hslMatch[1]} / 0.6)`
    return color
  })()

  const cardClasses = cn(
    'group relative rounded-2xl border border-border/60 bg-card shadow-card overflow-hidden',
    'transition-all duration-normal will-change-transform',
    !isSoon && !cardHref && 'hover:border-border/80 hover:shadow-card-hover active:scale-[0.98]',
    isSoon && 'opacity-60',
    className,
  )

  const cardContent = (
    <>
      {/* Subtle gradient overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          background: `linear-gradient(135deg, ${gradientColor} 0%, transparent 50%)`,
        }}
      />

      <div className="p-card-padding flex flex-col gap-content-gap">
        {/* Top row: status badges */}
        <div className="flex items-start justify-between gap-content-gap-xs">
          <div className="flex items-center gap-content-gap-xs flex-wrap">
            {isOwned && (
              <span className="inline-flex items-center gap-1 bg-success/10 text-success border border-success/20 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full">
                <CheckCircle className="w-3 h-3" />
                Your Course
              </span>
            )}
            {label && (
              <span
                className={cn(
                  'text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-2.5 py-1 rounded-full',
                  labelBadgeClassName,
                )}
              >
                {label}
              </span>
            )}
          </div>

          {(contentStatus || badge) && (
            <ContentStatusBadge
              contentStatus={contentStatus}
              contentStatusExpiresAt={contentStatusExpiresAt}
              contentStatusLabel={contentStatusLabel}
              className="shrink-0"
            />
          )}
        </div>

        {/* Title + description + subtitle */}
        <div className="flex items-start gap-content-gap">
          <div className="flex-1 min-w-0">
            <h3 className="text-heading-md font-bold text-card-foreground leading-snug mb-1">
              {title}
            </h3>
            {description && (
              <p className="text-body-sm text-muted-foreground line-clamp-2 [&_p]:m-0">
                {description}
              </p>
            )}
            {subtitle && <p className="text-body-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>

          {/* Progress ring — right side */}
          {showProgress && (
            <div className="shrink-0 w-14 h-14 relative">
              <ProgressCircle percentage={progress} size={56} strokeWidth={6} strokeColor={color}>
                {progress >= 100 ? null : (
                  <>
                    {progressLabel && (
                      <span className="text-[9px] font-bold fill-foreground leading-none">
                        {progressLabel}
                      </span>
                    )}
                    <text
                      x="50%"
                      y="50%"
                      textAnchor="middle"
                      dy={progressLabel ? '1.2em' : '.3em'}
                      className="text-body-xs font-bold fill-foreground"
                    >
                      {Math.round(progress)}%
                    </text>
                  </>
                )}
              </ProgressCircle>
              {/* Completion checkmark — positioned over the progress circle */}
              {progress >= 100 && (
                <CheckCircle className="absolute inset-0 w-full h-full text-success" />
              )}
            </div>
          )}
        </div>

        {/* Extra content (e.g. chapter list, badges) */}
        {children}

        {/* Divider + action */}
        {showDivider && (
          <div className="border-t border-border/40 pt-4 mt-auto">
            {buttonLabel || buttonHref ? (
              <button
                onClick={() => {
                  const shouldNavigate = onButtonClick?.()
                  // Navigate if onButtonClick returned true or if no handler and not locked
                  if (shouldNavigate !== false && !isSoon && buttonHref) {
                    window.location.href = buttonHref
                  }
                }}
                className={cn(
                  'w-full min-h-[44px] rounded-xl text-body-sm font-bold px-6 py-2.5',
                  'bg-muted text-primary hover:bg-primary/5 transition-all duration-normal',
                  isSoon && 'cursor-not-allowed opacity-50 pointer-events-none',
                  buttonClassName,
                )}
              >
                {buttonLabel}
              </button>
            ) : null}
          </div>
        )}
      </div>
    </>
  )

  if (cardHref) {
    return (
      <div
        className={cardClasses}
        style={
          variant === 'lesson'
            ? { borderTopWidth: '4px', borderTopColor: color }
            : { borderInlineStartWidth: '4px', borderInlineStartColor: color }
        }
      >
        {/* Transparent overlay — whole card is a link */}
        <CardLink href={cardHref} onClick={cardOnClick} />
        {cardContent}
      </div>
    )
  }

  return (
    <div
      className={cardClasses}
      style={
        variant === 'lesson'
          ? { borderTopWidth: '4px', borderTopColor: color }
          : { borderInlineStartWidth: '4px', borderInlineStartColor: color }
      }
    >
      {cardContent}
    </div>
  )
}

// Separate client component for the card link overlay
function CardLink({ href, onClick }: { href: string; onClick?: (e: React.MouseEvent) => void }) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
    if (!e.defaultPrevented) {
      loadingManager.register(LOADING_KEYS.ROUTE_TRANSITION, 'route')
      window.location.href = href
    }
  }

  return (
    <a
      href={href}
      onClick={handleClick}
      className="absolute inset-0 z-10 rounded-2xl"
      aria-label="card-link"
    />
  )
}
