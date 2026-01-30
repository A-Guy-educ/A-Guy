'use client'

import { detectBrowserLocale } from '@/i18n/config'
import { identify } from '@/infra/analytics/core/tracker'
import { updateCachedUserProperties } from '@/infra/analytics/utils/user-properties-cache'
import { SYSTEM_EVENTS, systemEventBus } from '@/infra/system-events'
import { GoogleLoginButton } from '@/ui/web/auth/GoogleLoginButton'
import { Button } from '@/ui/web/components/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/ui/web/components/card'
import { useTranslations } from '@/ui/web/providers/I18n'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import React, { Suspense, useState } from 'react'
import { toast } from 'sonner'
import { SignupFormFields } from './SignupFormFields'
import { signupAction } from './actions/signup_createUser-action'
import { validateSignupForm } from './actions/signup_validation-action'

function SignupFormContent() {
  const t = useTranslations('auth.signup')
  const tOauth = useTranslations('auth.oauth')
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = searchParams?.get('returnTo') || '/'
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

        // Track registration completed and user resolved
        if (result.userId) {
          systemEventBus.emit(SYSTEM_EVENTS.REGISTRATION_COMPLETED, {
            user_id: result.userId,
            registration_method: 'email',
          })

          // Track user_resolved with enriched user properties
          const userProperties: Record<string, unknown> = {
            user_id: result.userId,
            is_new_user: true,
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

          // Emit user_resolved event via system event bus
          systemEventBus.emit(SYSTEM_EVENTS.USER_RESOLVED, {
            user_id: result.userId,
            is_anonymous: false,
          })

          // Also call identify() to ensure Mixpanel People properties are set
          identify(result.userId, userProperties)
        }

        // Auto-login successful - redirect to returnTo
        router.push(returnTo)
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

export function SignupForm() {
  return (
    <Suspense fallback={<SignupFormSkeleton />}>
      <SignupFormContent />
    </Suspense>
  )
}

function SignupFormSkeleton() {
  const _t = useTranslations('auth.signup')
  return (
    <Card>
      <CardHeader>
        <p className="text-sm text-muted-foreground text-center">
          Fill in the form below to create your account
        </p>
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
            <div className="h-4 w-16 bg-muted animate-pulse rounded" />
            <div className="h-10 bg-muted animate-pulse rounded" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-20 bg-muted animate-pulse rounded" />
            <div className="h-10 bg-muted animate-pulse rounded" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-32 bg-muted animate-pulse rounded" />
            <div className="h-10 bg-muted animate-pulse rounded" />
          </div>
          <div className="h-10 bg-muted animate-pulse rounded" />
        </div>
      </CardContent>
    </Card>
  )
}
