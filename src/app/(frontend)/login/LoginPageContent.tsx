'use client'

import { HelpCircle } from 'lucide-react'
import { useTranslations } from '@/ui/web/providers/I18n'
import { LoginForm } from './LoginForm'
import { SystemLink } from '@/infra/loading/components/SystemLink'

export function LoginPageContent() {
  const t = useTranslations('auth.login')

  return (
    <div className="min-h-screen bg-muted flex flex-col items-center justify-center px-4 py-16">
      <h1 className="text-4xl font-bold text-foreground text-center mb-2">{t('headline')}</h1>
      <p className="text-base text-muted-foreground text-center mb-10">{t('headlineSubtitle')}</p>

      <LoginForm />

      <div className="mt-8 text-center">
        <SystemLink
          href="/help"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <HelpCircle size={16} />
          {t('needHelp')}
        </SystemLink>
      </div>
    </div>
  )
}
