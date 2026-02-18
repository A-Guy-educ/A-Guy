'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

import { GoogleLoginButton } from '@/ui/web/auth/GoogleLoginButton'
import { Card, CardContent, CardHeader } from '@/ui/web/components/card'
import { useTranslations } from '@/ui/web/providers/I18n'

/**
 * Google-only login form.
 *
 * Email/password auth UI was removed (task 21 - Google-only auth).
 * Backend server actions (login_authenticate-action.ts) are preserved
 * so email/password can be re-enabled in the future if needed.
 */
function LoginFormContent() {
  const t = useTranslations('auth.login')
  const searchParams = useSearchParams()
  const returnTo = searchParams?.get('returnTo') || '/'

  return (
    <Card>
      <CardHeader>
        <p className="text-sm text-muted-foreground text-center">{t('subtitle')}</p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center space-y-4">
          <GoogleLoginButton returnTo={returnTo} className="w-full" />
          <p className="text-xs text-muted-foreground text-center">{t('googleOnlyMessage')}</p>
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
    <Card>
      <CardHeader>
        <div className="h-4 w-48 mx-auto bg-muted animate-pulse rounded" />
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center space-y-4">
          <div className="w-full h-10 bg-muted animate-pulse rounded" />
          <div className="h-3 w-64 bg-muted animate-pulse rounded" />
        </div>
      </CardContent>
    </Card>
  )
}
