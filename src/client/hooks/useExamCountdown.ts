'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  addExamDate as addExam,
  getExamDates,
  removeExamDate as removeExam,
  type ExamDate,
} from '@/client/state/localStorage/examDates'

function getDaysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export function useExamCountdown(courseId: string) {
  const [allExams, setAllExams] = useState<ExamDate[]>([])

  const reload = useCallback(() => {
    setAllExams(getExamDates(courseId))
  }, [courseId])

  useEffect(() => {
    reload()
    const interval = setInterval(reload, 60_000)
    return () => clearInterval(interval)
  }, [reload])

  const upcomingExams = allExams
    .filter((e) => getDaysUntil(e.date) >= 0)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const pastExams = allExams
    .filter((e) => getDaysUntil(e.date) < 0)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const nearestExam = upcomingExams[0] ?? null
  const daysUntil = nearestExam ? getDaysUntil(nearestExam.date) : null

  const handleAddExam = useCallback(
    (exam: ExamDate) => {
      addExam(courseId, exam)
      reload()
    },
    [courseId, reload],
  )

  const handleRemoveExam = useCallback(
    (examId: string) => {
      removeExam(courseId, examId)
      reload()
    },
    [courseId, reload],
  )

  return {
    nearestExam,
    daysUntil,
    hasUpcomingExam: upcomingExams.length > 0,
    upcomingExams,
    pastExams,
    allExams,
    addExam: handleAddExam,
    removeExam: handleRemoveExam,
  }
}
