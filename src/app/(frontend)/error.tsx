'use client'

import { useTranslations } from '@/ui/web/providers/I18n'
import { Spinner } from '@/infra/loading/components/Spinner'

/**
 * Root error boundary for frontend routes
 * Displays a graceful error message with retry functionality
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations('common.error')

  return (
    <div
      className="flex flex-col items-center justify-center min-h-[50vh] gap-4 p-8 text-center"
      role="alert"
      aria-live="polite"
    >
      <h2 className="text-2xl font-semibold text-destructive">{t('title')}</h2>
      <p className="text-muted-foreground">{error.message || t('description')}</p>
      <button
        onClick={() => reset()}
        className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
      >
        <Spinner size="sm" className="mr-2" />
        {t('retryButton')}
      </button>
    </div>
  )
}
