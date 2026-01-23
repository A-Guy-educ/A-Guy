'use client'

import React from 'react'

import type { Header as HeaderType, User } from '@/payload-types'

import { CMSLink } from '@/ui/web/Link'
import Link from 'next/link'
import { SearchIcon } from 'lucide-react'
import { LanguageSwitcher } from '@/ui/web/LanguageSwitcher'
import { useTranslations } from '@/ui/providers/I18n'
import { Button } from '@/ui/ui/button'
import { UserDropdown } from '@/ui/web/UserDropdown'

interface HeaderNavProps {
  data: HeaderType
  user: User | null
  isAuthLoading: boolean
}

export const HeaderNav: React.FC<HeaderNavProps> = ({ data, user, isAuthLoading }) => {
  const tCommon = useTranslations('common.header')
  const navItems = data?.navItems || []

  // Group navigation items by type
  const primaryLinks = navItems.slice(0, Math.ceil(navItems.length / 2))
  const secondaryLinks = navItems.slice(Math.ceil(navItems.length / 2))

  return (
    <nav className="flex gap-6 items-center">
      {/* User Greeting */}
      {user?.name && (
        <div className="hidden xl:flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30">
          <span className="text-sm text-muted-foreground">{tCommon('welcome')}</span>
          <span className="text-sm font-semibold">{user.name}</span>
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
      <Link
        href="/search"
        className="p-2 rounded-lg hover:bg-hover transition-colors"
        aria-label="Search"
      >
        <SearchIcon className="w-5" />
      </Link>

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
          <div data-testid="header-auth-buttons" className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">{tCommon('login')}</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/signup">{tCommon('signup')}</Link>
            </Button>
          </div>
        )}
      </div>
    </nav>
  )
}
