'use client'

import { getUserProfile } from '@/client/state/localStorage/userProfile'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'

type PageType = 'intro' | 'pdf' | 'outro'

interface PageState {
  type: PageType
  pageNumber: number
}

interface UsePdfLessonPagerProps {
  fileCount: number
  courseSlug: string
  chapterSlug: string
  lessonSlug: string
  lessonId: string
}

/** Fire-and-forget progress save (silently ignores errors / unauthenticated users) */
function saveProgress(params: {
  recordType: 'lesson' | 'chapter'
  recordId: string
  completionPercentage: number
  status: 'not_started' | 'in_progress' | 'completed'
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

export function usePdfLessonPager({
  fileCount,
  courseSlug,
  chapterSlug,
  lessonSlug,
  lessonId,
}: UsePdfLessonPagerProps) {
  // Pages: intro(0) → pdf(1) → outro(2)
  const totalPages = 3 // intro + pdf + outro
  const [pageState, setPageState] = useState<PageState>({
    type: 'intro',
    pageNumber: 0,
  })

  const basePath = `/courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lessonSlug}`
  const introUrl = basePath
  const pdfUrl = basePath
  const completeUrl = `${basePath}/complete`

  useEffect(() => {
    if (typeof window === 'undefined') return

    const pathname = window.location.pathname

    if (pathname === completeUrl) {
      setPageState({ type: 'outro', pageNumber: 2 })
    } else if (pathname === pdfUrl) {
      setPageState({ type: 'pdf', pageNumber: 1 })
    }
    // Default stays on intro (pageNumber: 0)
  }, [basePath, completeUrl, pdfUrl])

  const syncUrl = useCallback(
    (state: PageState) => {
      if (typeof window === 'undefined') return

      let newUrl: string
      if (state.type === 'intro') {
        newUrl = introUrl
      } else if (state.type === 'pdf') {
        newUrl = pdfUrl
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
    [introUrl, pdfUrl, completeUrl],
  )

  const pageToState = useCallback((page: number): PageState => {
    if (page === 0) return { type: 'intro', pageNumber: 0 }
    if (page === 1) return { type: 'pdf', pageNumber: 1 }
    return { type: 'outro', pageNumber: 2 }
  }, [])

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

  const completionSavedRef = useRef(false)

  const handleNext = useCallback(() => {
    startTransition(() => {
      setPageState((prev) => {
        const nextPage = prev.pageNumber + 1
        if (nextPage >= totalPages) return prev
        const nextState = pageToState(nextPage)

        // Save lesson completion when reaching the outro page
        if (nextState.type === 'outro' && !completionSavedRef.current) {
          completionSavedRef.current = true
          saveProgress({
            recordType: 'lesson',
            recordId: lessonId,
            completionPercentage: 100,
            status: 'completed',
          })
        }

        // Mark lesson as in_progress when moving from intro to pdf
        if (prev.type === 'intro' && nextState.type === 'pdf') {
          saveProgress({
            recordType: 'lesson',
            recordId: lessonId,
            completionPercentage: 50,
            status: 'in_progress',
          })
        }

        return nextState
      })
    })
  }, [totalPages, pageToState, startTransition, lessonId])

  const handlePrev = useCallback(() => {
    startTransition(() => {
      setPageState((prev) => {
        const prevPage = prev.pageNumber - 1
        if (prevPage < 0) return prev
        return pageToState(prevPage)
      })
    })
  }, [pageToState, startTransition])

  const handleStart = useCallback(() => {
    // Mark lesson as in_progress when starting PDF view
    saveProgress({
      recordType: 'lesson',
      recordId: lessonId,
      completionPercentage: 50,
      status: 'in_progress',
    })
    setPageState({ type: 'pdf', pageNumber: 1 })
  }, [lessonId])

  useEffect(() => {
    syncUrl(pageState)
  }, [pageState, syncUrl])

  const progressPercent = (() => {
    if (pageState.type === 'intro') return 0
    if (pageState.type === 'pdf') return 50
    if (pageState.type === 'outro') return 100
    return 0
  })()

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
    totalFiles: fileCount,
  }
}
