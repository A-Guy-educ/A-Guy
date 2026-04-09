'use client'

import { getUserProfile, setUserProfile } from '@/client/state/localStorage/userProfile'
import { useLoadingState } from '@/infra/loading/hooks/useLoadingState'
import { useRouterWithLoading } from '@/infra/loading/hooks/useRouterWithLoading'
import { LOADING_KEYS } from '@/infra/loading/keys'
import { SYSTEM_EVENTS, systemEventBus } from '@/infra/system-events'
import { cn } from '@/infra/utils/ui'
import type { Course } from '@/payload-types'
import { Button } from '@/ui/web/components/button'
import { useTranslations } from '@/ui/web/providers/I18n'
import { SafeHtml } from '@/ui/web/SafeHtml'
import { ContentStatusBadge } from '@/ui/web/shared/ContentStatusBadge'
import { ProgressCircle } from '@/ui/web/shared/ProgressCircle'
import { CheckCircle, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

const COURSE_COLORS = [
  { accent: 'hsl(217 91% 60%)', bg: 'from-blue-500/5 to-transparent' },
  { accent: 'hsl(142 71% 45%)', bg: 'from-green-500/5 to-transparent' },
  { accent: 'hsl(271 91% 65%)', bg: 'from-purple-500/5 to-transparent' },
  { accent: 'hsl(25 95% 53%)', bg: 'from-orange-500/5 to-transparent' },
  { accent: 'hsl(330 81% 60%)', bg: 'from-pink-500/5 to-transparent' },
]

function getCourseColorIndex(label?: string | null): number {
  if (!label) return 0
  let hash = 0
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash) % COURSE_COLORS.length
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

    // Track course selection in analytics
    systemEventBus.emit(SYSTEM_EVENTS.COURSE_ENTERED, {
      course_id: course.id,
      course_title: course.title,
    })

    // Navigate to home page after localStorage is updated
    router.push('/')
  }

  const colorIndex = getCourseColorIndex(course.courseLabel)
  const courseColor = COURSE_COLORS[colorIndex]

  return (
    <div
      className={cn(
        'group relative rounded-xl bg-card border border-border/30',
        'transition-all duration-normal will-change-transform',
        'hover:border-border/50 active:scale-[0.98]',
        'flex flex-col',
        isSoon && 'opacity-50',
      )}
      style={{
        borderInlineStartWidth: '3px',
        borderInlineStartColor: courseColor.accent,
      }}
    >
      <div className="p-5 flex flex-col flex-1">
        {isOwned && (
          <span className="absolute -top-3 start-6 bg-success text-white px-4 py-1 rounded-full shadow-elevation-3 uppercase tracking-wider text-[9px] font-black z-10">
            {t('yourCourse') ?? '\u05D4\u05E7\u05D5\u05E8\u05E1 \u05E9\u05DC\u05DA'}
          </span>
        )}

        {/* Content Status Badge - top right */}
        <ContentStatusBadge
          contentStatus={course.contentStatus}
          contentStatusExpiresAt={course.contentStatusExpiresAt ?? undefined}
          contentStatusLabel={course.contentStatusLabel ?? undefined}
          className="absolute -top-3 end-6 z-10"
        />

        {/* Course label as muted badge */}
        {course.courseLabel && (
          <span className="inline-block self-start mb-3 bg-muted text-foreground text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
            {course.courseLabel}
          </span>
        )}

        {/* Title */}
        <h4 className="text-heading-md font-bold text-card-foreground text-start mb-2 break-words">
          {course.title}
        </h4>

        {/* Description */}
        {course.description && (
          <SafeHtml
            html={course.description}
            className="text-body-sm text-muted-foreground line-clamp-2 text-start [&_p]:m-0 break-words"
          />
        )}

        {/* Progress ring - hero element for owned courses with progress */}
        {isOwned && courseProgress > 0 && (
          <div className="flex justify-center my-6">
            <div className="w-16 h-16 relative">
              <ProgressCircle
                percentage={courseProgress}
                size={64}
                strokeWidth={4}
                strokeColor={courseColor.accent}
              >
                {courseProgress >= 100 ? (
                  <foreignObject x="25%" y="25%" width="50%" height="50%">
                    <CheckCircle className="w-full h-full text-success" />
                  </foreignObject>
                ) : (
                  <text
                    x="50%"
                    y="50%"
                    textAnchor="middle"
                    dy=".3em"
                    className="text-body-sm font-bold fill-foreground"
                  >
                    {Math.round(courseProgress)}%
                  </text>
                )}
              </ProgressCircle>
            </div>
          </div>
        )}

        {/* Spacer to push button to bottom */}
        <div className="flex-1" />

        {/* Action area */}
        <div className="mt-6 pt-5 border-t border-border/50">
          <Button
            onClick={handleCourseSelect}
            disabled={isLoading || isSoon}
            className={cn(
              'w-full min-h-[44px]',
              isOwned
                ? 'bg-success/10 text-success hover:bg-success/20'
                : isSoon
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'bg-muted text-primary hover:bg-primary/5',
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
    </div>
  )
}
