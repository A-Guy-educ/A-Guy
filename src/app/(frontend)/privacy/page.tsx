'use client'
import { useTranslations } from '@/ui/web/providers/I18n'

export default function PrivacyPage() {
  const t = useTranslations('legal.privacy')

  return (
    <div className="container mx-auto py-12 px-4 max-w-4xl">
      <h1 className="text-4xl font-bold mb-2">{t('title')}</h1>
      <p className="text-sm text-muted-foreground mb-8">{t('lastUpdated')}</p>

      <div className="space-y-8 text-foreground">
        <section>
          <h2 className="text-2xl font-semibold mb-4">{t('intro.title')}</h2>
          <p className="leading-relaxed">{t('intro.description')}</p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">{t('informationWeCollect.title')}</h2>
          <ul className="list-disc list-inside space-y-2 leading-relaxed">
            <li>{t('informationWeCollect.account')}</li>
            <li>{t('informationWeCollect.aiInteractions')}</li>
            <li>{t('informationWeCollect.usage')}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">{t('howWeUseInformation.title')}</h2>
          <p className="leading-relaxed">{t('howWeUseInformation.description')}</p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">{t('dataSecurity.title')}</h2>
          <p className="leading-relaxed">{t('dataSecurity.description')}</p>
        </section>
      </div>
    </div>
  )
}
