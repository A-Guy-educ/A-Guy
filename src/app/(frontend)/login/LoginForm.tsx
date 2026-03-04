'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'

import { GoogleLoginButton } from '@/ui/web/auth/GoogleLoginButton'
import { Button } from '@/ui/web/components/button'
import { Card, CardContent, CardHeader } from '@/ui/web/components/card'
import { Input } from '@/ui/web/components/input'
import { Label } from '@/ui/web/components/label'
import { SystemLink } from '@/infra/loading/components/SystemLink'
import { usePasswordLogin } from '@/ui/web/providers/PasswordLoginProvider'
import { useTranslations } from '@/ui/web/providers/I18n'
import { loginAction } from './login_authenticate-action'

function LoginFormContent() {
  const t = useTranslations('auth.login')
  const tOauth = useTranslations('auth.oauth')
  const passwordEnabled = usePasswordLogin()
  const searchParams = useSearchParams()
  const returnTo = searchParams?.get('returnTo') || '/'
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
    <Card className="p-card-padding">
      <CardHeader className="pb-card-padding-sm">
        <p className="text-body-sm text-muted-foreground text-center">{t('subtitle')}</p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-content-gap">
          <GoogleLoginButton returnTo={returnTo} className="w-full" />

          {passwordEnabled && (
            <>
              <div className="flex items-center w-full gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-body-xs text-muted-foreground">{tOauth('orDivider')}</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <form onSubmit={handleSubmit} className="w-full gap-content-gap-sm">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="email">{t('email')}</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder={t('emailPlaceholder')}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
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

              <p className="text-body-sm text-muted-foreground">
                {t('noAccount')}{' '}
                <SystemLink href="/signup" className="underline hover:no-underline">
                  {t('signupLink')}
                </SystemLink>
              </p>
            </>
          )}

          {!passwordEnabled && (
            <p className="text-body-xs text-muted-foreground text-center">
              {t('googleOnlyMessage')}
            </p>
          )}
        </div>
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
    <Card className="p-card-padding">
      <CardHeader className="pb-card-padding-sm">
        <div className="h-4 w-48 mx-auto bg-muted animate-pulse rounded" />
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-content-gap">
          <div className="w-full h-10 bg-muted animate-pulse rounded" />
          <div className="h-3 w-64 bg-muted animate-pulse rounded" />
        </div>
      </CardContent>
    </Card>
  )
}
