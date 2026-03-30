'use client'

import React, { useEffect, useRef } from 'react'
import { X, Menu } from 'lucide-react'
import { CMSLink } from '@/ui/web/Link'
import type { Header as HeaderType, User } from '@/payload-types'
import { LanguageSwitcher } from '@/ui/web/LanguageSwitcher'
import { usePasswordLogin } from '@/ui/web/providers/PasswordLoginProvider'
import { useTranslations, useLocale } from '@/ui/web/providers/I18n'
import { getNavItemsForLocale } from '@/ui/web/nav-variants'
import { CourseSearch } from '@/ui/web/header/CourseSearch'
import { MobileMenuAuthSection } from './MobileMenuAuthSection'

interface MobileMenuProps {
  isOpen: boolean
  onClose: () => void
  data: HeaderType
  user: User | null
  isAuthLoading: boolean
  version: string
}

export const MobileMenu: React.FC<MobileMenuProps> = ({
  isOpen,
  onClose,
  data,
  user,
  isAuthLoading,
  version,
}) => {
  const tCommon = useTranslations('common.header')
  const tMenu = useTranslations('common.mobileMenu')
  const passwordLogin = usePasswordLogin()
  const systemLocale = useLocale()

  const allNavItems = getNavItemsForLocale(data, systemLocale)
  const navItems = passwordLogin
    ? allNavItems
    : allNavItems.filter(({ link }) => link?.url !== '/signup')
  const portalContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  const primaryLinks = navItems.slice(0, Math.ceil(navItems.length / 2))
  const secondaryLinks = navItems.slice(Math.ceil(navItems.length / 2))

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] transition-opacity duration-slow ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      <div
        ref={portalContainerRef}
        className={`fixed top-0 right-0 h-full w-[280px] sm:w-[320px] bg-background border-l border-border z-[70] transform transition-transform duration-slow ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-card-padding border-b border-border">
          <h2 className="text-body-lg font-semibold">{tMenu('title')}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex flex-col h-[calc(100%-73px)] overflow-y-auto">
          {user?.name && (
            <div className="px-6 py-section-xs border-b border-border bg-muted/30">
              <p className="text-body-sm text-muted-foreground">{tCommon('welcome')}</p>
              <p className="text-body-md font-semibold mt-1">{user.name}</p>
            </div>
          )}

          {primaryLinks.length > 0 && (
            <div className="px-6 py-section-xs border-b border-border">
              <h3 className="text-body-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {tMenu('navigation')}
              </h3>
              <div className="flex flex-col gap-content-gap-xs">
                {primaryLinks.map(({ link }, i) => (
                  <div key={i} onClick={onClose}>
                    <CMSLink
                      {...link}
                      appearance="link"
                      className="block py-2 px-3 rounded-lg hover:bg-muted transition-colors text-body-md"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {secondaryLinks.length > 0 && (
            <div className="px-6 py-section-xs border-b border-border">
              <h3 className="text-body-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {tMenu('resources')}
              </h3>
              <div className="flex flex-col gap-content-gap-xs">
                {secondaryLinks.map(({ link }, i) => (
                  <div key={i} onClick={onClose}>
                    <CMSLink
                      {...link}
                      appearance="link"
                      className="block py-2 px-3 rounded-lg hover:bg-muted transition-colors text-body-md"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <CourseSearch variant="mobile" onNavigate={onClose} />

          <div className="px-6 py-section-xs">
            <h3 className="text-body-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {tMenu('language')}
            </h3>
            <LanguageSwitcher portalContainer={portalContainerRef.current} />
          </div>

          <div className="px-6 py-section-xs border-t border-border mt-auto">
            <MobileMenuAuthSection user={user} isAuthLoading={isAuthLoading} onClose={onClose} />
          </div>

          {/* Version number - mobile only */}
          <div className="px-6 py-section-xs border-t border-border">
            <p className="text-body-xs text-muted-foreground/70 font-normal text-center">
              v{version}
            </p>
          </div>
        </nav>
      </div>
    </>
  )
}

export const MobileMenuButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="p-2 rounded-lg hover:bg-muted transition-colors lg:hidden text-foreground"
      aria-label="Open menu"
    >
      <Menu className="w-6 h-6 text-foreground" />
    </button>
  )
}
