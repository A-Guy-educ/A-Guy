'use client'

import { getUserProfile, setUserProfile } from '@/client/state/localStorage/userProfile'
import { useLoadingState } from '@/infra/loading/hooks/useLoadingState'
import { useRouterWithLoading } from '@/infra/loading/hooks/useRouterWithLoading'
import { LOADING_KEYS } from '@/infra/loading/keys'
import { cn } from '@/infra/utils/ui'
import type { Course } from '@/payload-types'
import { Button } from '@/ui/web/components/button'
import { useTranslations } from '@/ui/web/providers/I18n'
import { HtmlRenderer } from '@/ui/web/shared/HtmlRenderer'
import { BookOpen, CheckCircle, Loader2 } from 'lucide-react'
import { useState } from 'react'

function renderDescription(description: string | null | undefined): React.ReactNode {
  if (!description) return null
  if (typeof description === 'string') {
    return (
      <div
        className="mt-1 line-clamp-2 text-right text-muted-foreground"
        style={{ fontSize: '12px' }}
      >
        <HtmlRenderer html={description} />
      </div>
    )
  }
  return null
}

interface CourseCardProps {
  course: Course
  isOwned?: boolean
}

export function CourseCard({ course, isOwned = false }: CourseCardProps) {
  const t = useTranslations('courses')
  const router = useRouterWithLoading()
  const [wasClicked, setWasClicked] = useState(false)
  const isRouteLoading = useLoadingState({ key: LOADING_KEYS.ROUTE_TRANSITION })

  // Show loading state if this button was clicked and route is loading
  const isLoading = wasClicked && isRouteLoading

  const handleCourseSelect = (e: React.MouseEvent) => {
    e.preventDefault()

    // Mark that this button was clicked
    setWasClicked(true)

    // Update localStorage with the selected course
    const gradeLevel = course.courseLabel || '8'
    const existingProfile = getUserProfile()

    setUserProfile({
      gradeLevel,
      mood: existingProfile?.mood || '',
      lastVisit: new Date().toISOString(),
    })

    // Navigate to home page after localStorage is updated
    router.push('/')
  }

  const borderClass = isOwned
    ? 'border-2 border-[hsl(var(--primary))]/20'
    : 'border border-transparent hover:border-[hsl(var(--primary-soft))]'

  return (
    <div
      className={cn(
        'relative bg-card p-6 rounded-[2rem] flex flex-col',
        borderClass,
        'shadow-[0_1px_2px_0_rgba(60,64,67,.3),0_1px_3px_1px_rgba(60,64,67,.15)]',
        'transition-all hover:-translate-y-0.5',
      )}
    >
      {isOwned && (
        <span
          className="absolute -top-3 left-6 bg-[hsl(var(--success))] text-white px-4 py-1 rounded-full shadow-md uppercase tracking-wider"
          style={{ fontSize: '9px', fontWeight: 900 }}
        >
          הקורס שלך
        </span>
      )}

      <div className="mb-6 flex justify-between items-start gap-4">
        <div className="flex-1">
          {course.courseLabel && (
            <span
              className="block mb-1 uppercase tracking-widest text-primary"
              style={{ fontSize: '10px', fontWeight: 900 }}
            >
              {course.courseLabel}
            </span>
          )}
          <h4
            className="text-card-foreground text-right"
            style={{ fontSize: '20px', fontWeight: 900 }}
          >
            {course.title}
          </h4>
          {renderDescription(course.description)}
        </div>
        <div
          className={cn(
            'w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0',
            isOwned ? 'bg-[hsl(var(--success))]/10' : 'bg-muted',
          )}
        >
          {isOwned ? (
            <CheckCircle className="w-6 h-6 text-[hsl(var(--success))]" />
          ) : (
            <BookOpen className="w-6 h-6 text-primary" />
          )}
        </div>
      </div>

      <div className="mt-auto pt-6 border-t border-border">
        <Button
          onClick={handleCourseSelect}
          disabled={isLoading}
          className={cn(
            'w-full',
            isOwned
              ? 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/20'
              : 'bg-muted text-primary hover:bg-[hsl(var(--primary-soft))]',
          )}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              {t('openCourse')}
            </>
          ) : (
            t('openCourse')
          )}
        </Button>
      </div>
    </div>
  )
}
