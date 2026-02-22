'use client'

import { useAccessGate } from '@/client/hooks/useAccessGate'
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
  children: React.ReactNode
}

export function AccessGateProvider({
  accessType,
  courseSlug,
  gatedDelayMs,
  gatedWarningMs,
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

  const isBlocked = showMandatoryModal || showGatedModal

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
