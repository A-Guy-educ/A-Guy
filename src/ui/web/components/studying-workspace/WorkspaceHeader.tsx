'use client'

import { useTranslations } from '@/ui/web/providers/I18n'
import { cn } from '@/infra/utils/ui'
import { ArrowLeft, User } from 'lucide-react'
import { StudyModeToggle } from '@/ui/web/components/study-mode-toggle'
import { UserAvatar } from '@/ui/web/UserAvatar'
import { useCurrentUser } from '@/client/hooks/useCurrentUser'

/**
 * @fileType component
 * @domain study-mode
 * @pattern workspace-header
 * @ai-summary Workspace header with back button, title, mode toggle, and user avatar
 */

interface WorkspaceHeaderProps {
  lessonTitle: string
  backUrl?: string
  onBack?: () => void
  className?: string
}

export function WorkspaceHeader({ lessonTitle, backUrl, onBack, className }: WorkspaceHeaderProps) {
  const t = useTranslations('studyMode')
  const { user, isLoading } = useCurrentUser()

  const handleBack = () => {
    if (onBack) {
      onBack()
    } else if (backUrl) {
      window.location.href = backUrl
    }
  }

  return (
    <header
      className={cn(
        'glass-surface rounded-b-4xl px-4 md:px-6 py-4',
        'border-b border-mode-border/20',
        'flex items-center gap-4',
        className,
      )}
    >
      {/* Back button */}
      <button
        onClick={handleBack}
        className={cn(
          'p-2 rounded-full hover:bg-mode-surface/50 transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mode-accent focus-visible:ring-offset-2',
          'min-h-[48px] min-w-[48px] flex items-center justify-center',
        )}
        aria-label={t('sidebar.expand')}
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      {/* Lesson title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-lg font-semibold truncate">{lessonTitle}</h1>
      </div>

      {/* Mode toggle */}
      <div className="hidden md:block">
        <StudyModeToggle />
      </div>

      {/* User avatar */}
      <div className="flex items-center">
        {isLoading ? (
          <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
        ) : user ? (
          <UserAvatar name={user.name || user.email || 'User'} size="md" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <User className="w-5 h-5 text-muted-foreground" />
          </div>
        )}
      </div>
    </header>
  )
}
