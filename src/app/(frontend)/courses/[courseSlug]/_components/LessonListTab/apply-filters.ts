import type { LessonFilterMode } from './CourseLessonsFilterBar'
import type { ChapterGroup, LessonTimelineEntry } from './lessons-grouping'

/**
 * Apply the active filter mode to the chapter groups.
 *
 * - `all`           — return all groups untouched
 * - `focus`         — keep only the chapter that owns the active lesson
 * - `hideCompleted` — strip completed lessons out of every chapter
 */
export function applyLessonFilters(
  groups: ChapterGroup[],
  mode: LessonFilterMode,
  activeChapterId: string | undefined,
): ChapterGroup[] {
  if (mode === 'focus') {
    if (!activeChapterId) return groups
    return groups.filter((g) => g.chapter.id === activeChapterId)
  }
  if (mode === 'hideCompleted') {
    return groups
      .map((g) => withVisibleLessons(g, (e) => e.state !== 'completed'))
      .filter((g) => g.lessons.length > 0)
  }
  return groups
}

function withVisibleLessons(
  group: ChapterGroup,
  predicate: (entry: LessonTimelineEntry) => boolean,
): ChapterGroup {
  return { ...group, lessons: group.lessons.filter(predicate) }
}
