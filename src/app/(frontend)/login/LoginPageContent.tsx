'use client'

import { HelpCircle } from 'lucide-react'
import { motion } from 'framer-motion'

import { SystemLink } from '@/infra/loading/components/SystemLink'
import { useTranslations } from '@/ui/web/providers/I18n'
import { LoginForm } from './LoginForm'

export function LoginPageContent() {
  const t = useTranslations('auth.login')

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-primary/5 to-accent/5 py-section-lg">
      {/* Decorative gradient circle */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-primary/10 to-accent/10 blur-3xl pointer-events-none" />

      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative text-center mb-6 px-4"
      >
        <h1 className="text-display-md md:text-display-lg font-extrabold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
          {t('headingRest')}
        </h1>
      </motion.div>

      {/* Login Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative w-full max-w-md px-4"
      >
        <LoginForm />
      </motion.div>

      {/* Help Link */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="relative mt-8 text-center"
      >
        <SystemLink
          href="mailto:support@aguy.co.il"
          className="inline-flex items-center gap-2 text-body-sm text-muted-foreground hover:text-foreground transition-colors duration-normal"
        >
          <HelpCircle className="w-4 h-4" />
          {t('needHelp')}
        </SystemLink>
      </motion.div>
    </div>
  )
}
