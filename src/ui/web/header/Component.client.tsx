'use client'
import { useHeaderTheme } from '@/ui/web/providers/HeaderTheme'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useEffect, useState } from 'react'

import type { Header } from '@/payload-types'

import { useCurrentUser } from '@/hooks/useCurrentUser'
import { TelescopeLogo } from '@/ui/web/TelescopeLogo'
import { MobileMenu, MobileMenuButton } from './MobileMenu'
import { HeaderNav } from './Nav'

interface HeaderClientProps {
  data: Header
}

export const HeaderClient: React.FC<HeaderClientProps> = ({ data }) => {
  const { user, isLoading: isAuthLoading } = useCurrentUser()
  /* Storing the value in a useState to avoid hydration errors */
  const [theme, setTheme] = useState<string | null>(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const { headerTheme, setHeaderTheme } = useHeaderTheme()
  const pathname = usePathname()

  useEffect(() => {
    setHeaderTheme(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => {
    if (headerTheme && headerTheme !== theme) setTheme(headerTheme)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerTheme])

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  // Listen for custom event to open mobile menu (from exercise pages)
  useEffect(() => {
    const handleOpenMenu = () => {
      setIsMobileMenuOpen(true)
    }

    window.addEventListener('open-mobile-menu', handleOpenMenu)
    return () => window.removeEventListener('open-mobile-menu', handleOpenMenu)
  }, [])

  // Handle scroll for sticky header
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <>
      <header
        className={`sticky top-0 z-40 w-full transition-all duration-300 ${
          isScrolled
            ? 'bg-header/95 backdrop-blur-xl border-b border-border shadow-lg shadow-black/5'
            : 'bg-header/80 backdrop-blur-md border-b border-border'
        }`}
        {...(theme ? { 'data-theme': theme } : {})}
      >
        <div className="container">
          <div className="py-3 md:py-4 flex items-center justify-between text-header-foreground">
            {/* Logo */}
            <Link
              href="/"
              className="flex items-center gap-3 flex-shrink-0 hover:opacity-80 transition-opacity"
            >
              <TelescopeLogo className="h-8 w-auto" />
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center">
              <HeaderNav data={data} user={user} isAuthLoading={isAuthLoading} />
            </div>

            {/* Mobile Menu Button */}
            <MobileMenuButton onClick={() => setIsMobileMenuOpen(true)} />
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <MobileMenu
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        data={data}
        user={user}
        isAuthLoading={isAuthLoading}
      />
    </>
  )
}
