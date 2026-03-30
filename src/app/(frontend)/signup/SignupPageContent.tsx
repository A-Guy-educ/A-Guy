'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { useTranslations } from '@/ui/web/providers/I18n'
import { SignupForm } from './SignupForm'

export function SignupPageContent() {
  const t = useTranslations('auth.signup')

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-primary/5 to-accent/5 py-section-lg">
      {/* Decorative gradient circle */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-accent/10 to-primary/10 blur-3xl pointer-events-none" />

      <div className="relative mx-auto max-w-md w-full px-4">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="text-center mb-8"
        >
          <h1 className="text-display-sm font-bold mb-2">{t('title')}</h1>
          <p className="text-body-md text-muted-foreground">{t('subtitle')}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <SignupForm />
        </motion.div>
      </div>
    </div>
  )
}
