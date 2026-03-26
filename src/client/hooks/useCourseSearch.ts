'use client'

import { useEffect, useRef, useState } from 'react'
import { useDebounce } from '@/client/hooks/useDebounce'
import { getUserProfile } from '@/client/state/localStorage/userProfile'

interface SearchResultLesson {
  id: string
  title: string
  type: string
  url: string
}

interface SearchResultExercise {
  id: string
  title: string
  lessonTitle: string
  url: string
}

interface SearchResultQuestion {
  id: string
  promptSnippet: string
  exerciseTitle: string
  url: string
}

export interface CourseSearchResults {
  lessons: SearchResultLesson[]
  exercises: SearchResultExercise[]
  questions: SearchResultQuestion[]
}

interface UseCourseSearchReturn {
  results: CourseSearchResults | null
  isLoading: boolean
  enrolled: boolean | null
  error: string | null
}

/**
 * Extract the courseSlug from a pathname like /courses/[courseSlug]/...
 */
export function extractCourseSlugFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/courses\/([^/]+)/)
  return match?.[1] ?? null
}

/** Pages where course content is displayed (resolved via grade profile) */
const COURSE_CONTEXT_PAGES = ['/study', '/practice', '/ask']

/**
 * Resolves the courseSlug from the URL path or the user's grade profile.
 * On /study, /practice, /ask pages the course is determined by the user's
 * selected grade level stored in localStorage.
 */
export function useCourseSlug(pathname: string): string | null {
  const [slugFromProfile, setSlugFromProfile] = useState<string | null>(null)

  const slugFromPath = extractCourseSlugFromPath(pathname)
  const isCoursePage = COURSE_CONTEXT_PAGES.some((p) => pathname.startsWith(p))

  useEffect(() => {
    if (slugFromPath || !isCoursePage) {
      setSlugFromProfile(null)
      return
    }

    const profile = getUserProfile()
    if (!profile?.gradeLevel) {
      setSlugFromProfile(null)
      return
    }

    fetch(`/api/chapters/by-grade?grade=${profile.gradeLevel}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.courseSlug) {
          setSlugFromProfile(data.courseSlug)
        }
      })
      .catch(() => {
        setSlugFromProfile(null)
      })
  }, [slugFromPath, isCoursePage, pathname])

  return slugFromPath ?? slugFromProfile
}

export function useCourseSearch(query: string, courseSlug: string | null): UseCourseSearchReturn {
  const [results, setResults] = useState<CourseSearchResults | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [enrolled, setEnrolled] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => {
    if (!courseSlug || debouncedQuery.length < 2) {
      setResults(null)
      setEnrolled(null)
      setError(null)
      setIsLoading(false)
      return
    }

    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    setIsLoading(true)
    setError(null)

    const searchUrl = `/api/course-search?q=${encodeURIComponent(debouncedQuery)}&courseSlug=${encodeURIComponent(courseSlug)}`

    fetch(searchUrl, {
      signal: controller.signal,
      credentials: 'include',
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Search failed: ${res.status}`)
        return res.json()
      })
      .then((data) => {
        if (controller.signal.aborted) return
        setEnrolled(data.enrolled)
        setResults(data.results)
        setIsLoading(false)
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err.message)
        setIsLoading(false)
      })

    return () => {
      controller.abort()
    }
  }, [debouncedQuery, courseSlug])

  return { results, isLoading, enrolled, error }
}
