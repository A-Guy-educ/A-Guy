'use client'

import { cn } from '@/infra/utils/ui'
import { X, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from '@/ui/web/providers/I18n'

export interface ChatErrorSurfaceProps {
  type: 'auth' | 'general'
  message: string
  onDismiss: () => void
  className?: string
}

export function ChatErrorSurface({ type, message, onDismiss, className }: ChatErrorSurfaceProps) {
  const tCourses = useTranslations('courses')

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-4 rounded-lg border bg-destructive/10 border-destructive/30 text-destructive',
        className,
      )}
      role="alert"
      aria-live="polite"
    >
      {/* Error Icon */}
      <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />

      {/* Error Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-relaxed">{message}</p>

        {/* Auth Error CTA */}
        {type === 'auth' && (
          <Link
            href="/signup"
            className="inline-block mt-2 text-sm font-semibold underline hover:no-underline transition-all"
          >
            {tCourses('chatAuthRequiredCTA')}
          </Link>
        )}
      </div>

      {/* Dismiss Button */}
      <button
        type="button"
        onClick={onDismiss}
        className="p-1 hover:bg-destructive/20 rounded-full transition-colors flex-shrink-0"
        aria-label={tCourses('chatErrorDismiss')}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
