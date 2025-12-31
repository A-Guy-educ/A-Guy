'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { signupAction } from './signup_actions'
import { toast } from 'sonner'
import { useTranslations } from '@/providers/I18n'
import { SignupFormFields } from './SignupFormFields'
import { validateSignupForm } from './signup_validation'

export function SignupForm() {
  const t = useTranslations('auth.signup')
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
    const clientErrors = validateSignupForm(formData, turnstileToken, t)

    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors)
      setIsLoading(false)
      return
    }

    // Add Turnstile token to form data
    formData.set('cf-turnstile-response', turnstileToken)

    try {
      const result = await signupAction(formData)

      if (!result.success) {
        if (result.errors) {
          setErrors(result.errors)
        }
        toast.error(result.message || 'Signup failed')
      } else {
        toast.success('Account created successfully!')
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

  function handleTurnstileSuccess(token: string) {
    console.log('Turnstile success:', token ? 'Token received' : 'No token')
    setTurnstileToken(token)
  }

  function handleTurnstileError(error: unknown) {
    console.error('Turnstile error:', error)
    setTurnstileToken('')
    setErrors({ ...errors, general: 'CAPTCHA verification failed. Please try again.' })
  }

  function handleTurnstileExpire() {
    console.log('Turnstile expired')
    setTurnstileToken('')
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
          <SignupFormFields
            t={t}
            isLoading={isLoading}
            errors={errors}
            onTurnstileSuccess={handleTurnstileSuccess}
            onTurnstileError={handleTurnstileError}
            onTurnstileExpire={handleTurnstileExpire}
          />

          <Button type="submit" className="w-full" disabled={isLoading || !turnstileToken}>
            {isLoading ? t('creatingAccount') : t('createAccount')}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center">
        <p className="text-sm text-muted-foreground">
          {t('alreadyHaveAccount')}{' '}
          <Link href="/admin/login" className="text-primary hover:underline">
            {t('login')}
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
