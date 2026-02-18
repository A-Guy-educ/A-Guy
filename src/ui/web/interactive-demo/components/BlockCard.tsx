'use client'

import { cn } from '@/infra/utils/ui'
import { useTranslations } from '@/ui/web/providers/I18n'

interface BlockCardProps {
  children: React.ReactNode
  label?: string
  role?: 'assistant' | 'user'
  className?: string
}

export function BlockCard({ children, label, role = 'assistant', className }: BlockCardProps) {
  const t = useTranslations('interactiveDemo')

  // Get translated label
  const displayLabel = label || (role === 'assistant' ? 'A-Guy' : t('student'))

  // Get meta text
  const metaText = role === 'assistant' ? t('teacher') : t('student')

  return (
    <div
      className={cn(
        'relative rounded-[22px] border border-border bg-card/85 backdrop-blur-2xl shadow-[0_18px_40px_rgba(17,24,39,0.06)] p-4 overflow-hidden',
        className,
      )}
    >
      {/* Accent strip */}
      <div
        className={cn(
          'absolute top-0 bottom-0 w-1.5 ltr:right-0 rtl:left-0',
          role === 'assistant'
            ? 'bg-gradient-to-b from-primary to-primary/80'
            : 'bg-gradient-to-b from-green-600 to-green-700',
        )}
      />

      {/* Header with label and meta */}
      <div className="flex items-start justify-between mb-3 gap-3">
        <div>
          <div className="text-base font-bold text-foreground">{displayLabel}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{metaText}</div>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-2">{children}</div>
    </div>
  )
}
