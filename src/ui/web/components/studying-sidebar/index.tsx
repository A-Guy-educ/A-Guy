'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useTranslations } from '@/ui/web/providers/I18n'
import { cn } from '@/infra/utils/ui'
import { ChevronLeft, ChevronRight, ListOrdered } from 'lucide-react'
import { SidebarItem, type ExerciseItem } from './SidebarItem'

/**
 * @fileType component
 * @domain study-mode
 * @pattern navigation-sidebar
 * @ai-summary Contextual navigation sidebar for lesson exercises
 */

interface StudyingSidebarProps {
  exercises: ExerciseItem[]
  currentExerciseId?: string
  onExerciseSelect: (exerciseId: string) => void
  className?: string
  collapsed?: boolean
  onToggleCollapse?: () => void
}

export function StudyingSidebar({
  exercises,
  currentExerciseId,
  onExerciseSelect,
  className,
  collapsed = false,
  onToggleCollapse,
}: StudyingSidebarProps) {
  const t = useTranslations('studyMode')
  const [isCollapsed, setIsCollapsed] = React.useState(collapsed)

  React.useEffect(() => {
    setIsCollapsed(collapsed)
  }, [collapsed])

  const handleToggle = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    onToggleCollapse?.()
  }

  const completedCount = exercises.filter((e) => e.status === 'completed').length
  const progressPercent =
    exercises.length > 0 ? Math.round((completedCount / exercises.length) * 100) : 0

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 'auto' : 280 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className={cn(
        'h-full glass-surface rounded-4xl flex flex-col',
        'border border-mode-border/20',
        className,
      )}
      role="navigation"
      aria-label={t('sidebar.label')}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-mode-border/20">
        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <ListOrdered className="w-5 h-5 text-mode-accent" />
              <span className="font-semibold text-sm">{t('sidebar.exercises')}</span>
            </motion.div>
          )}
        </AnimatePresence>
        <button
          onClick={handleToggle}
          className={cn(
            'p-2 rounded-full hover:bg-mode-surface/50 transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mode-accent',
            'min-h-[48px] min-w-[48px] flex items-center justify-center',
          )}
          aria-label={isCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}
        >
          {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      {/* Progress summary */}
      <AnimatePresence mode="wait">
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 py-3 border-b border-mode-border/20"
          >
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">{t('sidebar.progress')}</span>
              <span className="font-medium text-mode-accent">{progressPercent}%</span>
            </div>
            <div className="h-2 bg-mode-surface/50 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-mode-accent rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {completedCount} / {exercises.length} {t('sidebar.exercises').toLowerCase()}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Exercise list */}
      <div className="flex-1 overflow-y-auto py-2 px-2">
        <AnimatePresence mode="wait">
          {!isCollapsed ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-1"
            >
              {exercises.map((exercise) => (
                <SidebarItem
                  key={exercise.id}
                  exercise={exercise}
                  isActive={exercise.id === currentExerciseId}
                  onClick={() => onExerciseSelect(exercise.id)}
                />
              ))}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-2"
            >
              {exercises.slice(0, 5).map((exercise) => (
                <button
                  key={exercise.id}
                  onClick={() => onExerciseSelect(exercise.id)}
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mode-accent',
                    exercise.id === currentExerciseId
                      ? 'bg-mode-accent text-mode-accent-fg'
                      : 'bg-mode-surface/50 hover:bg-mode-surface',
                  )}
                  aria-label={exercise.title}
                >
                  <span className="text-sm font-medium">{exercise.order}</span>
                </button>
              ))}
              {exercises.length > 5 && (
                <span className="text-xs text-muted-foreground">+{exercises.length - 5}</span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  )
}

export type { ExerciseItem } from './SidebarItem'

import * as React from 'react'
