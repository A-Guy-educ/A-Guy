'use client'

import Link from 'next/link'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/ui/web/components/dialog'
import { GoogleLoginButton } from '@/ui/web/auth/GoogleLoginButton'
import { useTranslations } from '@/ui/web/providers/I18n'

interface AuthGateModalProps {
  isOpen: boolean
  title: string
  description: string
  returnTo: string
}

export function AuthGateModal({ isOpen, title, description, returnTo }: AuthGateModalProps) {
  const t = useTranslations('accessControl')

  return (
    <Dialog open={isOpen}>
      <DialogContent allowDismiss={false} className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle className="text-xl">{title}</DialogTitle>
          <DialogDescription className="mt-2">{description}</DialogDescription>
        </DialogHeader>
        <div className="mt-4 flex flex-col items-center gap-3">
          <GoogleLoginButton returnTo={returnTo} className="w-full" />
          <Link
            href="/courses"
            className="text-sm text-muted-foreground underline hover:text-foreground"
          >
            {t('browseCourses')}
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  )
}
