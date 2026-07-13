import type { Chapter, Lesson } from '@/payload-types'
import { getEffectiveLessonType } from '@/server/constants/lesson-types'
import type { LessonProgress } from '../types'

/**
 * State of an individual lesson within the timeline view.
 *
 * - `active`    — the next lesson the user should tackle
 * - `completed` — already finished (progress === 100 or status completed)
 * - `locked`    — paid-only lesson without an entitlement in this session,
 *                 or a `soon` lesson that is not yet released
 * - `available` — neither locked nor completed; awaiting the user to engage
 */
export type LessonTimelineState = 'completed' | 'active' | 'locked' | 'available'

export interface LessonTimelineEntry {
  lesson: Lesson
  chapter: Chapter | undefined
  /** Sequential number within the entire course (01, 02, …). */
  index: number
  /** Progress percent from the parent map (0–100). */
  progress: number
  state: LessonTimelineState
}

export interface ChapterGroup {
  chapter: Chapter
  /** Chronologically ordered lessons belonging to this chapter. */
  lessons: LessonTimelineEntry[]
  /** Number of lessons in this chapter (regardless of visibility). */
  totalCount: number
  /** Number of completed lessons in this chapter. */
  completedCount: number
}

export interface LessonsGroupingResult {
  groups: ChapterGroup[]
  /** All entries flattened in chronological order across chapters. */
  entries: LessonTimelineEntry[]
  /** Number of completed lessons across the course. */
  completedCount: number
  /** Total lessons in the course. */
  totalCount: number
  /** Overall percent (0–100). Returns 0 when no lessons exist. */
  overallPercent: number
  /** Active entry — undefined when every lesson is completed or no lessons. */
  activeEntry: LessonTimelineEntry | undefined
  /** Chapter id that owns the active entry (if any). */
  activeChapterId: string | undefined
  /** True when every lesson is completed (or there are no lessons). */
  allCompleted: boolean
}

interface ProgressResolver {
  (lessonId: string): number
}

interface CompletedResolver {
  (lessonId: string): boolean
}

/**
 * Resolve the chapter id of a lesson, tolerating both populated and
 * id-only references from Payload.
 */
function getChapterId(lesson: Lesson): string | undefined {
  if (typeof lesson.chapter === 'string') return lesson.chapter
  return lesson.chapter?.id
}

/**
 * Build a chapter lookup keyed by id, dropping any entries without an id.
 */
function indexChapters(chapters: Chapter[]): Map<string, Chapter> {
  const map = new Map<string, Chapter>()
  for (const chapter of chapters) {
    if (chapter?.id) map.set(chapter.id, chapter)
  }
  return map
}

/**
 * Determine whether a lesson should be considered locked from the student's
 * perspective. Currently:
 *  - `contentStatus === 'soon'` lessons that are not released
 *  - `accessType === 'paid'` lessons when the user has no entitlement
 *    (signalled by the page wrapping the tab in an AccessGateProvider)
 *
 * The entitlement signal is passed in via `isLessonEntitled` so this helper
 * stays a pure function of the lesson + resolver inputs.
 */
function isLessonLocked(lesson: Lesson, isLessonEntitled: (lessonId: string) => boolean): boolean {
  if (lesson.contentStatus === 'soon') return true
  if (lesson.accessType === 'paid' && !isLessonEntitled(lesson.id)) return true
  return false
}

/**
 * Group lessons by chapter and compute their timeline state.
 *
 * Lessons are sorted by `(chapterOrder, lessonOrder, id)` so the chapter
 * ordering from Payload is preserved. The first non-completed, non-locked
 * lesson is promoted to `active`; if none exist but not all are completed,
 * the first locked lesson is promoted to `active` (matches the mockup's
 * `renderUnifiedPath` fallback).
 */
export function groupLessonsForTimeline({
  lessons,
  chapters,
  lessonType,
  lessonProgressMap: _lessonProgressMap = {},
  resolveProgress,
  resolveCompleted,
  isLessonEntitled = () => true,
}: {
  lessons: Lesson[]
  chapters: Chapter[]
  lessonType: 'learning' | 'practice'
  lessonProgressMap?: Record<string, LessonProgress>
  resolveProgress: ProgressResolver
  resolveCompleted: CompletedResolver
  isLessonEntitled?: (lessonId: string) => boolean
}): LessonsGroupingResult {
  const filteredLessons = lessons.filter((l) => getEffectiveLessonType(l.type) === lessonType)

  const chapterMap = indexChapters(chapters)
  const chapterOrderById = new Map<string, number>()
  for (const chapter of chapters) {
    if (chapter?.id) chapterOrderById.set(chapter.id, chapter.order)
  }

  // Sort by (chapterOrder, lessonOrder, id) so the global timeline walks
  // through chapters in their canonical order and lessons chronologically
  // within each chapter — matches the spec for the redesigned view.
  const sortedLessons = filteredLessons.slice().sort((a, b) => {
    const ac = chapterOrderById.get(getChapterId(a) ?? '') ?? Number.MAX_SAFE_INTEGER
    const bc = chapterOrderById.get(getChapterId(b) ?? '') ?? Number.MAX_SAFE_INTEGER
    if (ac !== bc) return ac - bc
    if (a.order !== b.order) return a.order - b.order
    return a.id.localeCompare(b.id)
  })

  // First pass — compute entries in chronological order so the active
  // lesson can be picked by walking once.
  const orderedEntries: LessonTimelineEntry[] = []
  const entriesByChapter = new Map<string, LessonTimelineEntry[]>()

  sortedLessons.forEach((lesson, idx) => {
    const progress = resolveProgress(lesson.id)
    const isCompleted = resolveCompleted(lesson.id) || progress >= 100
    const locked = !isCompleted && isLessonLocked(lesson, isLessonEntitled)

    let state: LessonTimelineState
    if (isCompleted) {
      state = 'completed'
    } else if (locked) {
      state = 'locked'
    } else {
      state = 'available'
    }

    const chapterId = getChapterId(lesson)
    const chapter = chapterId ? chapterMap.get(chapterId) : undefined
    const entry: LessonTimelineEntry = {
      lesson,
      chapter,
      index: idx + 1,
      progress,
      state,
    }
    orderedEntries.push(entry)
    if (chapterId) {
      const list = entriesByChapter.get(chapterId) ?? []
      list.push(entry)
      entriesByChapter.set(chapterId, list)
    }
  })

  // Promote the first non-completed entry to active (mockup fallback if no
  // unlocked next lesson exists: the first locked one becomes active).
  let activeEntry: LessonTimelineEntry | undefined
  const firstAvailable = orderedEntries.find((e) => e.state === 'available')
  const firstLocked = orderedEntries.find((e) => e.state === 'locked')
  if (firstAvailable) {
    firstAvailable.state = 'active'
    activeEntry = firstAvailable
  } else if (firstLocked) {
    firstLocked.state = 'active'
    activeEntry = firstLocked
  }

  // Build the chapter groups in chapter-order; chapters with zero lessons
  // for this filter are kept (rendered as empty accordions) so the
  // student sees the full course map.
  const sortedChapterIds = Array.from(chapterOrderById.entries())
    .sort((a, b) => a[1] - b[1])
    .map(([id]) => id)

  const groups: ChapterGroup[] = sortedChapterIds.map((chapterId) => {
    const chapter = chapterMap.get(chapterId)!
    const lessons = entriesByChapter.get(chapterId) ?? []
    const completedCount = lessons.filter((l) => l.state === 'completed').length
    return { chapter, lessons, totalCount: lessons.length, completedCount }
  })

  // Chapters present in lessons but missing from the chapters array are
  // appended at the end so we never drop orphan lessons.
  const seenChapterIds = new Set(sortedChapterIds)
  for (const [chapterId, lessons] of entriesByChapter.entries()) {
    if (seenChapterIds.has(chapterId)) continue
    const chapter = chapterMap.get(chapterId)
    if (!chapter) continue
    const completedCount = lessons.filter((l) => l.state === 'completed').length
    groups.push({ chapter, lessons, totalCount: lessons.length, completedCount })
  }

  const completedCount = orderedEntries.filter((e) => e.state === 'completed').length
  const totalCount = orderedEntries.length
  const overallPercent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100)
  const allCompleted = totalCount > 0 && completedCount === totalCount
  const activeChapterId = activeEntry ? getChapterId(activeEntry.lesson) : undefined

  return {
    groups,
    entries: orderedEntries,
    completedCount,
    totalCount,
    overallPercent,
    activeEntry,
    activeChapterId,
    allCompleted,
  }
}

/**
 * Decide which chapter ids should be expanded in the accordion on first
 * render. Per the mockup: only the chapter containing the active lesson
 * starts expanded; everything else stays collapsed.
 */
export function defaultExpandedChapterIds(grouping: LessonsGroupingResult): Set<string> {
  const set = new Set<string>()
  if (grouping.activeChapterId) set.add(grouping.activeChapterId)
  return set
}
