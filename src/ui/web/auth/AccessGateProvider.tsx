'use client'

import { useEffect, useRef } from 'react'
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
import { GoogleLoginButton } from '@/ui/web/auth/GoogleLoginButton'
import { useTranslations } from '@/ui/web/providers/I18n'
import { usePathname } from 'next/navigation'

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
        <Dialog open={true}>
          <DialogContent allowDismiss={false} className="sm:max-w-md">
            <DialogHeader className="text-center sm:text-center">
              <DialogTitle className="text-xl">{t('paidTitle')}</DialogTitle>
              <DialogDescription className="mt-2">
                {isAuthenticated ? t('paidNoEntitlement') : t('paidNotLoggedIn')}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 flex flex-col items-center gap-3">
              {!isAuthenticated && (
                <GoogleLoginButton returnTo={pathname} variant="default" className="w-full" />
              )}
            </div>
          </DialogContent>
        </Dialog>
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
