'use client'

import type { User } from '@/payload-types'
import { PageTransition } from '@/ui/web/components/page-transition'
import { useTranslations } from '@/ui/web/providers/I18n'
import { AccountHub } from './_components/AccountHub'

export function AccountPageContent({
  user,
  initialSection,
}: {
  user: User
  initialSection?: string
}) {
  const t = useTranslations('auth.account')

  return (
    <PageTransition>
      <div className="container py-section-md">
        <div className="mx-auto max-w-2xl space-y-content-gap">
          <h1 className="text-display-sm font-bold">{t('title')}</h1>
          <AccountHub user={user} initialSection={initialSection} />
        </div>
      </div>
    </PageTransition>
  )
}
