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
    <Card className="max-w-md w-full mx-auto rounded-xl shadow-lg">
      <CardHeader className="p-8 pb-0">
        <div className="w-12 h-0.5 bg-accent mx-auto mb-4" />
        <p className="text-base font-medium text-foreground text-center">{t('quickEntry')}</p>
      </CardHeader>
      <CardContent className="p-8 pt-4">
        <div className="flex flex-col items-center space-y-4">
          <GoogleLoginButton returnTo={returnTo} className="w-full" />

          <Button variant="secondary" className="w-full" asChild>
            <SystemLink href="/signup">{t('signupCTA')}</SystemLink>
          </Button>

          <div className="pt-2 pb-4">
            <p className="text-xs text-muted-foreground text-center">{t('footerSecure')}</p>
            <p className="text-xs text-muted-foreground text-center">{t('footerOneClick')}</p>
          </div>

          {passwordEnabled && (
            <>
              <div className="flex items-center w-full gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">{tOauth('orDivider')}</span>
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
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? t('loggingIn') : t('loginButton')}
                </Button>
              </form>
            </>
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
    <Card className="max-w-md w-full mx-auto rounded-xl shadow-lg">
      <CardHeader className="p-8 pb-0">
        <div className="w-12 h-0.5 bg-accent mx-auto mb-4 animate-pulse" />
        <div className="h-4 w-32 mx-auto bg-muted animate-pulse rounded" />
      </CardHeader>
      <CardContent className="p-8 pt-4">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-full h-10 bg-muted animate-pulse rounded" />
          <div className="w-full h-10 bg-muted animate-pulse rounded" />
          <div className="h-3 w-48 bg-muted animate-pulse rounded" />
          <div className="h-3 w-40 bg-muted animate-pulse rounded" />
        </div>
      </CardContent>
    </Card>
  )
}
