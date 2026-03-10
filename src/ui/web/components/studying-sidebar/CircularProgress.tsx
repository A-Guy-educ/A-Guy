'use client'

import { motion } from 'framer-motion'
import { useTranslations } from '@/ui/web/providers/I18n'
import { cn } from '@/infra/utils/ui'

/**
 * @fileType component
 * @domain study-mode
 * @pattern progress-indicator
 * @ai-summary Circular progress indicator for exercise completion
 */

interface CircularProgressProps {
  progress: number // 0-100
  size?: number
  strokeWidth?: number
  className?: string
  showCheckmark?: boolean
}

export function CircularProgress({
  progress,
  size = 24,
  strokeWidth = 3,
  className,
  showCheckmark = false,
}: CircularProgressProps) {
  const t = useTranslations('studyMode')
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (progress / 100) * circumference
  const isComplete = progress >= 100

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={t('sidebar.progress')}
    >
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={cn('text-mode-accent', isComplete && 'text-success')}
        />
      </svg>
      {showCheckmark && isComplete && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <svg
            width={size * 0.6}
            height={size * 0.6}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-success"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </motion.div>
      )}
    </div>
  )
}
