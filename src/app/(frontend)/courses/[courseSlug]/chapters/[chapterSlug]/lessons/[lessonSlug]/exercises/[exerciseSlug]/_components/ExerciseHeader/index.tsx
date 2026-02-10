'use client'

import { isRTL } from '@/i18n/config'
import { cn } from '@/infra/utils/ui'
import type { User } from '@/payload-types'
import { TelescopeLogo } from '@/ui/web/TelescopeLogo'
import { UserDropdown } from '@/ui/web/UserDropdown'
import { Button } from '@/ui/web/components/button'
import { useLocale, useTranslations } from '@/ui/web/providers/I18n'
import { ArrowLeft, ArrowRight, Menu } from 'lucide-react'
import { SystemLink } from '@/infra/loading/components/SystemLink'
import { useRouterWithLoading } from '@/infra/loading/hooks/useRouterWithLoading'

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
  const router = useRouterWithLoading()

  const returnToParam = currentUrl ? `?returnTo=${encodeURIComponent(currentUrl)}` : ''

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
      {/* Left side in LTR (back arrow) / Right side in RTL (back arrow) */}
      <button
        onClick={handleBack}
        className={cn(
          'flex items-center justify-center p-2 text-foreground hover:text-primary transition-colors flex-shrink-0 absolute cursor-pointer',
          rtl ? 'right-5' : 'left-5',
        )}
        aria-label={t('backToLesson')}
      >
        {rtl ? <ArrowRight className="w-6 h-6" /> : <ArrowLeft className="w-6 h-6" />}
      </button>

      {/* Center: Exercise Title */}
      <h1 className="absolute left-1/2 -translate-x-1/2 text-primary text-lg font-extrabold tracking-tight cursor-move max-w-[40%] text-center truncate">
        {exerciseTitle}
      </h1>

      {/* Right side in LTR / Left side in RTL - Fixed positioning to viewport edge */}
      <div
        className={cn(
          'flex items-center gap-2 flex-shrink-0 fixed top-[10px] z-[101]',
          rtl ? 'flex-row-reverse' : 'flex-row',
        )}
        style={{
          [rtl ? 'left' : 'right']: '20px',
        }}
      >
        {/* Logo - Hidden on mobile, shown on desktop */}
        <TelescopeLogo className="h-8 w-auto hidden lg:flex" />

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

        {/* Desktop Auth Section */}
        <div className="hidden lg:flex items-center gap-2" data-testid="exercise-header-auth">
          {isAuthLoading ? (
            <div className="w-20 h-8 animate-pulse bg-muted rounded" aria-hidden="true" />
          ) : user ? (
            <UserDropdown user={user} />
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <SystemLink href={`/login${returnToParam}`}>{tCommon('login')}</SystemLink>
              </Button>
              <Button size="sm" asChild>
                <SystemLink href={`/signup${returnToParam}`}>{tCommon('signup')}</SystemLink>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
