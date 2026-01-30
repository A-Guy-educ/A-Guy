'use client'

import { SYSTEM_EVENTS, systemEventBus } from '@/infra/system-events'
import { useEffect } from 'react'

interface CourseAnalyticsProps {
  courseId: string
  courseTitle: string
}

export function CourseAnalytics({ courseId, courseTitle }: CourseAnalyticsProps) {
  useEffect(() => {
    systemEventBus.emit(SYSTEM_EVENTS.COURSE_ENTERED, {
      course_id: courseId,
      course_title: courseTitle,
    })
  }, [courseId, courseTitle])

  return null
}
