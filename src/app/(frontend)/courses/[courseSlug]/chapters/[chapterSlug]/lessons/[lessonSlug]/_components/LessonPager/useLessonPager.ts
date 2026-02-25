import { useCallback, useEffect, useState } from 'react'
import type { LessonBlock, LessonPageState } from './lessonPagerTypes'

function getBlockSlug(block: LessonBlock): string {
  if (block.blockType === 'exerciseRef') {
    return block.exercise.slug || block.exercise.id
  }
  return block.contentPage.slug || block.contentPage.id
}

interface UseLessonPagerProps {
  blocks: LessonBlock[]
  courseSlug: string
  chapterSlug: string
  lessonSlug: string
  hasAboutPage?: boolean
}

export function useLessonPager({
  blocks,
  courseSlug,
  chapterSlug,
  lessonSlug,
  hasAboutPage = false,
}: UseLessonPagerProps) {
  const aboutOffset = hasAboutPage ? 1 : 0
  const [pageState, setPageState] = useState<LessonPageState>({
    type: 'intro',
    pageNumber: 0,
  })

  const basePath = `/courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lessonSlug}`
  const introUrl = basePath
  const aboutUrl = `${basePath}/about`
  const completeUrl = `${basePath}/complete`

  // intro + about(optional) + blocks + outro
  const totalPages = blocks.length + 2 + aboutOffset
  const firstBlockPage = 1 + aboutOffset

  const getBlockUrl = useCallback(
    (index: number) => {
      const block = blocks[index]
      if (!block) return introUrl
      const slug = getBlockSlug(block)
      if (block.blockType === 'exerciseRef') {
        return `${basePath}/exercises/${slug}`
      }
      return `${basePath}/content/${slug}`
    },
    [basePath, blocks, introUrl],
  )

  useEffect(() => {
    if (typeof window === 'undefined') return

    const pathname = window.location.pathname

    if (pathname === completeUrl) {
      setPageState({ type: 'outro', pageNumber: blocks.length + 1 + aboutOffset })
    } else if (hasAboutPage && pathname === aboutUrl) {
      setPageState({ type: 'about', pageNumber: 1 })
    } else if (pathname.startsWith(`${basePath}/exercises/`)) {
      const slug = pathname.split('/exercises/')[1]
      const index = blocks.findIndex(
        (b) => b.blockType === 'exerciseRef' && getBlockSlug(b) === slug,
      )
      if (index >= 0) {
        setPageState({ type: 'block', pageNumber: index + firstBlockPage, blockIndex: index })
      }
    } else if (pathname.startsWith(`${basePath}/content/`)) {
      const slug = pathname.split('/content/')[1]
      const index = blocks.findIndex(
        (b) => b.blockType === 'contentPageRef' && getBlockSlug(b) === slug,
      )
      if (index >= 0) {
        setPageState({ type: 'block', pageNumber: index + firstBlockPage, blockIndex: index })
      }
    }
  }, [basePath, completeUrl, blocks, hasAboutPage, aboutUrl, aboutOffset, firstBlockPage])

  const syncUrl = useCallback(
    (state: LessonPageState) => {
      if (typeof window === 'undefined') return

      let newUrl: string
      if (state.type === 'intro') {
        newUrl = introUrl
      } else if (state.type === 'about') {
        newUrl = aboutUrl
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
    [introUrl, aboutUrl, completeUrl, getBlockUrl],
  )

  const pageToState = useCallback(
    (page: number): LessonPageState => {
      if (page === 0) return { type: 'intro', pageNumber: 0 }
      if (hasAboutPage && page === 1) return { type: 'about', pageNumber: 1 }
      if (page === totalPages - 1) return { type: 'outro', pageNumber: page }
      const blockIndex = page - firstBlockPage
      return { type: 'block', pageNumber: page, blockIndex }
    },
    [hasAboutPage, totalPages, firstBlockPage],
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
    if (blocks.length === 0) {
      setPageState({ type: 'outro', pageNumber: totalPages - 1 })
      return
    }
    setPageState({ type: 'block', pageNumber: firstBlockPage, blockIndex: 0 })
  }, [hasAboutPage, blocks.length, totalPages, firstBlockPage])

  const handleStartBlocks = useCallback(() => {
    if (blocks.length === 0) {
      setPageState({ type: 'outro', pageNumber: totalPages - 1 })
      return
    }
    setPageState({ type: 'block', pageNumber: firstBlockPage, blockIndex: 0 })
  }, [blocks.length, totalPages, firstBlockPage])

  useEffect(() => {
    syncUrl(pageState)
  }, [pageState, syncUrl])

  const progressPercent = (() => {
    if (pageState.type === 'intro') return 0
    if (pageState.type === 'about') return 0
    if (pageState.type === 'outro') return 100

    if (pageState.type === 'block' && pageState.blockIndex !== undefined) {
      if (blocks.length === 0) return 0
      return ((pageState.blockIndex + 1) / blocks.length) * 100
    }

    return 0
  })()

  // Count only exercise blocks for ordinal display
  const exerciseBlocks = blocks.filter((b) => b.blockType === 'exerciseRef')
  const totalExercises = exerciseBlocks.length

  const getExerciseOrdinal = useCallback(() => {
    if (pageState.type !== 'block' || pageState.blockIndex === undefined) return null
    const currentBlock = blocks[pageState.blockIndex]
    if (!currentBlock || currentBlock.blockType !== 'exerciseRef') return null
    // Count how many exercise blocks come before this one
    let ordinal = 0
    for (let i = 0; i <= pageState.blockIndex; i++) {
      if (blocks[i].blockType === 'exerciseRef') ordinal++
    }
    return ordinal
  }, [pageState, blocks])

  return {
    pageState,
    totalPages,
    progressPercent,
    canGoNext: pageState.pageNumber < totalPages - 1,
    canGoPrev: pageState.pageNumber > 0,
    handleNext,
    handlePrev,
    handleStart,
    handleStartBlocks,
    getExerciseOrdinal,
    totalExercises,
    totalBlocks: blocks.length,
  }
}
