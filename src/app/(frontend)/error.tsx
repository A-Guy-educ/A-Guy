'use client'

import { Button } from '@/ui/web/components/button'
import { useTranslations } from '@/ui/web/providers/I18n'

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
      className="container flex flex-col items-center justify-center min-h-[50vh] gap-4"
      data-error-digest={error.digest}
    >
      <h2 className="text-2xl font-semibold">{t('title')}</h2>
      <p className="text-muted-foreground">{t('message')}</p>
      <Button onClick={() => reset()}>{t('tryAgain')}</Button>
    </div>
  )
}
