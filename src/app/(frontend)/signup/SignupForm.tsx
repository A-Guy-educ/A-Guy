'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { signupAction } from './actions/signup_createUser-action'
import { toast } from 'sonner'
import { useTranslations } from '@/providers/I18n'
import { SignupFormFields } from './SignupFormFields'
import { validateSignupForm } from './actions/signup_validation-action'
import { useAnalytics } from '@/lib/analytics/providers/AnalyticsProvider'
import { PRODUCT_EVENTS } from '@/lib/analytics/contracts/events'

export function SignupForm() {
  const t = useTranslations('auth.signup')
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
          analytics.track(PRODUCT_EVENTS.USER_IDENTIFIED, {
            user_id: result.userId,
            is_new_user: true,
          })
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
