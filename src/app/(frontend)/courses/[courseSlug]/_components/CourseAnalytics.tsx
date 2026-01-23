'use client'

import { useEffect } from 'react'
import { PRODUCT_EVENTS } from '@/infra/analytics/contracts/events'
import { useAnalytics } from '@/infra/analytics/providers/AnalyticsProvider'

interface CourseAnalyticsProps {
  courseId: string
  courseTitle: string
}

export function CourseAnalytics({ courseId, courseTitle }: CourseAnalyticsProps) {
  const analytics = useAnalytics()

  useEffect(() => {
    analytics.track(PRODUCT_EVENTS.COURSE_ENTERED, {
      course_id: courseId,
      course_title: courseTitle,
    })
  }, [courseId, courseTitle, analytics])

  return null
}
