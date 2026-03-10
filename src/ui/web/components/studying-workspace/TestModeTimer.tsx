'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useTranslations } from '@/ui/web/providers/I18n'
import { cn } from '@/infra/utils/ui'
import { Play, Pause, AlertTriangle } from 'lucide-react'

/**
 * @fileType component
 * @domain study-mode
 * @pattern timer
 * @ai-summary Floating timer for Test mode
 */

interface TestModeTimerProps {
  className?: string
  durationMinutes?: number
  onTimerEnd?: () => void
}

export function TestModeTimer({ className, durationMinutes = 60, onTimerEnd }: TestModeTimerProps) {
  const t = useTranslations('studyMode')
  const [secondsRemaining, setSecondsRemaining] = useState(durationMinutes * 60)
  const [isPaused, setIsPaused] = useState(false)
  const [isExpired, setIsExpired] = useState(false)

  // Load from sessionStorage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem('test-timer')
    if (saved) {
      const { remaining, timestamp } = JSON.parse(saved)
      const elapsed = Math.floor((Date.now() - timestamp) / 1000)
      const remainingAfterLoad = remaining - elapsed
      if (remainingAfterLoad > 0) {
        setSecondsRemaining(remainingAfterLoad)
      } else {
        setIsExpired(true)
        setSecondsRemaining(0)
      }
    }
  }, [])

  // Save to sessionStorage periodically
  useEffect(() => {
    if (isExpired || isPaused) return

    const interval = setInterval(() => {
      sessionStorage.setItem(
        'test-timer',
        JSON.stringify({
          remaining: secondsRemaining,
          timestamp: Date.now(),
        }),
      )
    }, 1000)

    return () => clearInterval(interval)
  }, [secondsRemaining, isPaused, isExpired])

  // Countdown
  useEffect(() => {
    if (isPaused || isExpired) return

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          setIsExpired(true)
          onTimerEnd?.()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isPaused, isExpired, onTimerEnd])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleTogglePause = () => {
    setIsPaused(!isPaused)
  }

  const isLowTime = secondsRemaining <= 300 // 5 minutes

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn(
        'glass-surface rounded-full px-4 py-2',
        'border border-mode-accent/30',
        'flex items-center gap-3',
        isLowTime && isExpired && 'border-error bg-error/10',
        className,
      )}
      role="timer"
      aria-live="polite"
      aria-atomic="true"
    >
      {/* Timer icon */}
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center',
          isLowTime && !isExpired
            ? 'bg-warning/20 text-warning'
            : 'bg-mode-accent/20 text-mode-accent',
        )}
      >
        {isExpired ? (
          <AlertTriangle className="w-4 h-4" />
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        )}
      </div>

      {/* Time display */}
      <div className="flex flex-col">
        <span
          className={cn(
            'text-lg font-mono font-semibold',
            isLowTime && !isExpired && 'text-warning',
            isExpired && 'text-error',
          )}
        >
          {isExpired ? t('testMode.timerExpired') : formatTime(secondsRemaining)}
        </span>
        {!isExpired && (
          <span className="text-xs text-muted-foreground">{t('timer.remaining')}</span>
        )}
      </div>

      {/* Pause/Resume button */}
      {!isExpired && (
        <button
          onClick={handleTogglePause}
          className={cn(
            'p-2 rounded-full hover:bg-mode-surface/50 transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mode-accent',
            'min-h-[48px] min-w-[48px] flex items-center justify-center',
          )}
          aria-label={isPaused ? t('timer.resume') : t('timer.pause')}
        >
          {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
        </button>
      )}

      {/* Safe area padding for mobile */}
      <div className="pb-[env(safe-area-inset-bottom)]" />
    </motion.div>
  )
}
