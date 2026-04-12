'use client'

import { getUserProfile, setUserProfile } from '@/client/state/localStorage/userProfile'
import { useLoadingState } from '@/infra/loading/hooks/useLoadingState'
import { useRouterWithLoading } from '@/infra/loading/hooks/useRouterWithLoading'
import { LOADING_KEYS } from '@/infra/loading/keys'
import { SYSTEM_EVENTS, systemEventBus } from '@/infra/system-events'
import type { Course } from '@/payload-types'
import { UnifiedCard } from '@/ui/web/components/UnifiedCard'
import { SafeHtml } from '@/ui/web/SafeHtml'
import { useTranslations } from '@/ui/web/providers/I18n'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

const COURSE_COLORS = [
  'hsl(217 91% 60%)',
  'hsl(142 71% 45%)',
  'hsl(271 91% 65%)',
  'hsl(25 95% 53%)',
  'hsl(330 81% 60%)',
]

function getCourseColor(label?: string | null): string {
  if (!label) return COURSE_COLORS[0]
  let hash = 0
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash)
  }
  return COURSE_COLORS[Math.abs(hash) % COURSE_COLORS.length]
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
  const accentColor = getCourseColor(course.courseLabel)
  const isSoon = course.contentStatus === 'soon'
  const isLoading = wasClicked && isRouteLoading

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

  const handleCourseSelect = () => {
    if (isSoon) {
      toast.info(t('contentLocked'))
      return
    }

    setWasClicked(true)

    const gradeLevel = course.courseLabel || '8'
    const existingProfile = getUserProfile()
    setUserProfile({
      gradeLevel,
      mood: existingProfile?.mood || '',
      lastVisit: new Date().toISOString(),
    })

    systemEventBus.emit(SYSTEM_EVENTS.COURSE_ENTERED, {
      course_id: course.id,
      course_title: course.title,
    })

    router.push('/')
  }

  return (
    <UnifiedCard
      variant="lesson"
      title={course.title}
      description={course.description ? <SafeHtml html={course.description} /> : undefined}
      label={course.courseLabel}
      accentColor={accentColor}
      isOwned={isOwned}
      contentStatus={course.contentStatus}
      contentStatusExpiresAt={course.contentStatusExpiresAt ?? undefined}
      contentStatusLabel={course.contentStatusLabel ?? undefined}
      progress={isOwned && courseProgress > 0 ? courseProgress : undefined}
      buttonLabel={
        isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin me-2" />
            {t('openCourse')}
          </>
        ) : (
          t('openCourse')
        )
      }
      onButtonClick={handleCourseSelect}
      buttonClassName={
        isOwned
          ? 'bg-success/10 text-success hover:bg-success/20'
          : isSoon
            ? 'bg-muted text-muted-foreground cursor-not-allowed'
            : 'bg-muted text-primary hover:bg-primary/5'
      }
    />
  )
}
