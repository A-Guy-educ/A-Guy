'use client'

import { Button } from '@/ui/web/components/button'
import { useTranslations } from '@/ui/web/providers/I18n'

/**
 * Root error boundary for frontend routes
 * Handles uncaught errors gracefully with retry functionality
 */
export default function Error({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations('common.error')

  return (
    <div
      className="flex flex-col items-center justify-center min-h-[50vh] gap-4"
      role="alert"
      aria-live="polite"
    >
      <h2 className="text-xl font-semibold">{t('title')}</h2>
      <Button onClick={reset} variant="default">
        {t('retryButton')}
      </Button>
    </div>
  )
}
