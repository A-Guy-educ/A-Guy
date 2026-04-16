'use client'

import { useTranslations } from '@/ui/web/providers/I18n'

export function CourseShopHeader() {
  const t = useTranslations('courses')

  return (
    <header className="pt-12 pb-10 bg-gradient-to-b from-card via-card to-background border-b border-border/40 dark:bg-gradient-to-b dark:from-card/80 dark:to-transparent">
      <div className="max-w-5xl mx-auto px-6 text-center">
        <h1 className="text-display-md font-black text-card-foreground section-accent inline-block">
          {t('shopTitle')}
        </h1>
        <p className="text-body-lg text-muted-foreground max-w-2xl mx-auto mt-6">
          {t('shopDescription')}
        </p>
      </div>
    </header>
  )
}
