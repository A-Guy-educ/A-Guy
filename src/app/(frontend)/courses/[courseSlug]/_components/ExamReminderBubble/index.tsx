'use client'

import { Sparkles } from 'lucide-react'
import { useTranslations } from '@/ui/web/providers/I18n'

interface ExamReminderBubbleProps {
  daysUntil: number
}

export function ExamReminderBubble({ daysUntil }: ExamReminderBubbleProps) {
  const t = useTranslations('coursePage')
  const message = t('examReminder').replace('{days}', String(daysUntil))

  return (
    <div className="flex items-center justify-end gap-3 mt-3 animate-in fade-in">
      <div className="bg-card shadow-card border border-primary/10 rounded-2xl rounded-tr-none px-4 py-2 flex items-center gap-2">
        <p className="text-xs md:text-sm font-bold text-primary">{message}</p>
      </div>
      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-md shrink-0">
        <Sparkles className="w-4 h-4 text-primary-foreground fill-current" />
      </div>
    </div>
  )
}
