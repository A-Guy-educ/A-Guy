'use client'

import { useTranslations } from '@/ui/web/providers/I18n'
import { LoginForm } from './LoginForm'

interface LoginPageContentProps {
  returnTo?: string
}

export function LoginPageContent({ returnTo }: LoginPageContentProps) {
  const t = useTranslations('auth.login')

  return (
    <div className="container py-16">
      <div className="mx-auto max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <LoginForm returnTo={returnTo} />
      </div>
    </div>
  )
}
