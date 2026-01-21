'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTranslations } from '@/providers/I18n'
import { loginAction } from './login_authenticate-action'

export function LoginForm() {
  const t = useTranslations('auth.login')
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const queryError = searchParams.get('error')
  const queryReturnTo = searchParams.get('returnTo')
  const queryLinkGoogle = searchParams.get('linkGoogle') === '1'

  const sanitizeReturnTo = (value?: string | null) => {
    if (!value) return undefined
    if (!value.startsWith('/')) return undefined
    if (value.startsWith('//')) return undefined
    return value
  }

  const returnTo = sanitizeReturnTo(queryReturnTo)
  const resolvedError = error || queryError
  const showLinkGoogleButton = queryError === 'account_exists' || queryLinkGoogle
  const signupHref = returnTo ? `/signup?returnTo=${encodeURIComponent(returnTo)}` : '/signup'

  const isFormValid = email.trim() !== '' && password.trim() !== ''

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setError(null)

    const formData = new FormData(event.currentTarget)
    const result = await loginAction(formData)

    if (result.success) {
      window.dispatchEvent(new Event('auth:changed'))
      if (queryError === 'account_exists') {
        const linkParams = new URLSearchParams()
        linkParams.set('linkGoogle', '1')
        if (returnTo) {
          linkParams.set('returnTo', returnTo)
        }
        router.push(`/login?${linkParams.toString()}`)
        router.refresh()
        return
      }

      router.push(result.redirectTo || returnTo || '/')
      router.refresh()
      return
    }

    setError(result.error || 'invalidCredentials')
    setIsLoading(false)
  }

  return (
    <Card>
      <CardHeader>
        <p className="text-sm text-muted-foreground text-center">{t('subtitle')}</p>
      </CardHeader>
      <CardContent>
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

          <input type="hidden" name="returnTo" value={returnTo ?? ''} />

          {resolvedError && (
            <p className="text-sm text-destructive">{t(`errors.${resolvedError}`)}</p>
          )}

          {showLinkGoogleButton && (
            <Link
              href={`/api/auth/google?mode=link${
                returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ''
              }`}
              className="block text-center text-sm text-primary hover:underline"
            >
              {t('linkGoogle')}
            </Link>
          )}

          <Button type="submit" className="w-full" disabled={!isFormValid || isLoading}>
            {isLoading ? t('loggingIn') : t('loginButton')}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center">
        <p className="text-sm text-muted-foreground">
          {t('noAccount')}{' '}
          <Link href={signupHref} className="text-primary hover:underline">
            {t('signupLink')}
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
