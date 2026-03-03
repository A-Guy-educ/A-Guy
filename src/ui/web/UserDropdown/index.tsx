'use client'

import { useState } from 'react'
import { SystemLink } from '@/infra/loading/components/SystemLink'
import { useRouter } from 'next/navigation'
import { LogOut, User as UserIcon } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/web/components/dropdown-menu'
import { UserAvatar } from '@/ui/web/UserAvatar'
import { useTranslations } from '@/ui/web/providers/I18n'
import { logoutAction } from '@/app/(frontend)/actions/auth-action'
import { analytics } from '@/infra/analytics'
import type { User } from '@/payload-types'

export function UserDropdown({ user }: { user: User }) {
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const t = useTranslations('common.header')

  async function handleLogout() {
    setIsLoggingOut(true)
    analytics.reset()
    await logoutAction()
    window.dispatchEvent(new Event('auth:changed'))
    router.push('/login')
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger data-testid="user-dropdown" className="focus:outline-none">
        <UserAvatar name={user.name || 'User'} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium">{user.name}</p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <SystemLink href="/account" className="flex items-center gap-2">
            <UserIcon className="w-4 h-4" />
            {t('myAccount')}
          </SystemLink>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="w-4 h-4 me-2" />
          {isLoggingOut ? t('loggingOut') : t('logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
