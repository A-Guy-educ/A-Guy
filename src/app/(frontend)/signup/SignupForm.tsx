'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { useAnalytics } from '@/lib/analytics/providers/AnalyticsProvider'
import { useTranslations } from '@/providers/I18n'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import React, { useState } from 'react'
import { toast } from 'sonner'
import { SignupFormFields } from './SignupFormFields'
import { signupAction } from './actions/signup_createUser-action'
import { validateSignupForm } from './actions/signup_validation-action'
import { GoogleSignupButton } from './GoogleSignupButton'
import { trackRegistrationSuccess } from './signup_trackRegistration'

export function SignupForm() {
  const t = useTranslations('auth.signup')
  const router = useRouter()
  const searchParams = useSearchParams()
  const analytics = useAnalytics()
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const sanitizeReturnTo = (value?: string | null) => {
    if (!value) return undefined
    if (!value.startsWith('/')) return undefined
    if (value.startsWith('//')) return undefined
    return value
  }

  const returnTo = sanitizeReturnTo(searchParams.get('returnTo'))

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setErrors({})

    const formData = new FormData(event.currentTarget)

    // Client-side validation
    const clientErrors = validateSignupForm(formData, t)

    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors)
      setIsLoading(false)
      return
    }

    try {
      const result = await signupAction(formData)

      if (!result.success) {
        if (result.errors) {
          setErrors(result.errors)
        }
        toast.error(result.message || t('signupFailed'))
      } else {
        toast.success(t('signupSuccess'))

        // Track registration completed and user identified
        if (result.userId) {
          trackRegistrationSuccess({ analytics, formData, userId: result.userId })
        }

        // Auto-login successful - redirect to home
        router.push(returnTo || '/')
        router.refresh()
      }
    } catch (_error) {
      toast.error(t('unexpectedError'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <p className="text-sm text-muted-foreground text-center">{t('signupDescription')}</p>
        <p className="mt-2 text-xs text-muted-foreground text-center">{t('oneMethodOnly')}</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <GoogleSignupButton label={t('continueWithGoogle')} returnTo={returnTo} />
        </div>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-background px-2 text-muted-foreground">{t('orContinueWith')}</span>
          </div>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <SignupFormFields t={t} isLoading={isLoading} errors={errors} />

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? t('creatingAccount') : t('createAccount')}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center">
        <p className="text-sm text-muted-foreground">
          {t('alreadyHaveAccount')}{' '}
          <Link
            href={returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login'}
            className="text-primary hover:underline"
          >
            {t('login')}
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
