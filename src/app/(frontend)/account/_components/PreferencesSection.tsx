'use client'

import { useTranslations } from '@/ui/web/providers/I18n'

export function PreferencesSection() {
  const t = useTranslations('auth.account')

  return (
    <div className="py-4">
      <p className="text-muted-foreground">{t('preferencesPlaceholder')}</p>
    </div>
  )
}
