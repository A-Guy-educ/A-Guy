'use client'

import { useEffect, useRef, useState } from 'react'
import { useDebounce } from '@/client/hooks/useDebounce'

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

interface SearchResultCourse {
  id: string
  title: string
  url: string
}

export interface CourseSearchResults {
  courses?: SearchResultCourse[]
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

/**
 * Returns the courseSlug only if the URL is inside a specific course
 * (e.g. /courses/[slug]/...). Otherwise returns null for global search.
 */
export function useCourseSlug(pathname: string): string | null {
  return extractCourseSlugFromPath(pathname)
}

export function useCourseSearch(query: string, courseSlug: string | null): UseCourseSearchReturn {
  const [results, setResults] = useState<CourseSearchResults | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [enrolled, setEnrolled] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => {
    if (debouncedQuery.length < 2) {
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

    const params = new URLSearchParams({ q: debouncedQuery })
    if (courseSlug) params.set('courseSlug', courseSlug)
    const searchUrl = `/api/course-search?${params.toString()}`

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
