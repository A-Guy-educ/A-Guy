import type { ContentPage, Exercise, Media as MediaType } from '@/payload-types'

export type LessonBlockExercise = {
  blockType: 'exerciseRef'
  exercise: Exercise
}

export type LessonBlockContentPage = {
  blockType: 'contentPageRef'
  contentPage: ContentPage
}

export type LessonBlock = LessonBlockExercise | LessonBlockContentPage

export type LessonPageType = 'intro' | 'about' | 'block' | 'outro'

export interface LessonPageState {
  type: LessonPageType
  pageNumber: number
  blockIndex?: number
}

export interface LessonPagerProps {
  blocks: LessonBlock[]
  lessonTitle: string
  backUrl: string
  courseSlug: string
  chapterSlug: string
  lessonSlug: string
  lessonId: string
  introDescription?: string | null
  introMedia?: MediaType | string | number | null
  mediaMap?: Record<string, MediaType>
}
