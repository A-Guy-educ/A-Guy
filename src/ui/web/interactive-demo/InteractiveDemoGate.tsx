'use client'

import { useTranslations } from '@/ui/web/providers/I18n'
import { InteractiveDemoView } from './InteractiveDemoView'

interface InteractiveDemoGateProps {
  lessonId: string
  lessonTitle: string
  backUrl: string
  typewriterEnabled: boolean
  isInteractiveDemoEnabled: boolean
}

export function InteractiveDemoGate({
  lessonId,
  lessonTitle,
  backUrl,
  typewriterEnabled,
  isInteractiveDemoEnabled,
}: InteractiveDemoGateProps) {
  const t = useTranslations('interactiveDemo')

  // TEMPORARY DEBUG LOGGING (per requirement #1)
  console.log('[InteractiveDemoGate] Debug values:', {
    isInteractiveDemoEnabled,
    'typeof isInteractiveDemoEnabled': typeof isInteractiveDemoEnabled,
    showComingSoon: !isInteractiveDemoEnabled,
  })

  // Per requirement #3: Show "Coming Soon" only when interactive_demo is NOT enabled
  if (!isInteractiveDemoEnabled) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">{lessonTitle}</h1>
        <p className="text-muted-foreground">{t('comingSoon')}</p>
      </div>
    )
  }

  // Per requirement #4: Render Interactive Demo when enabled
  return (
    <InteractiveDemoView
      lessonId={lessonId}
      lessonTitle={lessonTitle}
      backUrl={backUrl}
      typewriterEnabled={typewriterEnabled}
    />
  )
}
