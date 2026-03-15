'use client'

import { useState } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/ui/web/components/dialog'
import { useTranslations } from '@/ui/web/providers/I18n'

interface AccessCodeGateModalProps {
  isOpen: boolean
  lessonId: string
  onSuccess: () => void
}

export function AccessCodeGateModal({ isOpen, lessonId, onSuccess }: AccessCodeGateModalProps) {
  const t = useTranslations('accessControl')
  const [code, setCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/access-codes/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: code.trim(), lessonId }),
      })

      const data = await response.json()

      if (data.success) {
        onSuccess()
      } else {
        // Map error codes to translation keys
        switch (data.error) {
          case 'invalid_code':
            setError(t('accessCodeError'))
            break
          case 'expired_code':
            setError(t('accessCodeExpired'))
            break
          case 'max_redemptions_reached':
            setError(t('accessCodeMaxReached'))
            break
          default:
            setError(t('accessCodeError'))
        }
      }
    } catch {
      setError(t('accessCodeError'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen}>
      <DialogContent allowDismiss={false} className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle className="text-xl">{t('accessCodeTitle')}</DialogTitle>
          <DialogDescription className="mt-2">{t('accessCodeDescription')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t('accessCodePlaceholder')}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading}
            autoComplete="off"
          />
          {error && <p className="text-sm text-destructive text-center">{error}</p>}
          <button
            type="submit"
            disabled={isLoading || !code.trim()}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
          >
            {isLoading ? '...' : t('accessCodeUnlock')}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
