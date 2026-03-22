'use client'

import { MessageSquare, Trash2 } from 'lucide-react'
import { cn } from '@/infra/utils/ui'
import { useTranslations } from '@/ui/web/providers/I18n'

interface ConversationCardProps {
  index: number
  title: string
  subtitle?: string
  onClick: () => void
  onDelete: () => void
  accentColor?: string
}

export function ConversationCard({
  index,
  title,
  subtitle,
  onClick,
  onDelete,
  accentColor,
}: ConversationCardProps) {
  const t = useTranslations('coursePage')

  return (
    <div
      className="rounded-2xl overflow-hidden border border-border/40 shadow-sm transition-all active:scale-[0.98]"
      style={{ borderTopWidth: 3, borderTopColor: accentColor ?? 'hsl(var(--primary))' }}
    >
      <div
        className={cn('bg-card p-6', 'flex items-center justify-between', 'cursor-pointer')}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onClick()}
      >
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wide">
            {t('question')} {index}
          </span>
          <h3 className="text-lg font-bold text-card-foreground truncate">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-1 truncate">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0 ms-3">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="p-2 text-muted-foreground hover:text-destructive rounded-full hover:bg-destructive/10 transition-colors"
            aria-label={t('deleteConversation')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center border border-border">
            <MessageSquare className="w-5 h-5 text-muted-foreground" />
          </div>
        </div>
      </div>
    </div>
  )
}
