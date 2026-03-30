'use client'

import { useTranslations } from '@/ui/web/providers/I18n'
import { useEffect, useState } from 'react'

interface ChatQuotaBarProps {
  questionsUsed: number
  maxQuestions: number
  resetAt: string | null
}

function formatTimeRemaining(resetAt: string): string {
  const diff = new Date(resetAt).getTime() - Date.now()
  if (diff <= 0) return ''
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export function ChatQuotaBar({ questionsUsed, maxQuestions, resetAt }: ChatQuotaBarProps) {
  const t = useTranslations('courses')
  const [timeLeft, setTimeLeft] = useState(() => (resetAt ? formatTimeRemaining(resetAt) : ''))

  useEffect(() => {
    if (!resetAt) return
    setTimeLeft(formatTimeRemaining(resetAt))
    const interval = setInterval(() => {
      setTimeLeft(formatTimeRemaining(resetAt))
    }, 60_000)
    return () => clearInterval(interval)
  }, [resetAt])

  const isExhausted = questionsUsed >= maxQuestions
  const percentage = Math.min((questionsUsed / maxQuestions) * 100, 100)

  return (
    <div className="flex items-center gap-content-gap-xs text-body-xs text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isExhausted ? 'bg-warning' : 'bg-primary'}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className={isExhausted ? 'text-warning font-medium' : ''}>
          {t('chatQuotaCounter')
            .replace('{used}', String(questionsUsed))
            .replace('{max}', String(maxQuestions))}
        </span>
      </div>
      {resetAt && timeLeft && (
        <span className="text-muted-foreground/70">
          {t('chatQuotaResetIn').replace('{time}', timeLeft)}
        </span>
      )}
    </div>
  )
}
