'use client'

import { useEffect } from 'react'

import { Button } from '@/ui/web/components/button'
import { useTranslations } from '@/ui/web/providers/I18n'

export interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function Error({ error, reset }: ErrorProps) {
  const t = useTranslations('error')

  useEffect(() => {
    // Log the error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error boundary caught:', error)
    }
  }, [error])

  return (
    <div className="container py-28">
      <div className="prose max-w-none">
        <h1 style={{ marginBottom: 0 }}>{t('title')}</h1>
        <p className="mb-4">{t('description')}</p>
      </div>
      <Button onClick={() => reset()} variant="default">
        {t('retry')}
      </Button>
    </div>
  )
}
