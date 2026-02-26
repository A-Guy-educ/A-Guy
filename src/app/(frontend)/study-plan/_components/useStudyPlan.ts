'use client'

import { useCallback, useEffect, useState } from 'react'

import type { StudyPlanSnapshot, TopicInput } from '@/lib/study-plan'

interface UseStudyPlanReturn {
  plan: StudyPlanSnapshot | null
  isLoading: boolean
  error: string | null
  generatePlan: (examDate: string, topics: TopicInput[], courseId: string) => Promise<void>
  markDayComplete: (dayId: string) => Promise<void>
}

export function useStudyPlan(): UseStudyPlanReturn {
  const [plan, setPlan] = useState<StudyPlanSnapshot | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Hardcoded for demo - in production this would come from user context
  const gradeLevel = 'default'

  // Fetch existing plan on mount
  useEffect(() => {
    async function fetchPlan() {
      try {
        setIsLoading(true)
        const response = await fetch(
          `/api/study-plan?gradeLevel=${gradeLevel}&courseId=default-course`,
        )

        if (!response.ok) {
          throw new Error('Failed to fetch plan')
        }

        const data = await response.json()

        if (data.success && data.data) {
          setPlan(data.data)
        }
      } catch (err) {
        console.error('Error fetching study plan:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setIsLoading(false)
      }
    }

    fetchPlan()
  }, [gradeLevel])

  const generatePlan = useCallback(
    async (examDate: string, topics: TopicInput[], courseId: string) => {
      try {
        setIsLoading(true)
        setError(null)

        const response = await fetch('/api/study-plan', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'generate',
            courseId,
            examDate,
            topics,
            gradeLevel,
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to generate plan')
        }

        const data = await response.json()

        if (data.success && data.data) {
          setPlan(data.data)
        }
      } catch (err) {
        console.error('Error generating study plan:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setIsLoading(false)
      }
    },
    [gradeLevel],
  )

  const markDayComplete = useCallback(
    async (dayId: string) => {
      if (!plan) return

      // Optimistic update
      const previousPlan = plan
      setPlan({
        ...plan,
        days: plan.days.map((day) => (day.dayId === dayId ? { ...day, status: 'completed' } : day)),
      })

      try {
        const response = await fetch('/api/study-plan', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'markComplete',
            dayId,
            courseId: plan.courseId,
            gradeLevel,
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to mark day complete')
        }

        const data = await response.json()

        if (data.success && data.data) {
          setPlan(data.data)
        }
      } catch (err) {
        console.error('Error marking day complete:', err)
        // Revert on failure
        setPlan(previousPlan)
        setError(err instanceof Error ? err.message : 'Unknown error')
      }
    },
    [plan, gradeLevel],
  )

  return {
    plan,
    isLoading,
    error,
    generatePlan,
    markDayComplete,
  }
}
