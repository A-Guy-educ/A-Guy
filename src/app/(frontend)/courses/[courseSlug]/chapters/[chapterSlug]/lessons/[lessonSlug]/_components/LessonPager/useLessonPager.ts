'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import type { ResolvedLessonBlock } from '@/server/repos/queries/lesson-blocks'
import type { Exercise, ContentPage } from '@/payload-types'

type PageType = 'intro' | 'block' | 'outro'

interface PageState {
  type: PageType
  pageNumber: number
  blockIndex?: number
}

interface UseLessonPagerProps {
  blocks: ResolvedLessonBlock[]
  courseSlug: string
  chapterSlug: string
  lessonSlug: string
}

function getExerciseSlug(exercise: Exercise): string {
  return exercise.slug || exercise.id
}

function getContentPageSlug(page: ContentPage): string {
  return page.slug || page.id
}

export function useLessonPager({
  blocks,
  courseSlug,
  chapterSlug,
  lessonSlug,
}: UseLessonPagerProps) {
  // Pages: intro(0) → blocks(1..n) → outro(n+1)
  const totalPages = blocks.length + 2

  const [pageState, setPageState] = useState<PageState>({
    type: 'intro',
    pageNumber: 0,
  })

  const basePath = `/courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lessonSlug}`
  const introUrl = basePath
  const completeUrl = `${basePath}/complete`

  const getBlockUrl = useCallback(
    (index: number) => {
      const block = blocks[index]
      if (!block) return introUrl
      if (block.type === 'exercise') {
        return `${basePath}/exercises/${getExerciseSlug(block.data)}`
      }
      return `${basePath}/content/${getContentPageSlug(block.data)}`
    },
    [basePath, blocks, introUrl],
  )

  // Deep-link detection on mount
  useEffect(() => {
    if (typeof window === 'undefined') return

    const pathname = window.location.pathname

    if (pathname === completeUrl) {
      setPageState({ type: 'outro', pageNumber: blocks.length + 1 })
    } else if (pathname.startsWith(`${basePath}/exercises/`)) {
      const slug = pathname.split('/exercises/')[1]
      const index = blocks.findIndex(
        (b) => b.type === 'exercise' && getExerciseSlug(b.data) === slug,
      )
      if (index >= 0) {
        setPageState({ type: 'block', pageNumber: index + 1, blockIndex: index })
      }
    } else if (pathname.startsWith(`${basePath}/content/`)) {
      const slug = pathname.split('/content/')[1]
      const index = blocks.findIndex(
        (b) => b.type === 'contentPage' && getContentPageSlug(b.data) === slug,
      )
      if (index >= 0) {
        setPageState({ type: 'block', pageNumber: index + 1, blockIndex: index })
      }
    }
  }, [basePath, completeUrl, blocks])

  const syncUrl = useCallback(
    (state: PageState) => {
      if (typeof window === 'undefined') return

      let newUrl: string
      if (state.type === 'intro') {
        newUrl = introUrl
      } else if (state.type === 'block' && state.blockIndex !== undefined) {
        newUrl = getBlockUrl(state.blockIndex)
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
    [introUrl, completeUrl, getBlockUrl],
  )

  const pageToState = useCallback(
    (page: number): PageState => {
      if (page === 0) return { type: 'intro', pageNumber: 0 }
      if (page === totalPages - 1) return { type: 'outro', pageNumber: page }
      const blockIndex = page - 1
      return { type: 'block', pageNumber: page, blockIndex }
    },
    [totalPages],
  )

  const [isPending, startTransition] = useTransition()
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

  const handleNext = useCallback(() => {
    startTransition(() => {
      setPageState((prev) => {
        const nextPage = prev.pageNumber + 1
        if (nextPage >= totalPages) return prev
        return pageToState(nextPage)
      })
    })
  }, [totalPages, pageToState, startTransition])

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
    if (blocks.length === 0) {
      setPageState({ type: 'outro', pageNumber: totalPages - 1 })
      return
    }
    setPageState({ type: 'block', pageNumber: 1, blockIndex: 0 })
  }, [blocks.length, totalPages])

  useEffect(() => {
    syncUrl(pageState)
  }, [pageState, syncUrl])

  const progressPercent = (() => {
    if (pageState.type === 'intro') return 0
    if (pageState.type === 'outro') return 100
    if (pageState.type === 'block' && pageState.blockIndex !== undefined) {
      if (blocks.length === 0) return 0
      return ((pageState.blockIndex + 1) / blocks.length) * 100
    }
    return 0
  })()

  const getCurrentBlockOrdinal = useCallback(() => {
    if (pageState.type !== 'block' || pageState.blockIndex === undefined) return null
    return pageState.blockIndex + 1
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
    getCurrentBlockOrdinal,
    totalBlocks: blocks.length,
  }
}
