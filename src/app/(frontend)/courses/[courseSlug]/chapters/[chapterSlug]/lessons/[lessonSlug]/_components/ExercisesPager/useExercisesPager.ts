import { useCallback, useEffect, useState } from 'react'
import type { Exercise } from '@/payload-types'
import { getExerciseUrlParam } from '@/utilities/getExerciseUrlParam'

type PageType = 'intro' | 'about' | 'exercise' | 'outro'

interface PageState {
  type: PageType
  pageNumber: number
  exerciseIndex?: number
}

interface UseExercisesPagerProps {
  exercises: Exercise[]
  courseSlug: string
  chapterSlug: string
  lessonSlug: string
  hasAboutPage?: boolean
}

export function useExercisesPager({
  exercises,
  courseSlug,
  chapterSlug,
  lessonSlug,
  hasAboutPage = false,
}: UseExercisesPagerProps) {
  // When hasAboutPage, pages are: intro(0) → about(1) → exercises(2..n+1) → outro(n+2)
  // Without about: intro(0) → exercises(1..n) → outro(n+1)
  const aboutOffset = hasAboutPage ? 1 : 0
  const [pageState, setPageState] = useState<PageState>({
    type: 'intro',
    pageNumber: 0,
  })

  const basePath = `/courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lessonSlug}`
  const introUrl = basePath
  const aboutUrl = `${basePath}/about`
  const completeUrl = `${basePath}/complete`

  // intro + about(optional) + exercises + outro
  const totalPages = exercises.length + 2 + aboutOffset
  const firstExercisePage = 1 + aboutOffset

  const getExerciseUrl = useCallback(
    (index: number) => {
      const exercise = exercises[index]
      if (!exercise) return introUrl
      const slug = getExerciseUrlParam(exercise)
      return `${basePath}/exercises/${slug}`
    },
    [basePath, exercises, introUrl],
  )

  useEffect(() => {
    if (typeof window === 'undefined') return

    const pathname = window.location.pathname

    if (pathname === completeUrl) {
      setPageState({ type: 'outro', pageNumber: exercises.length + 1 + aboutOffset })
    } else if (hasAboutPage && pathname === aboutUrl) {
      setPageState({ type: 'about', pageNumber: 1 })
    } else if (pathname.startsWith(`${basePath}/exercises/`)) {
      const exerciseSlug = pathname.split('/exercises/')[1]
      const index = exercises.findIndex((e) => getExerciseUrlParam(e) === exerciseSlug)
      if (index >= 0) {
        setPageState({
          type: 'exercise',
          pageNumber: index + firstExercisePage,
          exerciseIndex: index,
        })
      }
    }
  }, [basePath, completeUrl, exercises, hasAboutPage, aboutUrl, aboutOffset, firstExercisePage])

  const syncUrl = useCallback(
    (state: PageState) => {
      if (typeof window === 'undefined') return

      let newUrl: string
      if (state.type === 'intro') {
        newUrl = introUrl
      } else if (state.type === 'about') {
        newUrl = aboutUrl
      } else if (state.type === 'exercise' && state.exerciseIndex !== undefined) {
        newUrl = getExerciseUrl(state.exerciseIndex)
      } else if (state.type === 'outro') {
        newUrl = completeUrl
      } else {
        return
      }

      const currentPath = window.location.pathname
      if (currentPath !== newUrl) {
        window.history.replaceState(null, '', newUrl)
      }
    },
    [introUrl, aboutUrl, completeUrl, getExerciseUrl],
  )

  const pageToState = useCallback(
    (page: number): PageState => {
      if (page === 0) return { type: 'intro', pageNumber: 0 }
      if (hasAboutPage && page === 1) return { type: 'about', pageNumber: 1 }
      if (page === totalPages - 1) return { type: 'outro', pageNumber: page }
      const exerciseIndex = page - firstExercisePage
      return { type: 'exercise', pageNumber: page, exerciseIndex }
    },
    [hasAboutPage, totalPages, firstExercisePage],
  )

  const handleNext = useCallback(() => {
    setPageState((prev) => {
      const nextPage = prev.pageNumber + 1
      if (nextPage >= totalPages) return prev
      return pageToState(nextPage)
    })
  }, [totalPages, pageToState])

  const handlePrev = useCallback(() => {
    setPageState((prev) => {
      const prevPage = prev.pageNumber - 1
      if (prevPage < 0) return prev
      return pageToState(prevPage)
    })
  }, [pageToState])

  const handleStart = useCallback(() => {
    if (hasAboutPage) {
      setPageState({ type: 'about', pageNumber: 1 })
      return
    }
    if (exercises.length === 0) {
      setPageState({ type: 'outro', pageNumber: totalPages - 1 })
      return
    }
    setPageState({ type: 'exercise', pageNumber: firstExercisePage, exerciseIndex: 0 })
  }, [hasAboutPage, exercises.length, totalPages, firstExercisePage])

  const handleStartExercises = useCallback(() => {
    if (exercises.length === 0) {
      setPageState({ type: 'outro', pageNumber: totalPages - 1 })
      return
    }
    setPageState({ type: 'exercise', pageNumber: firstExercisePage, exerciseIndex: 0 })
  }, [exercises.length, totalPages, firstExercisePage])

  useEffect(() => {
    syncUrl(pageState)
  }, [pageState, syncUrl])

  const progressPercent = ((pageState.pageNumber + 1) / totalPages) * 100

  const getExerciseOrdinal = useCallback(() => {
    if (pageState.type !== 'exercise' || pageState.exerciseIndex === undefined) return null
    return pageState.exerciseIndex + 1
  }, [pageState])

  return {
    pageState,
    totalPages,
    progressPercent,
    canGoNext: pageState.pageNumber < totalPages - 1,
    canGoPrev: pageState.pageNumber > 0,
    handleNext,
    handlePrev,
    handleStart,
    handleStartExercises,
    getExerciseOrdinal,
    totalExercises: exercises.length,
  }
}
