'use client'

import { HelpCircle } from 'lucide-react'

import { SystemLink } from '@/infra/loading/components/SystemLink'
import { useTranslations } from '@/ui/web/providers/I18n'
import { LoginForm } from './LoginForm'

export function LoginPageContent() {
  const t = useTranslations('auth.login')

  return (
    <div className="min-h-[calc(100vh-200px)] flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 py-12">
      {/* Hero Section */}
      <div className="text-center mb-6 px-4">
        <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
          {t('headingRest')}
        </h1>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-lg px-4">
        <LoginForm />
      </div>

      {/* Help Link */}
      <div className="mt-8 text-center">
        <SystemLink
          href="mailto:support@aguy.co.il"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <HelpCircle className="w-4 h-4" />
          {t('needHelp')}
        </SystemLink>
      </div>
    </div>
  )
}
