'use client'

import { cn } from '@/infra/utils/ui'
import { useTranslations } from '@/ui/web/providers/I18n'

type DisplayMode = 'interactive' | 'scroll' | 'pdf'

interface DisplayModeToggleProps {
  modes: DisplayMode[]
  selected: DisplayMode
  onChange: (mode: DisplayMode) => void
}

export function DisplayModeToggle({ modes, selected, onChange }: DisplayModeToggleProps) {
  const t = useTranslations('courses')

  // Only show if 2+ modes available
  if (modes.length < 2) {
    return null
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-body-sm text-muted-foreground font-medium">
        {t('displayModeLabel')}
      </span>
      <div className="flex gap-2" role="radiogroup" aria-label={t('displayModeLabel')}>
        {modes.map((mode) => (
          <button
            key={mode}
            onClick={() => onChange(mode)}
            className={cn(
              'px-4 py-2 rounded-lg border text-body-sm font-medium transition-all duration-normal',
              selected === mode
                ? 'bg-primary text-primary-foreground border-primary shadow-elevation-1'
                : 'bg-card text-foreground border-border hover:border-primary/50 hover:shadow-elevation-1',
            )}
            role="radio"
            aria-checked={selected === mode}
          >
            {t(`displayMode.${mode}`)}
          </button>
        ))}
      </div>
    </div>
  )
}
