'use client'

import type { User } from '@/payload-types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useTranslations } from '@/providers/I18n'

export function AccountPageContent({ user }: { user: User }) {
  const t = useTranslations('auth.account')

  return (
    <div className="container py-16">
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>{t('title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">{t('name')}</p>
              <p className="text-base font-medium">{user.name || t('missing')}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('email')}</p>
              <p className="text-base font-medium">{user.email}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
