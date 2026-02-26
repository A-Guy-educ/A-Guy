/**
 * localStorage utilities for exam date tracking per course.
 * SSR-safe implementations that check for window availability.
 *
 * Data is stored per-course using the course ID as key.
 * Each entry holds an array of exam objects with id, date, and optional label.
 */

export interface ExamDate {
  id: string
  date: string // ISO date string (YYYY-MM-DD)
  label?: string
}

interface ExamDatesData {
  exams: ExamDate[]
}

const STORAGE_KEY_PREFIX = 'a-guy:exam-dates:'

export const getExamDates = (courseId: string): ExamDate[] => {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${courseId}`)
    if (!raw) return []
    const data: ExamDatesData = JSON.parse(raw)
    return data.exams ?? []
  } catch {
    return []
  }
}

export const setExamDates = (courseId: string, exams: ExamDate[]): void => {
  if (typeof window === 'undefined') return
  try {
    const data: ExamDatesData = { exams }
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${courseId}`, JSON.stringify(data))
  } catch {
    // Storage full or unavailable
  }
}

export const addExamDate = (courseId: string, exam: ExamDate): void => {
  const current = getExamDates(courseId)
  setExamDates(courseId, [...current, exam])
}

export const removeExamDate = (courseId: string, examId: string): void => {
  const current = getExamDates(courseId)
  setExamDates(
    courseId,
    current.filter((e) => e.id !== examId),
  )
}
