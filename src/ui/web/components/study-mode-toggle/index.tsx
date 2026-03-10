'use client'

import { motion } from 'framer-motion'
import { useContext, useState } from 'react'
import { useTranslations } from '@/ui/web/providers/I18n'
import { cn } from '@/infra/utils/ui'
import { StudyModeContext } from '@/ui/web/providers/StudyMode'
import type { StudyMode } from '@/ui/web/providers/StudyMode/types'

/**
 * @fileType component
 * @domain study-mode
 * @pattern ui-controls
 * @ai-summary Mode toggle component for switching between Study/Hint/Practice/Test modes
 */

const modes: StudyMode[] = ['study', 'hint', 'practice', 'test']

interface ModeButtonProps {
  mode: StudyMode
  isActive: boolean
  onClick: () => void
}

function ModeButton({ mode, isActive, onClick }: ModeButtonProps) {
  const t = useTranslations('studyMode')
  const [prefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative px-4 py-2 rounded-full text-sm font-medium transition-colors',
        'min-h-[48px] min-w-[80px] flex items-center justify-center',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mode-accent focus-visible:ring-offset-2',
        isActive
          ? 'bg-mode-accent text-mode-accent-fg'
          : 'bg-mode-surface/50 text-muted-foreground hover:bg-mode-surface hover:text-foreground',
        'cursor-pointer',
      )}
      role="tab"
      aria-selected={isActive}
      aria-controls={`panel-${mode}`}
    >
      {isActive && !prefersReducedMotion ? (
        <motion.div
          layoutId="activeTab"
          className="absolute inset-0 bg-mode-accent rounded-full"
          transition={{ type: 'spring', duration: 0.3 }}
        />
      ) : null}
      <span className={cn('relative z-10', isActive && 'text-mode-accent-fg')}>{t(mode)}</span>
    </button>
  )
}

interface StudyModeToggleProps {
  className?: string
  disabled?: boolean
  onModeChange?: (mode: StudyMode) => void
}

/**
 * Study mode toggle component with four modes: Study, Hint, Practice, Test
 */
export function StudyModeToggle({ className, disabled, onModeChange }: StudyModeToggleProps) {
  const context = useContext(StudyModeContext)

  if (!context) {
    throw new Error('StudyModeToggle must be used within a StudyModeProvider')
  }

  const { mode, setMode } = context
  const handleModeChange = (newMode: StudyMode) => {
    if (disabled) return
    setMode(newMode)
    onModeChange?.(newMode)
  }

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (disabled) return

    let newIndex = index

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      newIndex = (index + 1) % modes.length
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      newIndex = (index - 1 + modes.length) % modes.length
    } else if (e.key === 'Home') {
      e.preventDefault()
      newIndex = 0
    } else if (e.key === 'End') {
      e.preventDefault()
      newIndex = modes.length - 1
    }

    if (newIndex !== index) {
      handleModeChange(modes[newIndex])
    }
  }

  return (
    <div
      className={cn(
        'flex gap-2 p-1.5 rounded-2xl bg-mode-surface/30 backdrop-blur-sm',
        'border border-mode-border/20',
        disabled && 'opacity-50 pointer-events-none',
        className,
      )}
      role="tablist"
      aria-label="Study mode"
    >
      {modes.map((m, index) => (
        <div key={m} onKeyDown={(e) => handleKeyDown(e, index)}>
          <ModeButton mode={m} isActive={mode === m} onClick={() => handleModeChange(m)} />
        </div>
      ))}
    </div>
  )
}
