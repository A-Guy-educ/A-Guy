import { useState } from 'react'

type PageType = 'intro' | 'exercise' | 'outro'

interface PageState {
  type: PageType
  /** 0 = intro, 1..N = exercise index, N+1 = outro */
  pageNumber: number
  /** For exercise pages, the exercise being displayed */
  exerciseIndex?: number
}

export function useExercisesPager(totalExercises: number) {
  const [pageState, setPageState] = useState<PageState>({
    type: 'intro',
    pageNumber: 0,
  })

  const totalPages = totalExercises + 2 // intro + exercises + outro

  const handleNext = () => {
    const nextPage = pageState.pageNumber + 1

    if (nextPage === totalPages - 1) {
      setPageState({ type: 'outro', pageNumber: nextPage })
    } else if (nextPage > 0 && nextPage < totalPages - 1) {
      setPageState({
        type: 'exercise',
        pageNumber: nextPage,
        exerciseIndex: nextPage - 1,
      })
    }
  }

  const handlePrev = () => {
    const prevPage = pageState.pageNumber - 1

    if (prevPage === 0) {
      setPageState({ type: 'intro', pageNumber: 0 })
    } else if (prevPage > 0 && prevPage < totalPages - 1) {
      setPageState({
        type: 'exercise',
        pageNumber: prevPage,
        exerciseIndex: prevPage - 1,
      })
    }
  }

  const handleStart = () => {
    setPageState({
      type: 'exercise',
      pageNumber: 1,
      exerciseIndex: 0,
    })
  }

  const progressPercent = ((pageState.pageNumber + 1) / totalPages) * 100

  return {
    pageState,
    totalPages,
    progressPercent,
    canGoNext: pageState.pageNumber < totalPages - 1,
    canGoPrev: pageState.pageNumber > 0,
    handleNext,
    handlePrev,
    handleStart,
  }
}
