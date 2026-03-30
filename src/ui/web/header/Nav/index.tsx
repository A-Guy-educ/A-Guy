'use client'

import React from 'react'

import type { Header as HeaderType, User } from '@/payload-types'

import { CMSLink } from '@/ui/web/Link'
import { SystemLink } from '@/infra/loading/components/SystemLink'
import { LanguageSwitcher } from '@/ui/web/LanguageSwitcher'
import { CourseSearch } from '@/ui/web/header/CourseSearch'
import { usePasswordLogin } from '@/ui/web/providers/PasswordLoginProvider'
import { useTranslations, useLocale } from '@/ui/web/providers/I18n'
import { Button } from '@/ui/web/components/button'
import { UserDropdown } from '@/ui/web/UserDropdown'
import { getNavItemsForLocale } from '@/ui/web/nav-variants'

interface HeaderNavProps {
  data: HeaderType
  user: User | null
  isAuthLoading: boolean
}

export const HeaderNav: React.FC<HeaderNavProps> = ({ data, user, isAuthLoading }) => {
  const tCommon = useTranslations('common.header')
  const passwordLogin = usePasswordLogin()
  const systemLocale = useLocale()

  const allNavItems = getNavItemsForLocale(data, systemLocale)
  const navItems = passwordLogin
    ? allNavItems
    : allNavItems.filter(({ link }) => link?.url !== '/signup')

  // Group navigation items by type
  const primaryLinks = navItems.slice(0, Math.ceil(navItems.length / 2))
  const secondaryLinks = navItems.slice(Math.ceil(navItems.length / 2))

  return (
    <nav className="flex gap-content-gap-lg items-center">
      {/* User Greeting */}
      {user?.name && (
        <div className="hidden xl:flex items-center gap-content-gap-xs px-3 py-2 rounded-lg bg-muted/30">
          <span className="text-body-sm text-muted-foreground">{tCommon('welcome')}</span>
          <span className="text-body-sm font-semibold">{user.name}</span>
        </div>
      )}

      {/* Primary Navigation */}
      {primaryLinks.length > 0 && (
        <div className="flex gap-3 items-center">
          {primaryLinks.map(({ link }, i) => (
            <CMSLink key={i} {...link} appearance="link" />
          ))}
        </div>
      )}

      {/* Separator */}
      {primaryLinks.length > 0 && secondaryLinks.length > 0 && (
        <div className="h-6 w-px bg-border" />
      )}

      {/* Secondary Navigation */}
      {secondaryLinks.length > 0 && (
        <div className="flex gap-3 items-center">
          {secondaryLinks.map(({ link }, i) => (
            <CMSLink key={i} {...link} appearance="link" />
          ))}
        </div>
      )}

      {/* Search */}
      <CourseSearch variant="desktop" />

      {/* Separator before language switcher */}
      <div className="h-6 w-px bg-border" />

      {/* Language Switcher */}
      <LanguageSwitcher />

      <div className="h-6 w-px bg-border" />

      <div data-testid="header-auth">
        {isAuthLoading ? (
          <div className="w-24 h-9" aria-hidden="true" />
        ) : user ? (
          <UserDropdown user={user} />
        ) : (
          <div data-testid="header-auth-buttons" className="flex items-center gap-content-gap-xs">
            <Button size="sm" asChild>
              <SystemLink href="/login">{tCommon('login')}</SystemLink>
            </Button>
            {passwordLogin && (
              <Button size="sm" variant="outline" asChild>
                <SystemLink href="/signup">{tCommon('signup')}</SystemLink>
              </Button>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
