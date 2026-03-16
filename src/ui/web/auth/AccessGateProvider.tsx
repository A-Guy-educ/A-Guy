'use client'

import { useEffect, useRef, useState } from 'react'
import { useAccessGate } from '@/client/hooks/useAccessGate'
import { SYSTEM_EVENTS, systemEventBus } from '@/infra/system-events'
import type { AccessType } from '@/server/constants/access-types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/ui/web/components/dialog'
import { Button } from '@/ui/web/components/button'
import { GoogleLoginButton } from '@/ui/web/auth/GoogleLoginButton'
import { useTranslations } from '@/ui/web/providers/I18n'
import { usePathname, useRouter } from 'next/navigation'

import { AuthGateModal } from './AuthGateModal'

interface AccessGateProviderProps {
  accessType: AccessType | string
  courseSlug: string
  /** Total gated delay before lock-out (ms). Read from admin config server-side. */
  gatedDelayMs?: number
  /** Warning duration before lock-out (ms). Read from admin config server-side. */
  gatedWarningMs?: number
  /** Server-determined: user lacks entitlement for paid content */
  requiresEntitlement?: boolean
  /** Server-determined: whether user is logged in */
  isAuthenticated?: boolean
  children: React.ReactNode
}

export function AccessGateProvider({
  accessType,
  courseSlug,
  gatedDelayMs,
  gatedWarningMs,
  requiresEntitlement,
  isAuthenticated,
  children,
}: AccessGateProviderProps) {
  const t = useTranslations('accessControl')
  const pathname = usePathname()
  const {
    showMandatoryModal,
    showGatedModal,
    showWarningModal,
    warningSecondsLeft,
    dismissWarning,
  } = useAccessGate({ accessType, courseSlug, gatedDelayMs, gatedWarningMs })

  const showPaidModal = accessType === 'paid' && requiresEntitlement === true
  const isBlocked = showMandatoryModal || showGatedModal || showPaidModal

  // Track which modal type is currently shown (fire once per modal appearance)
  const hasFiredRef = useRef<string | null>(null)

  useEffect(() => {
    const triggerType = showPaidModal
      ? 'paid'
      : showMandatoryModal
        ? 'mandatory'
        : showGatedModal
          ? 'gated'
          : showWarningModal
            ? 'warning'
            : null

    if (triggerType && hasFiredRef.current !== triggerType) {
      hasFiredRef.current = triggerType
      systemEventBus.emit(SYSTEM_EVENTS.LOGIN_MODAL_SHOWN, {
        trigger_type: triggerType,
        course_slug: courseSlug,
        current_page: pathname,
      })
    }

    // Reset when all modals close so it fires again on next appearance
    if (!triggerType) {
      hasFiredRef.current = null
    }
  }, [showPaidModal, showMandatoryModal, showGatedModal, showWarningModal, courseSlug, pathname])

  return (
    <>
      {/* Dismissible warning modal - user can close and keep browsing */}
      <Dialog open={showWarningModal} onOpenChange={(open) => !open && dismissWarning()}>
        <DialogContent allowDismiss={true} className="sm:max-w-md">
          <DialogHeader className="text-center sm:text-center">
            <DialogTitle className="text-xl">{t('gatedWarningTitle')}</DialogTitle>
            <DialogDescription className="mt-2">
              {t('warningCountdown').replace('{{seconds}}', String(warningSecondsLeft))}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-center">
            <GoogleLoginButton returnTo={pathname} variant="default" className="w-full" />
          </div>
        </DialogContent>
      </Dialog>

      {/* Non-dismissible mandatory modal */}
      <AuthGateModal
        isOpen={showMandatoryModal}
        title={t('mandatoryTitle')}
        description={t('mandatoryDescription')}
        returnTo={pathname}
      />

      {/* Non-dismissible gated lock modal (after timer expires) */}
      <AuthGateModal
        isOpen={showGatedModal}
        title={t('gatedLockedTitle')}
        description={t('gatedLockedDescription')}
        returnTo={pathname}
      />

      {/* Paid content modal */}
      {showPaidModal && (
        <PaidContentModal isAuthenticated={isAuthenticated} pathname={pathname} t={t} />
      )}

      {isBlocked ? (
        <div aria-hidden="true" className="pointer-events-none select-none blur-sm">
          {children}
        </div>
      ) : (
        children
      )}
    </>
  )
}

/** Sub-component: paid content modal with access code input */
function PaidContentModal({
  isAuthenticated,
  pathname,
  t,
}: {
  isAuthenticated?: boolean
  pathname: string
  t: (key: string) => string
}) {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleRedeem = async () => {
    const trimmed = code.trim()
    if (!trimmed) return

    setError('')
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/entitlements/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      })

      const data = await res.json()

      if (data.success) {
        router.refresh()
        return
      }

      const errorMessages: Record<string, string> = {
        invalid_code: t('codeInvalid'),
        code_inactive: t('codeInactive'),
        code_expired: t('codeExpired'),
        code_exhausted: t('codeExhausted'),
        already_entitled: t('codeAlreadyUsed'),
      }

      setError(errorMessages[data.error] || t('codeError'))
    } catch {
      setError(t('codeError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={true}>
      <DialogContent allowDismiss={false} className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle className="text-xl">{t('paidTitle')}</DialogTitle>
          <DialogDescription className="mt-2">
            {isAuthenticated ? t('paidNoEntitlement') : t('paidNotLoggedIn')}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 flex flex-col items-center gap-4">
          {!isAuthenticated && (
            <GoogleLoginButton returnTo={pathname} variant="default" className="w-full" />
          )}
          {isAuthenticated && (
            <div className="w-full space-y-3">
              <div className="relative">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value)
                    setError('')
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRedeem()
                  }}
                  placeholder={t('codePlaceholder')}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  dir="ltr"
                  disabled={isSubmitting}
                />
              </div>
              {error && <p className="text-sm text-error">{error}</p>}
              <Button
                onClick={handleRedeem}
                disabled={!code.trim() || isSubmitting}
                className="w-full"
              >
                {isSubmitting ? t('codeSubmitting') : t('codeSubmit')}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
