'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogOut, User as UserIcon } from 'lucide-react'

import type { User } from '@/payload-types'

import { Button } from '@/ui/web/components/button'
import { logoutAction } from '@/app/(frontend)/actions/auth-action'
import { useTranslations } from '@/ui/web/providers/I18n'

interface MobileMenuAuthSectionProps {
  user: User | null
  isAuthLoading: boolean
  onClose: () => void
}

export function MobileMenuAuthSection({
  user,
  isAuthLoading,
  onClose,
}: MobileMenuAuthSectionProps) {
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const tCommon = useTranslations('common.header')

  if (isAuthLoading) {
    return <div className="h-9" aria-hidden="true" />
  }

  if (user) {
    return (
      <div className="flex flex-col gap-2">
        <Button variant="ghost" asChild className="justify-start gap-2">
          <Link href="/account" onClick={onClose}>
            <UserIcon className="w-4 h-4" />
            {tCommon('myAccount')}
          </Link>
        </Button>
        <Button
          variant="ghost"
          className="justify-start gap-2 text-destructive hover:text-destructive"
          onClick={async () => {
            setIsLoggingOut(true)
            try {
              await logoutAction()
              window.dispatchEvent(new Event('auth:changed'))
              onClose()
              router.push('/login')
              router.refresh()
            } finally {
              setIsLoggingOut(false)
            }
          }}
          disabled={isLoggingOut}
        >
          <LogOut className="w-4 h-4" />
          {isLoggingOut ? tCommon('loggingOut') : tCommon('logout')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="ghost" asChild className="justify-start">
        <Link href="/login" onClick={onClose}>
          {tCommon('login')}
        </Link>
      </Button>
      <Button asChild className="justify-start">
        <Link href="/signup" onClick={onClose}>
          {tCommon('signup')}
        </Link>
      </Button>
    </div>
  )
}
