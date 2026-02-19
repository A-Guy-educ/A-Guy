'use client'

import { cn } from '@/infra/utils/ui'
import { X, AlertCircle } from 'lucide-react'
import { SystemLink } from '@/infra/loading/components/SystemLink'
import { usePathname } from 'next/navigation'
import { useTranslations } from '@/ui/web/providers/I18n'

export interface ChatErrorSurfaceProps {
  type: 'auth' | 'limit' | 'general'
  message: string
  onDismiss: () => void
  className?: string
}

export function ChatErrorSurface({ type, message, onDismiss, className }: ChatErrorSurfaceProps) {
  const tCourses = useTranslations('courses')
  const pathname = usePathname()

  const loginUrl = `/login?returnTo=${encodeURIComponent(pathname)}`

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
        {(type === 'auth' || type === 'limit') && (
          <div className="flex items-center gap-2 mt-2 text-sm">
            <SystemLink
              href={loginUrl}
              className="font-semibold underline hover:no-underline transition-all"
            >
              {tCourses('chatAuthRequiredLogin')}
            </SystemLink>
          </div>
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
