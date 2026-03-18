'use client'

import { useTranslations } from '@/ui/web/providers/I18n'

interface ExamReminderBubbleProps {
  daysUntil: number
}

export function ExamReminderBubble({ daysUntil }: ExamReminderBubbleProps) {
  const t = useTranslations('coursePage')
  const message = t('examReminder').replace('{days}', String(daysUntil))

  return (
    <div className="flex justify-center mt-4 animate-in fade-in">
      <span className="bg-primary text-primary-foreground text-sm font-bold px-6 py-2 rounded-full">
        {message}
      </span>
    </div>
  )
}
