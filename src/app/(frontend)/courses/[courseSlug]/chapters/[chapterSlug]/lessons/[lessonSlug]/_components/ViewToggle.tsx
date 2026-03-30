'use client'

import { useState } from 'react'
import { Button } from '@/ui/web/components/button'
import { useTranslations } from '@/ui/web/providers/I18n'
import { cn } from '@/infra/utils/ui'
import { FileText, ClipboardCheck } from 'lucide-react'

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
    <div className="flex items-center justify-center gap-1 mb-8 p-1 bg-muted rounded-xl w-fit mx-auto border border-border/40">
      <Button
        variant={activeMode === 'non-interactive' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => handleModeChange('non-interactive')}
        className={cn(
          'transition-all duration-normal rounded-lg gap-2',
          activeMode === 'non-interactive' ? 'shadow-sm' : 'hover:bg-background/50',
        )}
      >
        <FileText className="h-4 w-4" />
        {t('pdfView')}
      </Button>
      <Button
        variant={activeMode === 'interactive' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => handleModeChange('interactive')}
        className={cn(
          'transition-all duration-normal rounded-lg gap-2',
          activeMode === 'interactive' ? 'shadow-sm' : 'hover:bg-background/50',
        )}
      >
        <ClipboardCheck className="h-4 w-4" />
        {t('interactiveExercises')}
      </Button>
    </div>
  )
}
