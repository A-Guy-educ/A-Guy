'use client'

import { useEffect, useRef } from 'react'
import { PRODUCT_EVENTS } from '@/lib/analytics/contracts/events'
import { useAnalytics } from '@/lib/analytics/providers/AnalyticsProvider'

interface LessonAnalyticsProps {
  lessonId: string
  courseId: string
  lessonTitle: string
}

export function LessonAnalytics({ lessonId, courseId, lessonTitle }: LessonAnalyticsProps) {
  const analytics = useAnalytics()
  const startTimeRef = useRef<number>(Date.now())

  useEffect(() => {
    // Track lesson started
    startTimeRef.current = Date.now()
    analytics.track(PRODUCT_EVENTS.LESSON_STARTED, {
      lesson_id: lessonId,
      course_id: courseId,
      lesson_title: lessonTitle,
    })

    // Track lesson completed on unmount (when user navigates away)
    return () => {
      const completionTimeSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000)
      analytics.track(PRODUCT_EVENTS.LESSON_COMPLETED, {
        lesson_id: lessonId,
        course_id: courseId,
        completion_time_seconds: completionTimeSeconds,
      })
    }
  }, [lessonId, courseId, lessonTitle, analytics])

  return null
}
