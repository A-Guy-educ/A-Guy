'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { getUserProfile } from '@/client/state/localStorage/userProfile'
import { Button } from '@/ui/web/components/button'
import { useTranslations } from '@/ui/web/providers/I18n'

interface RequireCourseSelectionProps {
  children: React.ReactNode
  /** Custom message to show when course is not selected */
  message?: string
  /** Custom redirect URL when clicking the action button */
  redirectUrl?: string
}

export function RequireCourseSelection({
  children,
  message,
  redirectUrl = '/courses',
}: RequireCourseSelectionProps) {
  const router = useRouter()
  const t = useTranslations('coursePage')
  const [hasSelection, setHasSelection] = useState<boolean | null>(null)

  useEffect(() => {
    const profile = getUserProfile()
    if (!profile?.gradeLevel) {
      setHasSelection(false)
      return
    }
    setHasSelection(true)
  }, [])

  if (hasSelection === null) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    )
  }

  if (hasSelection === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] px-6 text-center">
        <div className="mb-6">
          <svg
            className="mx-auto h-16 w-16 text-muted-foreground/50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
            />
          </svg>
        </div>
        <h2 className="text-heading-lg font-bold text-foreground mb-2">
          {t('selectCourseToAccess')}
        </h2>
        <p className="text-body-md text-muted-foreground max-w-md mb-8">
          {message || t('selectCourseToAccessMessage')}
        </p>
        <Button onClick={() => router.push(redirectUrl)}>{t('browseCourses')}</Button>
      </div>
    )
  }

  return <>{children}</>
}
