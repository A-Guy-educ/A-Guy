'use client'

import { BookOpen, GraduationCap, CheckCircle } from 'lucide-react'
import { cn } from '@/infra/utils/ui'

interface CourseCardProps {
  badge: string
  badgeColor: string
  title: string
  description: string
  price: number
  icon: 'book' | 'graduation' | 'check'
  iconBgColor: string
  buttonText: string
  buttonStyle: 'purchase' | 'owned'
  isOwned?: boolean
}

export function CourseCard({
  badge,
  badgeColor,
  title,
  description,
  price,
  icon,
  iconBgColor,
  buttonText,
  buttonStyle,
  isOwned = false,
}: CourseCardProps) {
  const getIcon = () => {
    switch (icon) {
      case 'book':
        return <BookOpen className="w-6 h-6 text-[hsl(var(--shop-badge-blue))]" />
      case 'graduation':
        return <GraduationCap className="w-6 h-6 text-[hsl(var(--shop-badge-blue))]" />
      case 'check':
        return <CheckCircle className="w-6 h-6 text-[hsl(var(--shop-success))]" />
      default:
        return <BookOpen className="w-6 h-6 text-[hsl(var(--shop-badge-blue))]" />
    }
  }

  const getButtonClasses = () => {
    if (buttonStyle === 'owned') {
      return 'bg-[hsl(var(--shop-success-bg))] text-[hsl(var(--shop-success-dark))] px-6 py-2.5 rounded-xl'
    }
    return 'bg-muted px-6 py-2.5 rounded-xl hover:bg-[hsl(var(--shop-badge-blue-bg))] transition-colors'
  }

  const getButtonTextColor = () => {
    if (buttonStyle === 'owned') {
      return 'text-[hsl(var(--shop-success-dark))]'
    }
    return 'text-[hsl(var(--shop-badge-blue-dark))] hover:text-[hsl(var(--shop-primary))]'
  }

  const borderClass = isOwned
    ? 'border-2 border-[hsl(var(--shop-primary))]/20'
    : 'border border-transparent hover:border-[hsl(var(--shop-badge-blue-bg))]'

  return (
    <div
      className={cn(
        'relative bg-card p-6 rounded-[2rem] flex flex-col',
        borderClass,
        'shadow-[0_1px_2px_0_rgba(60,64,67,.3),0_1px_3px_1px_rgba(60,64,67,.15)]',
        'transition-all active:scale-[0.98]',
      )}
    >
      {isOwned && (
        <span
          className="absolute -top-3 left-6 bg-[hsl(var(--shop-success))] text-white px-4 py-1 rounded-full shadow-md uppercase tracking-wider"
          style={{ fontSize: '9px', fontWeight: 900 }}
        >
          הקורס שלך
        </span>
      )}

      <div className="mb-6 flex justify-between items-start">
        <div>
          <span
            className={cn('block mb-1 uppercase tracking-widest', badgeColor)}
            style={{ fontSize: '10px', fontWeight: 900 }}
          >
            {badge}
          </span>
          <h4 className="text-card-foreground" style={{ fontSize: '20px', fontWeight: 900 }}>
            {title}
          </h4>
          <p className="text-muted-foreground mt-1" style={{ fontSize: '12px' }}>
            {description}
          </p>
        </div>
        <div
          className={cn(
            'w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0',
            iconBgColor,
          )}
        >
          {getIcon()}
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between pt-6 border-t border-border">
        <span
          className={
            isOwned ? 'text-muted-foreground/50 italic line-through' : 'text-card-foreground'
          }
          style={{ fontSize: '20px', fontWeight: 900 }}
        >
          ₪{price}
        </span>
        <button
          className={cn(getButtonClasses(), getButtonTextColor())}
          style={{ fontSize: '12px', fontWeight: 700 }}
        >
          {buttonText}
        </button>
      </div>
    </div>
  )
}
