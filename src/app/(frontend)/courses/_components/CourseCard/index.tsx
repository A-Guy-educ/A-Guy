'use client'

import { getUserProfile, setUserProfile } from '@/client/state/localStorage/userProfile'
import { useLoadingState } from '@/infra/loading/hooks/useLoadingState'
import { useRouterWithLoading } from '@/infra/loading/hooks/useRouterWithLoading'
import { LOADING_KEYS } from '@/infra/loading/keys'
import { cn } from '@/infra/utils/ui'
import type { Course } from '@/payload-types'
import { Button } from '@/ui/web/components/button'
import { useTranslations } from '@/ui/web/providers/I18n'
import { SafeHtml } from '@/ui/web/SafeHtml'
import { ContentStatusBadge } from '@/ui/web/shared/ContentStatusBadge'
import { ProgressCircle } from '@/ui/web/shared/ProgressCircle'
import { BookOpen, CheckCircle, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

interface CourseCardProps {
  course: Course
  isOwned?: boolean
}

export function CourseCard({ course, isOwned = false }: CourseCardProps) {
  const t = useTranslations('courses')
  const router = useRouterWithLoading()
  const [wasClicked, setWasClicked] = useState(false)
  const isRouteLoading = useLoadingState({ key: LOADING_KEYS.ROUTE_TRANSITION })
  const [courseProgress, setCourseProgress] = useState(0)

  // Fetch course-level progress for owned courses
  useEffect(() => {
    if (!isOwned) return
    const profile = getUserProfile()
    if (!profile?.gradeLevel) return
    fetch(`/api/progress?gradeLevel=${encodeURIComponent(profile.gradeLevel)}&scope=course`, {
      credentials: 'include',
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.data?.percentage) setCourseProgress(json.data.percentage)
      })
      .catch(() => {
        /* silent */
      })
  }, [isOwned])

  // Show loading state if this button was clicked and route is loading
  const isLoading = wasClicked && isRouteLoading

  // Determine if content is "soon" (locked)
  const isSoon = course.contentStatus === 'soon'

  const handleCourseSelect = (e: React.MouseEvent) => {
    e.preventDefault()

    // If course is "Soon", show locked message and do NOT navigate
    if (isSoon) {
      toast.info(t('contentLocked'))
      return
    }

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
        'relative bg-card p-card-padding rounded-[2rem] flex flex-col',
        borderClass,
        'shadow-[0_1px_2px_0_rgba(60,64,67,.3),0_1px_3px_1px_rgba(60,64,67,.15)]',
        'transition-all hover:-translate-y-0.5',
        isSoon && 'opacity-75',
      )}
    >
      {isOwned && (
        <span
          className="absolute -top-3 start-6 bg-[hsl(var(--success))] text-white px-4 py-1 rounded-full shadow-elevation-3 uppercase tracking-wider"
          style={{ fontSize: '9px', fontWeight: 900 }}
        >
          הקורס שלך
        </span>
      )}

      {/* Content Status Badge - top right */}
      <ContentStatusBadge
        contentStatus={course.contentStatus}
        contentStatusExpiresAt={course.contentStatusExpiresAt ?? undefined}
        contentStatusLabel={course.contentStatusLabel ?? undefined}
        className="absolute -top-3 end-6"
      />

      <div className="mb-6 flex justify-between items-start gap-content-gap">
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
            className="text-card-foreground text-start"
            style={{ fontSize: '20px', fontWeight: 900 }}
          >
            {course.title}
          </h4>
          {course.description && (
            <SafeHtml
              html={course.description}
              className="text-muted-foreground mt-1 line-clamp-2 text-start [&_p]:m-0"
              style={{ fontSize: '12px' }}
            />
          )}
        </div>
        <div className="flex-shrink-0">
          {isOwned && courseProgress > 0 ? (
            <div className="w-12 h-12 relative">
              <ProgressCircle percentage={courseProgress} size={48} strokeWidth={3}>
                {courseProgress >= 100 ? (
                  <foreignObject x="25%" y="25%" width="50%" height="50%">
                    <CheckCircle className="w-full h-full text-[hsl(var(--success))]" />
                  </foreignObject>
                ) : (
                  <text
                    x="50%"
                    y="50%"
                    textAnchor="middle"
                    dy=".3em"
                    className="text-[10px] font-bold fill-foreground"
                  >
                    {Math.round(courseProgress)}%
                  </text>
                )}
              </ProgressCircle>
            </div>
          ) : (
            <div
              className={cn(
                'w-12 h-12 rounded-2xl flex items-center justify-center',
                isOwned ? 'bg-[hsl(var(--success))]/10' : 'bg-muted',
              )}
            >
              {isOwned ? (
                <CheckCircle className="w-6 h-6 text-[hsl(var(--success))]" />
              ) : (
                <BookOpen className="w-6 h-6 text-primary" />
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-auto pt-6 border-t border-border">
        <Button
          onClick={handleCourseSelect}
          disabled={isLoading || isSoon}
          className={cn(
            'w-full',
            isOwned
              ? 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/20'
              : isSoon
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-muted text-primary hover:bg-[hsl(var(--primary-soft))]',
          )}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin me-2" />
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
