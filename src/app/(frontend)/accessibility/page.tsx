'use client'
import { useTranslations } from 'next-intl'

export default function AccessibilityPage() {
  const t = useTranslations('legal.accessibility')

  return (
    <div className="container mx-auto py-12 px-4 max-w-4xl">
      <h1 className="text-4xl font-bold mb-2">{t('title')}</h1>
      <p className="text-sm text-muted-foreground mb-8">{t('lastUpdated')}</p>

      <div className="space-y-8 text-foreground">
        <section>
          <h2 className="text-2xl font-semibold mb-4">{t('commitment.title')}</h2>
          <p className="leading-relaxed">{t('commitment.description')}</p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">{t('standards.title')}</h2>
          <p className="leading-relaxed">{t('standards.description')}</p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">{t('features.title')}</h2>
          <ul className="list-disc list-inside space-y-2 leading-relaxed">
            <li>{t('features.keyboard')}</li>
            <li>{t('features.screenReader')}</li>
            <li>{t('features.contrast')}</li>
            <li>{t('features.text')}</li>
            <li>{t('features.rtl')}</li>
            <li>{t('features.captions')}</li>
            <li>{t('features.focus')}</li>
            <li>{t('features.responsive')}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">{t('languages.title')}</h2>
          <p className="leading-relaxed">{t('languages.description')}</p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">{t('testing.title')}</h2>
          <p className="leading-relaxed">{t('testing.description')}</p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">{t('compatibility.title')}</h2>
          <p className="leading-relaxed">{t('compatibility.description')}</p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">{t('feedback.title')}</h2>
          <p className="leading-relaxed mb-2">{t('feedback.description')}</p>
          <p className="leading-relaxed mb-2 font-medium">{t('feedback.email')}</p>
          <p className="leading-relaxed">{t('feedback.commitment')}</p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">{t('limitations.title')}</h2>
          <p className="leading-relaxed mb-4">{t('limitations.description')}</p>
          <ul className="list-disc list-inside space-y-2 leading-relaxed">
            <li>{t('limitations.thirdParty')}</li>
            <li>{t('limitations.legacy')}</li>
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
