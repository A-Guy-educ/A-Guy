'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'

import { GoogleLoginButton } from '@/ui/web/auth/GoogleLoginButton'
import { Button } from '@/ui/web/components/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/ui/web/components/card'
import { Input } from '@/ui/web/components/input'
import { Label } from '@/ui/web/components/label'
import { useTranslations } from '@/ui/web/providers/I18n'
import { loginAction } from './login_authenticate-action'
import { useAsyncAction } from '@/infra/loading/hooks/useAsyncAction'
import { useRouterWithLoading } from '@/infra/loading/hooks/useRouterWithLoading'
import { LOADING_KEYS } from '@/infra/loading/keys'
import { SystemLink } from '@/infra/loading/components/SystemLink'
import { Spinner } from '@/infra/loading/components/Spinner'

function LoginFormContent() {
  const t = useTranslations('auth.login')
  const tOauth = useTranslations('auth.oauth')
  const router = useRouterWithLoading()
  const searchParams = useSearchParams()
  const returnTo = searchParams?.get('returnTo') || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { execute: executeLogin, isLoading } = useAsyncAction(
    (formData: FormData) => loginAction(formData),
    { key: LOADING_KEYS.LOGIN },
  )

  const isFormValid = email.trim() !== '' && password.trim() !== ''

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const formData = new FormData(event.currentTarget)
    const result = await executeLogin(formData)

    if (result.success) {
      window.dispatchEvent(new Event('auth:changed'))
      router.push(returnTo)
      router.refresh()
      return
    }

    setError(result.error || 'invalidCredentials')
  }

  return (
    <Card>
      <CardHeader>
        <p className="text-sm text-muted-foreground text-center">{t('subtitle')}</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <GoogleLoginButton returnTo={returnTo} className="w-full" />
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                {tOauth('orDivider')}
              </span>
            </div>
          </div>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('email')}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder={t('emailPlaceholder')}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t('password')}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder={t('passwordPlaceholder')}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          {error && <p className="text-sm text-destructive">{t(`errors.${error}`)}</p>}

          <Button type="submit" className="w-full" disabled={!isFormValid || isLoading}>
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Spinner size="sm" />
                {t('loggingIn')}
              </span>
            ) : (
              t('loginButton')
            )}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center">
        <p className="text-sm text-muted-foreground">
          {t('noAccount')}{' '}
          <SystemLink href="/signup" className="text-primary hover:underline">
            {t('signupLink')}
          </SystemLink>
        </p>
      </CardFooter>
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
  const t = useTranslations('auth.login')
  return (
    <Card>
      <CardHeader>
        <p className="text-sm text-muted-foreground text-center">{t('subtitle')}</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="w-full h-10 bg-muted animate-pulse rounded" />
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
          </div>
        </div>
        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <div className="h-4 w-20 bg-muted animate-pulse rounded" />
            <div className="h-10 bg-muted animate-pulse rounded" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-24 bg-muted animate-pulse rounded" />
            <div className="h-10 bg-muted animate-pulse rounded" />
          </div>
          <div className="h-10 bg-muted animate-pulse rounded" />
        </div>
      </CardContent>
    </Card>
  )
}
