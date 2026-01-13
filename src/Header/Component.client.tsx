'use client'
import { useHeaderTheme } from '@/providers/HeaderTheme'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'

import type { Header, User } from '@/payload-types'

import { TelescopeLogo } from '@/components/TelescopeLogo'
import { HeaderNav } from './Nav'
import { MobileMenu, MobileMenuButton } from './MobileMenu'
import { useLocale, useTranslations } from '@/providers/I18n'
import { cn } from '@/utilities/ui'

interface HeaderClientProps {
  data: Header
}

export const HeaderClient: React.FC<HeaderClientProps> = ({ data }) => {
  const [user, setUser] = useState<User | null>(null)
  /* Storing the value in a useState to avoid hydration errors */
  const [theme, setTheme] = useState<string | null>(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const { headerTheme, setHeaderTheme } = useHeaderTheme()
  const pathname = usePathname()
  const router = useRouter()
  const locale = useLocale()
  const tCommon = useTranslations('common.header')
  const isRTL = locale === 'he'
  
  // Show back button if not on home page
  const showBackButton = pathname !== '/'

  // Fetch user on client side to avoid static-to-dynamic conversion
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/users/me', {
          credentials: 'include', // Include cookies
        })

        if (response.ok) {
          const data = await response.json()
          setUser(data.user || null)
        }
      } catch (_error) {
        // Silently fail - user is not authenticated
        setUser(null)
      }
    }

    fetchUser()
  }, [])

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

  // Handle scroll for sticky header
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const userName = user?.name || undefined

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
            {/* Back Button */}
            {showBackButton && (
              <button
                onClick={() => router.back()}
                className={cn(
                  'flex items-center justify-center p-2 text-header-foreground hover:text-primary transition-colors flex-shrink-0',
                  isRTL ? 'order-4' : 'order-1',
                )}
                aria-label={tCommon('back')}
              >
                {isRTL ? <ArrowRight className="w-6 h-6" /> : <ArrowLeft className="w-6 h-6" />}
              </button>
            )}

            {/* Logo */}
            <Link
              href="/"
              className={cn(
                'flex items-center gap-3 flex-shrink-0 hover:opacity-80 transition-opacity',
                showBackButton ? (isRTL ? 'order-3' : 'order-2') : (isRTL ? 'order-4' : 'order-1'),
              )}
            >
              <TelescopeLogo className="h-8 w-auto" />
              <span className="text-xl font-semibold">AGuy</span>
            </Link>

            {/* Desktop Navigation */}
            <div className={cn('hidden lg:flex items-center', isRTL ? 'order-2' : 'order-3')}>
              <HeaderNav data={data} userName={userName} isAuthenticated={!!user} />
            </div>

            {/* Mobile Menu Button */}
            <div className={cn(isRTL ? 'order-1' : 'order-4')}>
              <MobileMenuButton onClick={() => setIsMobileMenuOpen(true)} />
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <MobileMenu
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        data={data}
        userName={userName}
        isAuthenticated={!!user}
      />
    </>
  )
}
