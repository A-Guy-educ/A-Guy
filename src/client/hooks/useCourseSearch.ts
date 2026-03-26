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

interface UseCourseSlugReturn {
  courseSlug: string | null
  /** True while resolving the slug from the user's grade profile */
  isResolving: boolean
}

/**
 * Resolves the courseSlug from the URL path or the user's grade profile.
 * If the URL contains /courses/[slug], that slug is used directly.
 * Otherwise, the user's grade level from localStorage is used to look up
 * their course via the API. This means the search works from ANY page
 * as long as the user has completed onboarding.
 */
export function useCourseSlug(pathname: string): UseCourseSlugReturn {
  const [slugFromProfile, setSlugFromProfile] = useState<string | null>(null)
  const [isResolving, setIsResolving] = useState(true)

  const slugFromPath = extractCourseSlugFromPath(pathname)

  useEffect(() => {
    // If we already have a slug from the URL, no need to resolve
    if (slugFromPath) {
      setIsResolving(false)
      return
    }

    const profile = getUserProfile()
    if (!profile?.gradeLevel) {
      setSlugFromProfile(null)
      setIsResolving(false)
      return
    }

    setIsResolving(true)

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
      .finally(() => {
        setIsResolving(false)
      })
  }, [slugFromPath, pathname])

  return {
    courseSlug: slugFromPath ?? slugFromProfile,
    isResolving: isResolving && !slugFromPath,
  }
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
