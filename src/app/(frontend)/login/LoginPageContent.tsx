'use client'

import { useTranslations } from '@/ui/web/providers/I18n'
import { LoginForm } from './LoginForm'

export function LoginPageContent() {
  const t = useTranslations('auth.login')

  return (
    <div className="container py-16">
      <div className="mx-auto max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
