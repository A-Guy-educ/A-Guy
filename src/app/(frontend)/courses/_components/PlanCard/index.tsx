'use client'

import { XCircle, CheckCircle2, HelpCircle, BookOpen, Layers } from 'lucide-react'
import { cn } from '@/infra/utils/ui'

type FeatureStyle = 'enabled' | 'disabled' | 'limited'
type IconType = 'check' | 'x' | 'help'
type ButtonStyle = 'current' | 'standard' | 'premium'

interface Feature {
  icon: IconType
  text: string
  style: FeatureStyle
}

interface CourseCount {
  number: number
  text: string
  color: string
  icon: 'book' | 'layers'
}

interface PlanCardProps {
  title: string
  subtitle: string
  price: number
  period: string
  features: Feature[]
  courseCount: CourseCount
  buttonText: string
  buttonStyle: ButtonStyle
  badge?: string
  badgeColor?: string
  isBordered?: boolean
  isPremium?: boolean
}

const PLAN_GRADIENTS = {
  current: 'from-muted/30 to-transparent',
  standard: 'from-blue-500/5 to-transparent',
  premium: 'from-primary/8 via-purple-500/5 to-transparent',
} as const

export function PlanCard({
  title,
  subtitle,
  price,
  period,
  features,
  courseCount,
  buttonText,
  buttonStyle,
  badge,
  badgeColor,
  isBordered = false,
  isPremium = false,
}: PlanCardProps) {
  const getButtonClasses = () => {
    switch (buttonStyle) {
      case 'current':
        return 'w-full py-4 rounded-2xl bg-muted text-muted-foreground'
      case 'standard':
        return 'w-full py-4 rounded-2xl bg-foreground text-background shadow-lg hover:opacity-90'
      case 'premium':
        return 'w-full py-4 rounded-2xl bg-primary text-white shadow-xl hover:scale-[1.02] transition-transform'
      default:
        return 'w-full py-4 rounded-2xl bg-foreground text-background'
    }
  }

  const getFeatureIcon = (iconType: IconType) => {
    switch (iconType) {
      case 'x':
        return <XCircle className="w-4 h-4 text-muted-foreground/30 shrink-0" />
      case 'check':
        return <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
      case 'help':
        return <HelpCircle className="w-4 h-4 text-warning shrink-0" />
      default:
        return null
    }
  }

  const getFeatureStyle = (style: FeatureStyle) => {
    switch (style) {
      case 'disabled':
        return 'text-muted-foreground italic line-through decoration-muted-foreground/30'
      case 'enabled':
        return 'font-medium text-card-foreground'
      case 'limited':
        return 'text-muted-foreground'
      default:
        return 'text-muted-foreground'
    }
  }

  const borderClass = isPremium
    ? 'border-2 border-primary'
    : isBordered
      ? 'border border-border'
      : 'border border-border/50'

  const gradientClass = PLAN_GRADIENTS[buttonStyle] ?? PLAN_GRADIENTS.standard

  return (
    <div
      className={cn(
        'group relative rounded-[2.5rem] flex flex-col min-w-[300px] md:min-w-0 overflow-hidden',
        'bg-card bg-gradient-to-b',
        gradientClass,
        borderClass,
        'shadow-card',
        'transition-all duration-slow hover:-translate-y-1 hover:shadow-card-hover hover:border-primary/15',
      )}
    >
      {badge && (
        <div
          className={cn(
            'absolute -top-4 left-1/2 -translate-x-1/2 z-10',
            badgeColor,
            'text-white px-6 py-2 rounded-full shadow-lg',
          )}
        >
          <span className="uppercase tracking-widest text-[10px] font-black">{badge}</span>
        </div>
      )}

      <div className="p-card-padding-lg flex flex-col flex-1">
        {/* Plan header */}
        <div className="mb-8">
          <span
            className={cn(
              'block mb-2 uppercase tracking-widest text-[10px]',
              isPremium ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            {subtitle}
          </span>
          <h3
            className={cn(
              'text-heading-xl font-black mb-4',
              isPremium ? 'text-primary' : 'text-card-foreground',
            )}
          >
            {title}
          </h3>

          {/* Prominent pricing */}
          <div className="flex items-baseline gap-1">
            <span
              className={cn(
                'text-display-sm font-black',
                isPremium ? 'text-primary' : 'text-card-foreground',
              )}
            >
              {'\u20AA'}
              {price}
            </span>
            <span className="text-body-sm font-normal text-muted-foreground">/ {period}</span>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border/50 mb-6" />

        {/* Feature list */}
        <ul className="space-y-3.5 mb-10 flex-1">
          {features.map((feature, featureIndex) => (
            <li
              key={featureIndex}
              className={cn('flex items-center gap-3 text-body-sm', getFeatureStyle(feature.style))}
            >
              {getFeatureIcon(feature.icon)}
              <span>{feature.text}</span>
            </li>
          ))}
          <li className={cn('flex items-center gap-3 text-body-sm font-medium', courseCount.color)}>
            {courseCount.icon === 'book' ? (
              <BookOpen className="w-4 h-4 shrink-0" />
            ) : (
              <Layers className="w-4 h-4 shrink-0" />
            )}
            <span>{courseCount.text}</span>
          </li>
        </ul>

        {/* Action button */}
        <button className={cn(getButtonClasses(), 'text-body-sm font-semibold')}>
          {buttonText}
        </button>
      </div>
    </div>
  )
}
