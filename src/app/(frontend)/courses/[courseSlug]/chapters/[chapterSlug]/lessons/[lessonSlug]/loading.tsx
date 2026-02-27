'use client'

import { useTranslations } from '@/ui/web/providers/I18n'
import { Spinner } from '@/ui/web/shared/Loading/Spinner'

export default function Loading() {
  const t = useTranslations('common.loading')

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <Spinner size="lg" variant="muted" aria-label={t('label')} />
      <p className="text-sm text-muted-foreground">{t('label')}</p>
    </div>
  )
}
