'use client'

import React from 'react'
import { useTranslations } from '@/ui/providers/I18n'
import { SignupForm } from './SignupForm'

export function SignupPageContent() {
  const t = useTranslations('auth.signup')

  return (
    <div className="container py-16">
      <div className="mx-auto max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <SignupForm />
      </div>
    </div>
  )
}
