'use client'

import { useTranslations } from '@/ui/web/providers/I18n'

export function CourseShopHeader() {
  const t = useTranslations('courses')

  return (
    <header className="bg-card border-b border-border pt-12 pb-10">
      <div className="max-w-5xl mx-auto px-6 text-center">
        <h1 className="text-display-md font-black text-card-foreground mb-4 whitespace-nowrap">
          {t('shopTitle')}
        </h1>
        <p className="text-body-lg text-muted-foreground max-w-2xl mx-auto">
          {t('shopDescription')}
        </p>
      </div>
    </header>
  )
}
