'use client'

import React, { useEffect, useRef } from 'react'
import { X, Menu } from 'lucide-react'
import { CMSLink } from '@/ui/web/Link'
import { SystemLink } from '@/infra/loading/components/SystemLink'
import { SearchIcon } from 'lucide-react'
import type { Header as HeaderType, User } from '@/payload-types'
import { LanguageSwitcher } from '@/ui/web/LanguageSwitcher'
import { usePasswordLogin } from '@/ui/web/providers/PasswordLoginProvider'
import { useTranslations } from '@/ui/web/providers/I18n'
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
  const allNavItems = data?.navItems || []
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
        data-testid="mobile-menu-overlay"
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      <div
        ref={portalContainerRef}
        data-testid="mobile-menu-panel"
        className={`fixed top-0 end-0 h-full w-[280px] sm:w-[320px] bg-background border-s border-border z-[70] transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'
        }`}
      >
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-lg font-semibold">{tMenu('title')}</h2>
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onClose()
            }}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Close menu"
            type="button"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex flex-col h-[calc(100%-73px)] overflow-y-auto">
          {user?.name && (
            <div className="px-6 py-4 border-b border-border bg-muted/30">
              <p className="text-sm text-muted-foreground">{tCommon('welcome')}</p>
              <p className="text-base font-semibold mt-1">{user.name}</p>
            </div>
          )}

          {primaryLinks.length > 0 && (
            <div className="px-6 py-4 border-b border-border">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {tMenu('navigation')}
              </h3>
              <div className="flex flex-col gap-2">
                {primaryLinks.map(({ link }, i) => (
                  <div key={i} onClick={onClose}>
                    <CMSLink
                      {...link}
                      appearance="link"
                      className="block py-2 px-3 rounded-lg hover:bg-muted transition-colors text-base"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {secondaryLinks.length > 0 && (
            <div className="px-6 py-4 border-b border-border">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {tMenu('resources')}
              </h3>
              <div className="flex flex-col gap-2">
                {secondaryLinks.map(({ link }, i) => (
                  <div key={i} onClick={onClose}>
                    <CMSLink
                      {...link}
                      appearance="link"
                      className="block py-2 px-3 rounded-lg hover:bg-muted transition-colors text-base"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="px-6 py-4 border-b border-border">
            <SystemLink
              href="/search"
              onClick={onClose}
              className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted transition-colors"
            >
              <SearchIcon className="w-5 h-5 text-primary" />
              <span className="text-base">{tMenu('search')}</span>
            </SystemLink>
          </div>

          <div className="px-6 py-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {tMenu('language')}
            </h3>
            <LanguageSwitcher portalContainer={portalContainerRef.current} />
          </div>

          <div className="px-6 py-4 border-t border-border mt-auto">
            <MobileMenuAuthSection user={user} isAuthLoading={isAuthLoading} onClose={onClose} />
          </div>

          {/* Version number - mobile only */}
          <div className="px-6 py-4 border-t border-border">
            <p className="text-xs text-muted-foreground/70 font-normal text-center">v{version}</p>
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
