'use client'

import { useTranslations } from '@/ui/web/providers/I18n'

export function CourseCatalogHeader() {
  const t = useTranslations('courses')

  return (
    <div className="text-center mb-10 pb-6 border-b border-border/40">
      <h2 className="text-heading-xl font-black text-card-foreground uppercase tracking-widest section-accent inline-block">
        {t('catalogTitle')}
      </h2>
    </div>
  )
}
