'use client'

import { useTranslations } from '@/ui/web/providers/I18n'
import { LoginForm } from './LoginForm'

export function LoginPageContent() {
  const t = useTranslations('auth.login')

  return (
    <div className="flex min-h-screen items-center justify-center py-section-md px-4">
      <div className="w-full max-w-[400px]">
        <div className="text-center mb-card-padding-lg">
          <h1 className="text-heading-xl text-foreground">{t('title')}</h1>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
