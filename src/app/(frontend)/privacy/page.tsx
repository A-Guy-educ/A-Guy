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
          <p className="leading-relaxed">{t('intro')}</p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">{t('informationWeCollect.title')}</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-medium mb-2">
                {t('informationWeCollect.account.title')}
              </h3>
              <p className="leading-relaxed">{t('informationWeCollect.account.description')}</p>
            </div>
            <div>
              <h3 className="text-xl font-medium mb-2">
                {t('informationWeCollect.aiInteractions.title')}
              </h3>
              <p className="leading-relaxed">
                {t('informationWeCollect.aiInteractions.description')}
              </p>
            </div>
            <div>
              <h3 className="text-xl font-medium mb-2">{t('informationWeCollect.usage.title')}</h3>
              <p className="leading-relaxed">{t('informationWeCollect.usage.description')}</p>
            </div>
          </div>
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
