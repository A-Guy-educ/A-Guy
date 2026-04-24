'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'

import Image from 'next/image'

import { GoogleLoginButton } from '@/ui/web/auth/GoogleLoginButton'
import { Button } from '@/ui/web/components/button'
import { Card, CardContent, CardHeader } from '@/ui/web/components/card'
import { Input } from '@/ui/web/components/input'
import { Label } from '@/ui/web/components/label'
import { SystemLink } from '@/infra/loading/components/SystemLink'
import { usePasswordLogin } from '@/ui/web/providers/PasswordLoginProvider'
import { useTranslations } from '@/ui/web/providers/I18n'
import { sanitizeReturnTo } from '@/infra/auth/oauth_sanitize'
import { loginAction } from './login_authenticate-action'
import telescopeSvg from '@/ui/web/TelescopeLogo/telescope.svg'

function LoginFormContent() {
  const t = useTranslations('auth.login')
  const tOauth = useTranslations('auth.oauth')
  const passwordEnabled = usePasswordLogin()
  const searchParams = useSearchParams()
  const returnTo = sanitizeReturnTo(searchParams?.get('returnTo'))
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    try {
      const formData = new FormData(e.currentTarget)
      const result = await loginAction(formData)
      if (result.success) {
        window.location.href = returnTo
      } else {
        setError(t('errors.invalidCredentials'))
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="rounded-2xl shadow-elevation-4 border border-primary/10 bg-card/80 backdrop-blur-xl px-8 py-section-sm">
      <CardHeader className="pb-3">
        {/* Logo */}
        <div className="flex flex-col items-center gap-1">
          <Image src={telescopeSvg} alt="A-Guy" className="h-24 w-auto" width={224} height={204} />
          <p className="text-primary font-semibold">{t('heroSubtitle')}</p>
        </div>
        {/* Section label with decorative line */}
        <div className="flex flex-col items-center mt-3">
          <div className="w-8 h-px bg-border mb-2" />
          <p className="text-body-sm text-muted-foreground">{t('quickLogin')}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Google SSO Button */}
        <GoogleLoginButton
          returnTo={returnTo}
          className="w-full h-14 rounded-xl text-body-md font-semibold"
        />

        {/* Registration Link - appears below Google button when password is disabled */}
        {!passwordEnabled && (
          <>
            <div className="flex justify-center">
              <SystemLink
                href="/signup"
                className="bg-muted text-primary font-bold rounded-full px-6 py-2 text-body-sm hover:bg-primary-soft transition-colors duration-normal inline-block"
              >
                {t('freeRegistration')}
              </SystemLink>
            </div>
            <p className="text-body-sm text-muted-foreground text-center pt-2">
              {t('secureAccess')}
              <br />
              {t('oneClickEntry')}
            </p>
          </>
        )}

        {/* Email/Password Form - appears when password login is enabled */}
        {passwordEnabled && (
          <>
            <div className="flex items-center w-full gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-body-xs text-muted-foreground">{tOauth('orDivider')}</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <form onSubmit={handleSubmit} className="w-full space-y-3">
              <div className="space-y-1">
                <Label htmlFor="email">{t('email')}</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder={t('emailPlaceholder')}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="password">{t('password')}</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder={t('passwordPlaceholder')}
                  required
                />
              </div>
              {error && <p className="text-body-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? t('loggingIn') : t('loginButton')}
              </Button>
            </form>

            {/* Registration Link - appears below form when password is enabled */}
            <div className="flex flex-col items-center gap-2 pt-2">
              <SystemLink
                href="/signup"
                className="bg-muted text-primary font-bold rounded-full px-6 py-2 text-body-sm hover:bg-primary-soft transition-colors duration-normal inline-block"
              >
                {t('freeRegistration')}
              </SystemLink>
              <p className="text-body-sm text-muted-foreground text-center">
                {t('secureAccess')}
                <br />
                {t('oneClickEntry')}
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export function LoginForm() {
  return (
    <Suspense fallback={<LoginFormSkeleton />}>
      <LoginFormContent />
    </Suspense>
  )
}

function LoginFormSkeleton() {
  return (
    <Card className="rounded-2xl shadow-elevation-4 border border-primary/10 bg-card/80 backdrop-blur-xl px-8 py-section-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col items-center gap-1">
          <div className="h-24 w-24 bg-muted animate-pulse rounded-full" />
          <div className="h-4 w-40 bg-muted animate-pulse rounded" />
        </div>
        <div className="flex flex-col items-center mt-4">
          <div className="w-8 h-px bg-border mb-3" />
          <div className="h-4 w-24 mx-auto bg-muted animate-pulse rounded" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="w-full h-14 bg-muted animate-pulse rounded-xl" />
        <div className="h-8 w-32 mx-auto bg-muted animate-pulse rounded-full" />
      </CardContent>
    </Card>
  )
}
