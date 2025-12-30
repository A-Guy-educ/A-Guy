'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useTranslations } from '@/providers/I18n'

type ViewMode = 'non-interactive' | 'interactive'

interface ViewToggleProps {
  hasPdf: boolean
  hasExercises: boolean
  initialMode?: ViewMode
  onViewChange: (mode: ViewMode) => void
}

export function ViewToggle({
  hasPdf,
  hasExercises,
  initialMode = 'non-interactive',
  onViewChange,
}: ViewToggleProps) {
  const t = useTranslations('courses')
  const [activeMode, setActiveMode] = useState<ViewMode>(initialMode)

  const handleModeChange = (mode: ViewMode) => {
    setActiveMode(mode)
    onViewChange(mode)
  }

  // If only one option is available, don't show toggle
  if (!hasPdf && !hasExercises) return null
  if (!hasPdf || !hasExercises) return null

  return (
    <div className="flex items-center justify-center gap-2 mb-6 p-1 bg-muted rounded-lg w-fit mx-auto">
      <Button
        variant={activeMode === 'non-interactive' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => handleModeChange('non-interactive')}
        className="transition-all"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 mr-2"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        {t('pdfView')}
      </Button>
      <Button
        variant={activeMode === 'interactive' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => handleModeChange('interactive')}
        className="transition-all"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 mr-2"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        </svg>
        {t('interactiveExercises')}
      </Button>
    </div>
  )
}
