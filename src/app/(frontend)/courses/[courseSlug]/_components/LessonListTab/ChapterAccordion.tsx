'use client'

import { forwardRef } from 'react'
import { Bookmark, ChevronDown } from 'lucide-react'
import { useTranslations } from '@/ui/web/providers/I18n'
import { cn } from '@/infra/utils/ui'
import { LessonRow } from './LessonRow'
import type { ChapterGroup, LessonTimelineEntry } from './lessons-grouping'

interface ChapterAccordionProps {
  group: ChapterGroup
  /** Visible entries after filter modes applied. */
  visibleEntries: LessonTimelineEntry[]
  isExpanded: boolean
  onToggle: () => void
  courseSlug: string
}

/**
 * A single chapter in the timeline accordion.
 *
 * Renders the chapter header (label, title, mini progress, expand chevron)
 * and, when expanded, the lessons that belong to it. The header uses
 * `forwardRef` so the parent (`LessonListTab`) can scroll the active
 * chapter into view when the "focus on next lesson" button is pressed.
 */
export const ChapterAccordion = forwardRef<HTMLDivElement, ChapterAccordionProps>(
  function ChapterAccordion({ group, visibleEntries, isExpanded, onToggle, courseSlug }, ref) {
    const t = useTranslations('coursePage.lessonsPath')
    const { chapter, totalCount, completedCount } = group
    const chapterLabel = chapter.chapterLabel ?? String(chapter.order + 1)
    const progressPercent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100)

    return (
      <div
        ref={ref}
        data-chapter-id={chapter.id}
        className={cn(
          'relative rounded-2xl border bg-card/40 backdrop-blur-md overflow-hidden',
          'border-border/60 shadow-card',
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isExpanded}
          className={cn(
            'w-full p-4 md:p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-content-gap cursor-pointer select-none text-start',
            'bg-card/40 hover:bg-card/60 transition-colors',
          )}
        >
          <div className="flex items-center gap-content-gap min-w-0">
            <div
              className={cn(
                'w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 z-20',
                'bg-primary/10 border-primary/20 text-primary text-body-xs',
              )}
              aria-hidden
            >
              <Bookmark className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                  {t('chapterSubject').replace('{chapter}', chapterLabel)}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {t('chapterLessonsCount')
                    .replace('{count}', String(totalCount))
                    .replace('()', `(${totalCount})`)}
                </span>
              </div>
              <h3 className="text-heading-sm md:text-heading-md font-bold text-foreground tracking-tight truncate">
                {chapter.title}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-content-gap-xs w-full md:w-auto self-stretch justify-between md:justify-end shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-20 bg-muted rounded-full h-[3px] overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-slower"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-[10px] font-semibold text-muted-foreground font-mono">
                {t('chapterReleased')
                  .replace('{done}', String(completedCount))
                  .replace('{total}', String(totalCount))}
              </span>
            </div>
            <div
              className={cn(
                'w-6 h-6 rounded-lg bg-muted border border-border/60 flex items-center justify-center',
                'text-muted-foreground text-[10px] transition-transform duration-normal',
                isExpanded && 'rotate-180',
              )}
              aria-hidden
            >
              <ChevronDown className="w-3 h-3" />
            </div>
          </div>
        </button>

        {isExpanded && (
          <div
            className={cn(
              'border-t border-border/40 p-4 md:p-5 space-y-4',
              'animate-accordion-down',
            )}
          >
            {chapter.description && (
              <p className="text-body-xs text-muted-foreground ms-12">{chapter.description}</p>
            )}
            {visibleEntries.length === 0 ? (
              <p className="text-body-xs text-muted-foreground ms-12">{t('chapterEmpty')}</p>
            ) : (
              <div className="space-y-4">
                {visibleEntries.map((entry) => (
                  <LessonRow
                    key={entry.lesson.id}
                    entry={entry}
                    courseSlug={courseSlug}
                    chapterSlug={chapter.slug ?? ''}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  },
)
