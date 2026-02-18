'use client'
import { useTranslations } from '@/ui/web/providers/I18n'

export default function AccessibilityPage() {
  const t = useTranslations('legal.accessibility')

  return (
    <div className="container mx-auto py-12 px-4 max-w-4xl">
      <h1 className="text-4xl font-bold mb-2">{t('title')}</h1>
      <p className="text-sm text-muted-foreground mb-8">{t('lastUpdated')}</p>

      <div className="space-y-8 text-foreground">
        <section>
          <h2 className="text-2xl font-semibold mb-4">{t('standard.title')}</h2>
          <p className="leading-relaxed">{t('standard.description')}</p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">{t('features.title')}</h2>
          <ul className="list-disc list-inside space-y-2 leading-relaxed">
            <li>{t('features.item1')}</li>
            <li>{t('features.item2')}</li>
            <li>{t('features.item3')}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">{t('contact.title')}</h2>
          <p className="leading-relaxed">{t('contact.description')}</p>
        </section>
      </div>
    </div>
  )
}
