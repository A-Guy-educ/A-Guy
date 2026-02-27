'use client'

import { Spinner } from '@/ui/web/shared/Loading/Spinner'
import { useTranslations } from '@/ui/web/providers/I18n'

export default function Loading() {
  const t = useTranslations('loading')

  return (
    <div className="container py-28">
      <div className="flex flex-col items-center justify-center gap-4">
        <Spinner size="lg" variant="primary" aria-label={t('title')} />
        <p className="text-base font-medium">{t('title')}</p>
        <p className="text-muted-foreground text-sm">{t('description')}</p>
      </div>
    </div>
  )
}
