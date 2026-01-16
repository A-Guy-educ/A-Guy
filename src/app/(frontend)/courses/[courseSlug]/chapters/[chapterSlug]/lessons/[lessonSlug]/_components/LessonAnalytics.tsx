'use client'

import { useEffect } from 'react'
import { PRODUCT_EVENTS } from '@/lib/analytics/contracts/events'
import { useAnalytics } from '@/lib/analytics/providers/AnalyticsProvider'

interface LessonAnalyticsProps {
  lessonId: string
  courseId: string
  lessonTitle: string
}

export function LessonAnalytics({ lessonId, courseId, lessonTitle }: LessonAnalyticsProps) {
  const analytics = useAnalytics()

  useEffect(() => {
    analytics.track(PRODUCT_EVENTS.LESSON_STARTED, {
      lesson_id: lessonId,
      course_id: courseId,
      lesson_title: lessonTitle,
    })
  }, [lessonId, courseId, lessonTitle, analytics])

  return null
}
