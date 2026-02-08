'use client'

import { useTranslations } from '@/ui/web/providers/I18n'

export function CourseCatalogHeader() {
  const t = useTranslations('courses')

  return (
    <div className="text-center mb-10">
      <h2
        className="text-card-foreground uppercase tracking-widest"
        style={{ fontSize: '24px', fontWeight: 900 }}
      >
        {t('catalogTitle')}
      </h2>
    </div>
  )
}
