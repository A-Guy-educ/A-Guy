'use client'

import { motion } from 'framer-motion'
import { cn } from '@/infra/utils/ui'
import { CircularProgress } from './CircularProgress'

/**
 * @fileType component
 * @domain study-mode
 * @pattern navigation-item
 * @ai-summary Individual sidebar navigation item with progress indicator
 */

export interface ExerciseItem {
  id: string
  title: string
  slug: string
  order: number
  status?: 'completed' | 'in_progress' | 'not_started'
  progress?: number // 0-100
}

interface SidebarItemProps {
  exercise: ExerciseItem
  isActive: boolean
  onClick: () => void
  className?: string
}

export function SidebarItem({ exercise, isActive, onClick, className }: SidebarItemProps) {
  const progress =
    exercise.progress ??
    (exercise.status === 'completed' ? 100 : exercise.status === 'in_progress' ? 50 : 0)

  return (
    <motion.button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3 rounded-full transition-colors',
        'min-h-[48px] text-start',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mode-accent focus-visible:ring-offset-2',
        isActive ? 'bg-mode-accent/10 border-s-2 border-mode-accent' : 'hover:bg-mode-surface/50',
        className,
      )}
      role="tab"
      aria-selected={isActive}
      aria-current={isActive ? 'step' : undefined}
    >
      <CircularProgress progress={progress} showCheckmark={exercise.status === 'completed'} />
      <span
        className={cn(
          'flex-1 text-sm font-medium truncate',
          isActive ? 'text-mode-accent' : 'text-foreground',
        )}
      >
        {exercise.order}. {exercise.title}
      </span>
    </motion.button>
  )
}
