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
        return <XCircle className="w-4 h-4 text-muted-foreground/30" />
      case 'check':
        return <CheckCircle2 className="w-4 h-4 text-success" />
      case 'help':
        return <HelpCircle className="w-4 h-4 text-warning" />
      default:
        return null
    }
  }

  const getFeatureStyle = (style: FeatureStyle) => {
    switch (style) {
      case 'disabled':
        return 'text-muted-foreground italic'
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

  return (
    <div
      className={cn(
        'relative bg-card rounded-[2.5rem] p-8 flex flex-col min-w-[300px] md:min-w-0',
        borderClass,
        'shadow-card',
        'transition-all duration-slow hover:-translate-y-1 hover:shadow-card-hover hover:border-primary/15',
      )}
    >
      {badge && (
        <div
          className={cn(
            'absolute -top-4 left-1/2 -translate-x-1/2',
            badgeColor,
            'text-white px-6 py-2 rounded-full shadow-lg',
          )}
        >
          <span className="uppercase tracking-widest text-[10px] font-black">
            {badge}
          </span>
        </div>
      )}

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
          className={cn('text-heading-xl font-black mb-1', isPremium ? 'text-primary' : 'text-card-foreground')}
        >
          {title}
        </h3>
        <div className="text-heading-xl font-black text-card-foreground">
          ₪{price}{' '}
          <span className="text-body-sm font-normal text-muted-foreground">
            / {period}
          </span>
        </div>
      </div>

      <ul className="space-y-4 mb-10 flex-1">
        {features.map((feature, index) => (
          <li
            key={index}
            className={cn('flex items-center gap-3 text-body-sm', getFeatureStyle(feature.style))}
          >
            {getFeatureIcon(feature.icon)}
            <span>{feature.text}</span>
          </li>
        ))}
        <li className={cn('flex items-center gap-3 text-body-sm', courseCount.color)}>
          {courseCount.icon === 'book' ? (
            <BookOpen className="w-4 h-4" />
          ) : (
            <Layers className="w-4 h-4" />
          )}
          <span>{courseCount.text}</span>
        </li>
      </ul>

      <button className={cn(getButtonClasses(), 'text-body-sm')}>
        {buttonText}
      </button>
    </div>
  )
}
