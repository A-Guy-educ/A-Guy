'use client'

import { SYSTEM_EVENTS, systemEventBus } from '@/infra/system-events'
import { useEffect, useRef } from 'react'

interface LessonAnalyticsProps {
  lessonId: string
  courseId: string
  lessonTitle: string
}

export function LessonAnalytics({ lessonId, courseId, lessonTitle }: LessonAnalyticsProps) {
  const startTimeRef = useRef<number>(Date.now())

  useEffect(() => {
    // Track lesson started
    startTimeRef.current = Date.now()
    systemEventBus.emit(SYSTEM_EVENTS.LESSON_STARTED, {
      lesson_id: lessonId,
      course_id: courseId,
      lesson_title: lessonTitle,
    })

    // Track lesson ended on unmount (when user navigates away)
    return () => {
      const durationSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000)
      systemEventBus.emit(SYSTEM_EVENTS.LESSON_ENDED, {
        lesson_id: lessonId,
        duration_seconds: durationSeconds,
      })
    }
  }, [lessonId, courseId, lessonTitle])

  return null
}
