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
import { AccessCodeGateModal } from './AccessCodeGateModal'

interface AccessGateProviderProps {
  accessType: AccessType | string
  courseSlug: string
  /** Total gated delay before lock-out (ms). Read from admin config server-side. */
  gatedDelayMs?: number
  /** Warning duration before lock-out (ms). Read from admin config server-side. */
  gatedWarningMs?: number
  /** Lesson ID for access code gate */
  lessonId?: string
  children: React.ReactNode
}

export function AccessGateProvider({
  accessType,
  courseSlug,
  gatedDelayMs,
  gatedWarningMs,
  lessonId,
  children,
}: AccessGateProviderProps) {
  const t = useTranslations('accessControl')
  const pathname = usePathname()
  const {
    showMandatoryModal,
    showGatedModal,
    showWarningModal,
    showAccessCodeModal,
    warningSecondsLeft,
    dismissWarning,
  } = useAccessGate({ accessType, courseSlug, gatedDelayMs, gatedWarningMs, lessonId })

  const isBlocked = showMandatoryModal || showGatedModal || showAccessCodeModal

  // Track which modal type is currently shown (fire once per modal appearance)
  const hasFiredRef = useRef<string | null>(null)

  useEffect(() => {
    const triggerType = showMandatoryModal
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
  }, [showMandatoryModal, showGatedModal, showWarningModal, courseSlug, pathname])

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
            <GoogleLoginButton returnTo={pathname} className="w-full" />
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

      {/* Access code gate modal for authenticated users */}
      <AccessCodeGateModal
        isOpen={showAccessCodeModal}
        lessonId={lessonId || ''}
        onSuccess={() => {
          // The modal will automatically close because hasRedeemedCode will be set to true
          // This triggers a re-render and the modal will be hidden
        }}
      />

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
