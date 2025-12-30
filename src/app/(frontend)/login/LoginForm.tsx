'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { loginAction } from './actions'
import { toast } from 'sonner'
import { useTranslations } from '@/providers/I18n'
import { Turnstile } from '@marsidev/react-turnstile'

export function LoginForm() {
  const t = useTranslations('auth.login')
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [turnstileToken, setTurnstileToken] = useState<string>('')

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setErrors({})

    const formData = new FormData(event.currentTarget)

    // Client-side validation
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    const clientErrors: Record<string, string> = {}

    if (!email || !email.includes('@')) {
      clientErrors.email = t('errors.invalidEmail')
    }

    if (!password || password.length === 0) {
      clientErrors.password = t('errors.passwordRequired')
    }

    if (!turnstileToken) {
      clientErrors.general = t('errors.captchaRequired')
    }

    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors)
      setIsLoading(false)
      return
    }

    // Add Turnstile token to form data
    formData.set('cf-turnstile-response', turnstileToken)

    try {
      const result = await loginAction(formData)

      if (!result.success) {
        if (result.errors) {
          setErrors(result.errors)
        }
        if (result.message) {
          toast.error(result.message)
        }
      } else {
        toast.success('Welcome back!')
        // Redirect based on user role (handled in server action)
        router.refresh()
      }
    } catch (error) {
      // Re-throw Next.js redirect errors (they're not actually errors)
      if (error && typeof error === 'object' && 'digest' in error) {
        throw error
      }
      toast.error('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <p className="text-sm text-muted-foreground text-center">{t('description')}</p>
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
              required
              disabled={isLoading}
              className={errors.email ? 'border-red-500' : ''}
            />
            {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t('password')}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder={t('passwordPlaceholder')}
              required
              disabled={isLoading}
              className={errors.password ? 'border-red-500' : ''}
            />
            {errors.password && <p className="text-sm text-red-500">{errors.password}</p>}
          </div>

          {/* Cloudflare Turnstile */}
          <div className="flex justify-center">
            <Turnstile
              siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'}
              onSuccess={(token) => setTurnstileToken(token)}
              onError={() => {
                setTurnstileToken('')
                setErrors({ ...errors, general: t('errors.captchaFailed') })
              }}
              onExpire={() => setTurnstileToken('')}
            />
          </div>

          {/* Generic error banner */}
          {errors.general && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{errors.general}</p>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isLoading || !turnstileToken}>
            {isLoading ? t('loggingIn') : t('loginButton')}
          </Button>

          {/* Forgot Password - Placeholder */}
          <div className="text-center">
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
              disabled
            >
              {t('forgotPassword')}
            </button>
          </div>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center">
        <p className="text-sm text-muted-foreground">
          {t('noAccount')}{' '}
          <Link href="/signup" className="text-primary hover:underline">
            {t('signUp')}
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
