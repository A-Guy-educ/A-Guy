'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTranslations } from '@/providers/I18n'
import { loginAction } from './login_authenticate-action'

export function LoginForm() {
  const t = useTranslations('auth.login')
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isFormValid = email.trim() !== '' && password.trim() !== ''

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setError(null)

    const formData = new FormData(event.currentTarget)
    const result = await loginAction(formData)

    if (result.success) {
      router.push('/')
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

          {error && <p className="text-sm text-destructive">{t(`errors.${error}`)}</p>}

          <Button type="submit" className="w-full" disabled={!isFormValid || isLoading}>
            {isLoading ? t('loggingIn') : t('loginButton')}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center">
        <p className="text-sm text-muted-foreground">
          {t('noAccount')}{' '}
          <Link href="/signup" className="text-primary hover:underline">
            {t('signupLink')}
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
