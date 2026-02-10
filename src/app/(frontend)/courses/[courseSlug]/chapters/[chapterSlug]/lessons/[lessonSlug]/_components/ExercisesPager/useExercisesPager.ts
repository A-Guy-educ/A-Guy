import { useCallback, useEffect, useState } from 'react'
import type { Exercise } from '@/payload-types'
import { getExerciseUrlParam } from '@/utilities/getExerciseUrlParam'

type PageType = 'intro' | 'exercise' | 'outro'

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
}

export function useExercisesPager({
  exercises,
  courseSlug,
  chapterSlug,
  lessonSlug,
}: UseExercisesPagerProps) {
  const [pageState, setPageState] = useState<PageState>({
    type: 'intro',
    pageNumber: 0,
  })

  const basePath = `/courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lessonSlug}`
  const introUrl = basePath
  const completeUrl = `${basePath}/complete`

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
      const totalPages = exercises.length + 2
      setPageState({
        type: 'outro',
        pageNumber: totalPages - 1,
      })
    } else if (pathname.startsWith(`${basePath}/exercises/`)) {
      const exerciseSlug = pathname.split('/exercises/')[1]
      const index = exercises.findIndex((e) => getExerciseUrlParam(e) === exerciseSlug)
      if (index >= 0) {
        setPageState({
          type: 'exercise',
          pageNumber: index + 1,
          exerciseIndex: index,
        })
      }
    }
  }, [basePath, completeUrl, exercises])

  const syncUrl = useCallback(
    (state: PageState) => {
      if (typeof window === 'undefined') return

      let newUrl: string
      if (state.type === 'intro') {
        newUrl = introUrl
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
    [introUrl, completeUrl, getExerciseUrl],
  )

  const totalPages = exercises.length + 2

  const handleNext = useCallback(() => {
    setPageState((prev) => {
      const nextPage = prev.pageNumber + 1

      let newState: PageState
      if (nextPage === totalPages - 1) {
        newState = { type: 'outro' as const, pageNumber: nextPage }
      } else if (nextPage > 0 && nextPage < totalPages - 1) {
        newState = {
          type: 'exercise' as const,
          pageNumber: nextPage,
          exerciseIndex: nextPage - 1,
        }
      } else {
        return prev
      }

      return newState
    })
  }, [totalPages])

  const handlePrev = useCallback(() => {
    setPageState((prev) => {
      const prevPage = prev.pageNumber - 1

      if (prevPage === 0) {
        return { type: 'intro' as const, pageNumber: 0 }
      } else if (prevPage > 0 && prevPage < totalPages - 1) {
        return {
          type: 'exercise' as const,
          pageNumber: prevPage,
          exerciseIndex: prevPage - 1,
        }
      }

      return prev
    })
  }, [totalPages])

  const handleStart = useCallback(() => {
    if (exercises.length === 0) {
      setPageState({ type: 'outro' as const, pageNumber: totalPages - 1 })
      return
    }

    setPageState({
      type: 'exercise' as const,
      pageNumber: 1,
      exerciseIndex: 0,
    })
  }, [exercises.length, totalPages])

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
    getExerciseOrdinal,
    totalExercises: exercises.length,
  }
}
