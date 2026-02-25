'use client'

import type { User } from '@/payload-types'
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
    <div className="container py-16">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <AccountHub user={user} initialSection={initialSection} />
      </div>
    </div>
  )
}
