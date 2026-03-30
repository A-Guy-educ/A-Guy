'use client'

import { useTranslations } from '@/ui/web/providers/I18n'

export function CourseCatalogHeader() {
  const t = useTranslations('courses')

  return (
    <div className="text-center mb-10">
      <h2 className="text-heading-xl font-black text-card-foreground uppercase tracking-widest">
        {t('catalogTitle')}
      </h2>
    </div>
  )
}
