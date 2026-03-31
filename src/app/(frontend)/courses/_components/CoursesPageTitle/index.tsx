'use client'

import { useTranslations } from '@/ui/web/providers/I18n'

export function CoursesPageTitle() {
  const t = useTranslations('courses')
  return (
    <div className="mb-8">
      <h2 className="text-heading-xl md:text-display-sm font-bold text-foreground mb-2">
        {t('featuredTitle')}
      </h2>
      <p className="text-muted-foreground">{t('featuredDescription')}</p>
    </div>
  )
}
