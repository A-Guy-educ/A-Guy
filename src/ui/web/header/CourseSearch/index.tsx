'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { SearchIcon, X, Loader2, BookOpen, FileText, HelpCircle, GraduationCap } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { SystemLink } from '@/infra/loading/components/SystemLink'
import { useTranslations } from '@/ui/web/providers/I18n'
import { useCourseSearch, useCourseSlug } from '@/client/hooks/useCourseSearch'

interface CourseSearchProps {
  variant: 'desktop' | 'mobile'
  onNavigate?: () => void
}

export const CourseSearch: React.FC<CourseSearchProps> = ({ variant, onNavigate }) => {
  const pathname = usePathname()
  const courseSlug = useCourseSlug(pathname)
  const t = useTranslations('common.courseSearch')

  const [isExpanded, setIsExpanded] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const { results, isLoading, enrolled, error } = useCourseSearch(query, courseSlug)

  const showDropdown =
    isExpanded &&
    query.length >= 2 &&
    (isLoading || results !== null || enrolled === false || error)

  // Close on click outside (desktop only)
  useEffect(() => {
    if (variant !== 'desktop' || !isExpanded) return

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsExpanded(false)
        setQuery('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isExpanded, variant])

  // Close on Escape
  useEffect(() => {
    if (!isExpanded) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsExpanded(false)
        setQuery('')
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isExpanded])

  // Focus input when expanded
  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isExpanded])

  // Close on route change
  useEffect(() => {
    setIsExpanded(false)
    setQuery('')
  }, [pathname])

  const handleResultClick = useCallback(() => {
    setIsExpanded(false)
    setQuery('')
    onNavigate?.()
  }, [onNavigate])

  // Desktop: expandable search
  if (variant === 'desktop') {
    return (
      <div ref={containerRef} className="relative">
        {!isExpanded ? (
          <button
            onClick={() => setIsExpanded(true)}
            className="p-2 rounded-lg hover:bg-hover transition-colors"
            aria-label="Search"
          >
            <SearchIcon className="w-5" />
          </button>
        ) : (
          <div className="flex items-center gap-content-gap-xs">
            <div className="relative">
              <SearchIcon className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('placeholder')}
                className="h-9 w-56 rounded-lg border border-border bg-background ps-9 pe-8 text-body-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                onClick={() => {
                  setIsExpanded(false)
                  setQuery('')
                }}
                className="absolute end-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted transition-colors"
                aria-label="Close search"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>
        )}

        {/* Dropdown */}
        {showDropdown && (
          <SearchDropdown
            results={results}
            isLoading={isLoading}
            enrolled={enrolled}
            error={error}
            t={t}
            onResultClick={handleResultClick}
          />
        )}
      </div>
    )
  }

  // Mobile: always show input
  return (
    <div ref={containerRef} className="relative px-6 py-section-xs border-b border-border">
      <div className="relative">
        <SearchIcon className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('placeholder')}
          className="h-10 w-full rounded-lg border border-border bg-background ps-9 pe-3 text-body-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <SearchDropdown
          results={results}
          isLoading={isLoading}
          enrolled={enrolled}
          error={error}
          t={t}
          onResultClick={handleResultClick}
          mobile
        />
      )}
    </div>
  )
}

interface SearchDropdownProps {
  results: {
    courses?: Array<{ id: string; title: string; url: string }>
    lessons: Array<{ id: string; title: string; type: string; url: string }>
    exercises: Array<{ id: string; title: string; lessonTitle: string; url: string }>
    questions: Array<{ id: string; promptSnippet: string; exerciseTitle: string; url: string }>
  } | null
  isLoading: boolean
  enrolled: boolean | null
  error: string | null
  t: (key: string) => string
  onResultClick: () => void
  mobile?: boolean
}

const SearchDropdown: React.FC<SearchDropdownProps> = ({
  results,
  isLoading,
  enrolled,
  error,
  t,
  onResultClick,
  mobile,
}) => {
  const positionClass = mobile ? 'mt-2 w-full' : 'absolute top-full end-0 mt-2 w-80'

  return (
    <div
      className={`${positionClass} rounded-lg border border-border bg-background shadow-card z-50 max-h-80 overflow-y-auto`}
    >
      {/* Loading */}
      {isLoading && (
        <div className="flex items-center gap-content-gap-xs p-card-padding-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-body-sm">{t('searching')}</span>
        </div>
      )}

      {/* Not enrolled */}
      {!isLoading && enrolled === false && (
        <div className="p-card-padding-sm text-center text-body-sm text-warning">
          {t('enrollRequired')}
        </div>
      )}

      {/* Error */}
      {!isLoading && error && (
        <div className="p-card-padding-sm text-center text-body-sm text-destructive">
          {t('error')}
        </div>
      )}

      {/* Results */}
      {!isLoading && enrolled === true && results && (
        <>
          {(results.courses?.length ?? 0) === 0 &&
            results.lessons.length === 0 &&
            results.exercises.length === 0 &&
            results.questions.length === 0 && (
              <div className="p-card-padding-sm text-center text-body-sm text-muted-foreground">
                {t('noResults')}
              </div>
            )}

          {/* Courses */}
          {results.courses && results.courses.length > 0 && (
            <SearchSection icon={GraduationCap} title={t('courses')}>
              {results.courses.map((course) => (
                <SearchResultItem
                  key={course.id}
                  href={course.url}
                  title={course.title}
                  subtitle=""
                  onClick={onResultClick}
                />
              ))}
            </SearchSection>
          )}

          {/* Lessons */}
          {results.lessons.length > 0 && (
            <SearchSection icon={BookOpen} title={t('lessons')}>
              {results.lessons.map((lesson) => (
                <SearchResultItem
                  key={lesson.id}
                  href={lesson.url}
                  title={lesson.title}
                  subtitle={lesson.type}
                  onClick={onResultClick}
                />
              ))}
            </SearchSection>
          )}

          {/* Exercises */}
          {results.exercises.length > 0 && (
            <SearchSection icon={FileText} title={t('exercises')}>
              {results.exercises.map((exercise) => (
                <SearchResultItem
                  key={exercise.id}
                  href={exercise.url}
                  title={exercise.title}
                  subtitle={exercise.lessonTitle}
                  onClick={onResultClick}
                />
              ))}
            </SearchSection>
          )}

          {/* Questions */}
          {results.questions.length > 0 && (
            <SearchSection icon={HelpCircle} title={t('questions')}>
              {results.questions.map((question) => (
                <SearchResultItem
                  key={question.id}
                  href={question.url}
                  title={question.promptSnippet}
                  subtitle={question.exerciseTitle}
                  onClick={onResultClick}
                />
              ))}
            </SearchSection>
          )}
        </>
      )}
    </div>
  )
}

interface SearchSectionProps {
  icon: React.FC<{ className?: string }>
  title: string
  children: React.ReactNode
}

const SearchSection: React.FC<SearchSectionProps> = ({ icon: Icon, title, children }) => (
  <div className="border-b border-border last:border-b-0">
    <div className="flex items-center gap-content-gap-xs px-3 py-2 bg-muted/30">
      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      <span className="text-body-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {title}
      </span>
    </div>
    <div>{children}</div>
  </div>
)

interface SearchResultItemProps {
  href: string
  title: string
  subtitle: string
  onClick: () => void
}

const SearchResultItem: React.FC<SearchResultItemProps> = ({ href, title, subtitle, onClick }) => (
  <SystemLink
    href={href}
    onClick={onClick}
    className="block px-3 py-2 hover:bg-muted transition-colors"
  >
    <p className="text-body-sm text-foreground truncate">{title}</p>
    {subtitle && <p className="text-body-xs text-muted-foreground truncate">{subtitle}</p>}
  </SystemLink>
)
