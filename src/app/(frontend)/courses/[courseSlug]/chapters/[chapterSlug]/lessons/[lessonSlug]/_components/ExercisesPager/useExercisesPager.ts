import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import type { Exercise } from '@/payload-types'
import { getUserProfile } from '@/client/state/localStorage/userProfile'
import { getExerciseUrlParam } from './getExerciseUrlParam'

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
  lessonId: string
  hasAboutPage?: boolean
}

/** Fire-and-forget progress save (silently ignores errors / unauthenticated users) */
function saveProgress(params: {
  recordType: 'lesson' | 'exercise' | 'chapter'
  recordId: string
  completionPercentage: number
  status: 'not_started' | 'in_progress' | 'completed'
  score?: number
}) {
  const profile = getUserProfile()
  if (!profile?.gradeLevel) return
  fetch('/api/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ ...params, gradeLevel: profile.gradeLevel }),
  }).catch(() => {
    /* silent – user may be anonymous */
  })
}

export function useExercisesPager({
  exercises,
  courseSlug,
  chapterSlug,
  lessonSlug,
  lessonId,
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

  const [isPending, startTransition] = useTransition()

  // Only show loading UI if transition takes longer than 300ms (avoid flash on instant nav)
  const [isNavigating, setIsNavigating] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isPending) {
      timerRef.current = setTimeout(() => setIsNavigating(true), 300)
    } else {
      if (timerRef.current) clearTimeout(timerRef.current)
      setIsNavigating(false)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [isPending])

  // Track whether we already saved completion for this lesson (avoid duplicate writes)
  const completionSavedRef = useRef(false)
  // Track visited exercises so we only save progress once per exercise
  const visitedExercisesRef = useRef(new Set<number>())

  /** Save exercise + incremental lesson progress when leaving an exercise page */
  const saveExerciseProgress = useCallback(
    (prevState: PageState) => {
      if (prevState.type !== 'exercise' || prevState.exerciseIndex === undefined) return
      const exercise = exercises[prevState.exerciseIndex]
      if (!exercise) return

      // Mark exercise as visited
      visitedExercisesRef.current.add(prevState.exerciseIndex)

      // Save exercise-level record
      saveProgress({
        recordType: 'exercise',
        recordId: exercise.id,
        completionPercentage: 100,
        status: 'completed',
      })

      // Save incremental lesson progress (% of exercises visited)
      const visitedCount = visitedExercisesRef.current.size
      const totalExercises = exercises.length
      if (totalExercises > 0 && !completionSavedRef.current) {
        const pct = Math.round((visitedCount / totalExercises) * 100)
        saveProgress({
          recordType: 'lesson',
          recordId: lessonId,
          completionPercentage: Math.min(pct, 99), // cap at 99 until outro
          status: 'in_progress',
        })
      }
    },
    [exercises, lessonId],
  )

  const handleNext = useCallback(() => {
    // Capture current state before transition for exercise progress saving
    setPageState((prev) => prev) // no-op to access current state
    startTransition(() => {
      setPageState((prev) => {
        const nextPage = prev.pageNumber + 1
        if (nextPage >= totalPages) return prev
        const nextState = pageToState(nextPage)

        // Save lesson completion when reaching the outro page
        // Set flag BEFORE saveExerciseProgress to prevent race with 99% write
        if (nextState.type === 'outro' && !completionSavedRef.current) {
          completionSavedRef.current = true
        }

        // Save exercise progress when leaving an exercise
        saveExerciseProgress(prev)

        // Fire 100% save after exercise progress to ensure correct final state
        if (nextState.type === 'outro') {
          saveProgress({
            recordType: 'lesson',
            recordId: lessonId,
            completionPercentage: 100,
            status: 'completed',
          })
        }

        return nextState
      })
    })
  }, [totalPages, pageToState, startTransition, lessonId, saveExerciseProgress])

  const handlePrev = useCallback(() => {
    startTransition(() => {
      setPageState((prev) => {
        const prevPage = prev.pageNumber - 1
        if (prevPage < 0) return prev

        // Save exercise progress when leaving an exercise
        saveExerciseProgress(prev)

        return pageToState(prevPage)
      })
    })
  }, [pageToState, startTransition, saveExerciseProgress])

  const handleStart = useCallback(() => {
    if (hasAboutPage) {
      setPageState({ type: 'about', pageNumber: 1 })
      return
    }
    if (exercises.length === 0) {
      setPageState({ type: 'outro', pageNumber: totalPages - 1 })
      return
    }
    // Mark lesson as in_progress when starting exercises
    saveProgress({
      recordType: 'lesson',
      recordId: lessonId,
      completionPercentage: 0,
      status: 'in_progress',
    })
    setPageState({ type: 'exercise', pageNumber: firstExercisePage, exerciseIndex: 0 })
  }, [hasAboutPage, exercises.length, totalPages, firstExercisePage, lessonId])

  const handleStartExercises = useCallback(() => {
    if (exercises.length === 0) {
      setPageState({ type: 'outro', pageNumber: totalPages - 1 })
      return
    }
    // Mark lesson as in_progress when starting exercises
    saveProgress({
      recordType: 'lesson',
      recordId: lessonId,
      completionPercentage: 0,
      status: 'in_progress',
    })
    setPageState({ type: 'exercise', pageNumber: firstExercisePage, exerciseIndex: 0 })
  }, [exercises.length, totalPages, firstExercisePage, lessonId])

  useEffect(() => {
    syncUrl(pageState)
  }, [pageState, syncUrl])

  const progressPercent = (() => {
    if (pageState.type === 'intro') return 0
    if (pageState.type === 'about') return 0
    if (pageState.type === 'outro') return 100

    // For exercise pages, calculate based on exercise completion
    if (pageState.type === 'exercise' && pageState.exerciseIndex !== undefined) {
      const totalExercises = exercises.length
      if (totalExercises === 0) return 0
      return ((pageState.exerciseIndex + 1) / totalExercises) * 100
    }

    return 0
  })()

  const getExerciseOrdinal = useCallback(() => {
    if (pageState.type !== 'exercise' || pageState.exerciseIndex === undefined) return null
    return pageState.exerciseIndex + 1
  }, [pageState])

  return {
    pageState,
    totalPages,
    progressPercent,
    isNavigating,
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
