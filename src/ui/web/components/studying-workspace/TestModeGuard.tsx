'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from '@/ui/web/providers/I18n'
import { useStudyMode } from '@/ui/web/providers/StudyMode'

/**
 * @fileType component
 * @domain study-mode
 * @pattern navigation-guard
 * @ai-summary Test mode guard that restricts navigation during test mode
 */

interface TestModeGuardProps {
  children: React.ReactNode
  className?: string
}

export function TestModeGuard({ children, className }: TestModeGuardProps) {
  const t = useTranslations('studyMode')
  const { mode, setMode } = useStudyMode()
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  // Warn before leaving the page during test mode
  useEffect(() => {
    if (mode !== 'test') return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = t('testMode.confirmLeave')
      return t('testMode.confirmLeave')
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [mode, t])

  // Restrict navigation in test mode
  useEffect(() => {
    if (mode !== 'test') return

    const handlePopState = () => {
      // Block back navigation
      window.history.forward()
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [mode])

  const cancelNavigation = () => {
    setShowConfirmDialog(false)
  }

  const exitTestMode = () => {
    setMode('study')
    setShowConfirmDialog(false)
  }

  return (
    <>
      <div className={className}>{children}</div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="test-mode-dialog-title"
          aria-describedby="test-mode-dialog-desc"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={cancelNavigation}
            aria-hidden="true"
          />

          {/* Dialog */}
          <div className="relative glass-surface rounded-4xl p-6 max-w-sm w-full">
            <h3 id="test-mode-dialog-title" className="text-lg font-semibold mb-2">
              {t('testMode.restrictedNav')}
            </h3>
            <p id="test-mode-dialog-desc" className="text-muted-foreground mb-6">
              {t('testMode.confirmLeave')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={exitTestMode}
                className="flex-1 px-4 py-2 rounded-full bg-error text-error-foreground hover:bg-error/90 transition-colors"
              >
                {t('testMode.test').toUpperCase()}
              </button>
              <button
                onClick={cancelNavigation}
                className="flex-1 px-4 py-2 rounded-full bg-mode-surface hover:bg-mode-surface/80 transition-colors"
              >
                {t('practiceCard.front')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
