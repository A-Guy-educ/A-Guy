'use client'

import { Button } from '@/ui/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/ui/ui/card'
import { detectBrowserLocale } from '@/i18n/config'
import { PRODUCT_EVENTS } from '@/infra/analytics/contracts/events'
import { useAnalytics } from '@/infra/analytics/providers/AnalyticsProvider'
import { updateCachedUserProperties } from '@/infra/analytics/utils/user-properties-cache'
import { useTranslations } from '@/ui/providers/I18n'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useState } from 'react'
import { toast } from 'sonner'
import { SignupFormFields } from './SignupFormFields'
import { signupAction } from './actions/signup_createUser-action'
import { validateSignupForm } from './actions/signup_validation-action'
import { GoogleLoginButton } from '@/ui/web/auth/GoogleLoginButton'

export function SignupForm() {
  const t = useTranslations('auth.signup')
  const tOauth = useTranslations('auth.oauth')
  const router = useRouter()
  const analytics = useAnalytics()
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

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
        toast.error(result.message || 'Signup failed')
      } else {
        toast.success('Account created successfully!')

        // Track registration completed and user identified
        if (result.userId) {
          analytics.track(PRODUCT_EVENTS.REGISTRATION_COMPLETED, {
            user_id: result.userId,
            auth_method: 'email',
          })

          // Track user_identified with enriched user properties
          const userProperties: Record<string, unknown> = {
            user_id: result.userId,
            is_new_user: true,
            auth_method: 'email',
            signup_date: new Date().toISOString(),
            role: 'student', // Default role for new signups
          }

          // Add email and name from form (using Mixpanel reserved properties)
          const email = formData.get('email') as string
          const name = formData.get('name') as string
          if (email) {
            userProperties.$email = email
          }
          if (name) {
            userProperties.$name = name
          }

          // Add locale from browser
          if (typeof window !== 'undefined') {
            userProperties.locale = detectBrowserLocale()
          }

          // Cache user properties for future sessions
          updateCachedUserProperties(userProperties)

          // Track event with enriched properties
          analytics.track(PRODUCT_EVENTS.USER_IDENTIFIED, userProperties)

          // Also call identify() to ensure Mixpanel People properties are set
          analytics.identify(result.userId, userProperties)
        }

        // Auto-login successful - redirect to home
        router.push('/')
        router.refresh()
      }
    } catch (_error) {
      toast.error('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <p className="text-sm text-muted-foreground text-center">
          Fill in the form below to create your account
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <GoogleLoginButton returnTo="/" className="w-full" />
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
          <SignupFormFields t={t} isLoading={isLoading} errors={errors} />

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? t('creatingAccount') : t('createAccount')}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center">
        <p className="text-sm text-muted-foreground">
          {t('alreadyHaveAccount')}{' '}
          <Link href="/login" className="text-primary hover:underline">
            {t('login')}
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
