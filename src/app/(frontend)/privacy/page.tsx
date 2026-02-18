import { useTranslations } from 'next-intl'

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
              <h3 className="text-xl font-medium mb-2">{t('informationWeCollect.usage.title')}</h3>
              <p className="leading-relaxed">{t('informationWeCollect.usage.description')}</p>
            </div>
            <div>
              <h3 className="text-xl font-medium mb-2">
                {t('informationWeCollect.technical.title')}
              </h3>
              <p className="leading-relaxed">{t('informationWeCollect.technical.description')}</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">{t('howWeUseInformation.title')}</h2>
          <ul className="list-disc list-inside space-y-2 leading-relaxed">
            <li>{t('howWeUseInformation.provide')}</li>
            <li>{t('howWeUseInformation.personalize')}</li>
            <li>{t('howWeUseInformation.communicate')}</li>
            <li>{t('howWeUseInformation.analyze')}</li>
            <li>{t('howWeUseInformation.protect')}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">{t('dataSharing.title')}</h2>
          <p className="leading-relaxed mb-4">{t('dataSharing.description')}</p>
          <ul className="list-disc list-inside space-y-2 leading-relaxed">
            <li>{t('dataSharing.serviceProviders')}</li>
            <li>{t('dataSharing.legal')}</li>
            <li>{t('dataSharing.consent')}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">{t('dataSecurity.title')}</h2>
          <p className="leading-relaxed">{t('dataSecurity.description')}</p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">{t('yourRights.title')}</h2>
          <ul className="list-disc list-inside space-y-2 leading-relaxed">
            <li>{t('yourRights.access')}</li>
            <li>{t('yourRights.correct')}</li>
            <li>{t('yourRights.delete')}</li>
            <li>{t('yourRights.export')}</li>
            <li>{t('yourRights.optOut')}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">{t('dataRetention.title')}</h2>
          <p className="leading-relaxed">{t('dataRetention.description')}</p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">{t('children.title')}</h2>
          <p className="leading-relaxed">{t('children.description')}</p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">{t('cookies.title')}</h2>
          <p className="leading-relaxed">{t('cookies.description')}</p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">{t('changes.title')}</h2>
          <p className="leading-relaxed">{t('changes.description')}</p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">{t('contact.title')}</h2>
          <p className="leading-relaxed">{t('contact.description')}</p>
        </section>
      </div>
    </div>
  )
}
