'use client'

import { isRTL } from '@/i18n/config'
import { cn } from '@/infra/utils/ui'
import type { User } from '@/payload-types'
import { Button } from '@/ui/web/components/button'
import { useLocale, useTranslations } from '@/ui/web/providers/I18n'
import { TelescopeLogo } from '@/ui/web/TelescopeLogo'
import { UserDropdown } from '@/ui/web/UserDropdown'
import { ArrowRight, Menu } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface ExerciseHeaderProps {
  exerciseTitle: string
  backUrl?: string
  onMenuClick?: () => void
  user?: User | null
  isAuthLoading?: boolean
  currentUrl?: string
}

export function ExerciseHeader({
  exerciseTitle,
  backUrl,
  onMenuClick,
  user,
  isAuthLoading,
  currentUrl,
}: ExerciseHeaderProps) {
  const t = useTranslations('courses')
  const tCommon = useTranslations('common.header')
  const locale = useLocale()
  const rtl = isRTL(locale as 'en' | 'he')
  const router = useRouter()

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back()
    } else if (backUrl) {
      router.push(backUrl)
    } else {
      router.push('/courses')
    }
  }

  return (
    <header className="h-[60px] bg-card border-b border-border flex items-center flex-shrink-0 z-[100] relative">
      {/* Back button - on inner edge for better UX (opposite to auth/logo section) */}
      <button
        onClick={handleBack}
        className={cn(
          'flex items-center justify-center p-2 text-foreground hover:text-primary transition-colors flex-shrink-0 absolute cursor-pointer',
          // Mobile: back button on outer edge (left in LTR, right in RTL)
          // Desktop: back button on inner edge (left in LTR, right in RTL)
          rtl ? 'lg:right-5 lg:left-auto right-5' : 'lg:left-5 lg:right-auto left-5',
        )}
        aria-label={t('backToLesson')}
      >
        {/* Arrow points in navigation direction - always ArrowRight, rotated to point correct way */}
        <ArrowRight
          className={cn(
            'w-6 h-6 transition-transform',
            // Mobile: arrow points outward
            rtl ? 'rotate-0' : 'rotate-180',
            // Desktop: arrow points inward (opposite of mobile)
            rtl ? 'lg:rotate-180' : 'lg:rotate-0',
          )}
        />
      </button>

      {/* Center: Exercise Title */}
      <h1 className="absolute left-1/2 -translate-x-1/2 text-primary text-lg font-extrabold tracking-tight cursor-move max-w-[40%] text-center truncate">
        {exerciseTitle}
      </h1>

      {/* Logo and Auth section - on outer edge (opposite to back button) */}
      <div
        className={cn(
          'flex items-center gap-1 flex-shrink-0 absolute z-[101]',
          // Mobile: fixed to outer edge (right in LTR, left in RTL)
          // Desktop: fixed to outer edge (right in LTR, left in RTL)
          rtl ? 'lg:left-5 lg:right-auto left-5' : 'lg:right-5 lg:left-auto right-5',
        )}
      >
        {/* Logo - Hidden on mobile, shown on desktop */}
        <TelescopeLogo className="h-8 w-auto hidden lg:flex" />

        {/* Desktop Auth Section */}
        <div className="hidden lg:flex items-center gap-2" data-testid="exercise-header-auth">
          {isAuthLoading ? (
            <div className="w-20 h-8 animate-pulse bg-muted rounded" aria-hidden="true" />
          ) : user ? (
            <UserDropdown user={user} />
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/login?returnTo=${encodeURIComponent(currentUrl || '/')}`}>
                  {tCommon('login')}
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link href={`/signup?returnTo=${encodeURIComponent(currentUrl || '/')}`}>
                  {tCommon('signup')}
                </Link>
              </Button>
            </>
          )}
        </div>

        {/* Hamburger menu - Shown on mobile, hidden on desktop */}
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="p-2 rounded-lg hover:bg-muted transition-colors lg:hidden text-foreground"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6 text-foreground" />
          </button>
        )}
      </div>
    </header>
  )
}
