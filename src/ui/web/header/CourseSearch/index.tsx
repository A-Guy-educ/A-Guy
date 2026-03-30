'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  SearchIcon,
  X,
  BookOpen,
  FileText,
  HelpCircle,
  GraduationCap,
  ChevronRight,
  Lock,
} from 'lucide-react'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/infra/utils/ui'
import { SystemLink } from '@/infra/loading/components/SystemLink'
import { useTranslations } from '@/ui/web/providers/I18n'
import { useCourseSearch, useCourseSlug } from '@/client/hooks/useCourseSearch'

interface CourseSearchProps {
  variant: 'desktop' | 'mobile'
  onNavigate?: () => void
}

export const CourseSearch: React.FC<CourseSearchProps> = ({ variant, onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])

  // Global keyboard shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <>
      {/* Trigger button */}
      {variant === 'desktop' ? (
        <button
          onClick={open}
          className="p-2 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-all duration-normal"
          aria-label="Search"
        >
          <SearchIcon className="w-5 h-5" />
        </button>
      ) : (
        <button
          onClick={open}
          className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl border border-border bg-muted/50 text-muted-foreground transition-all duration-normal"
          aria-label="Search"
        >
          <SearchIcon className="w-4 h-4" />
          <span className="text-body-sm">Search...</span>
        </button>
      )}

      {/* Command palette modal */}
      <SearchModal isOpen={isOpen} onClose={close} onNavigate={onNavigate} />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Search Modal (Command Palette)                                      */
/* ------------------------------------------------------------------ */

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
  onNavigate?: () => void
}

const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose, onNavigate }) => {
  const pathname = usePathname()
  const courseSlug = useCourseSlug(pathname)
  const t = useTranslations('common.courseSearch')

  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const { results, isLoading, enrolled, error } = useCourseSearch(query, courseSlug)

  const showResults =
    query.length >= 2 && (isLoading || results !== null || enrolled === false || error)

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      // Small delay to let animation start
      const timer = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(timer)
    } else {
      setQuery('')
    }
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Close on route change
  useEffect(() => {
    onClose()
  }, [pathname, onClose])

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }
  }, [isOpen])

  const handleResultClick = useCallback(() => {
    onClose()
    onNavigate?.()
  }, [onClose, onNavigate])

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    },
    [onClose],
  )

  const hasResults =
    results &&
    ((results.courses?.length ?? 0) > 0 ||
      results.lessons.length > 0 ||
      results.exercises.length > 0 ||
      results.questions.length > 0)

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
          onClick={handleBackdropClick}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />

          {/* Panel */}
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: -20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-lg bg-card border border-border/50 rounded-2xl shadow-modal overflow-hidden"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 border-b border-border/40">
              <SearchIcon className="w-5 h-5 text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('placeholder')}
                className="flex-1 h-14 bg-transparent text-body-md placeholder:text-muted-foreground focus:outline-none"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="p-1 rounded-md hover:bg-muted transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
              <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded border border-border bg-muted text-[10px] text-muted-foreground font-mono">
                ESC
              </kbd>
            </div>

            {/* Results area */}
            {showResults && (
              <div className="max-h-80 overflow-y-auto">
                {/* Loading */}
                {isLoading && (
                  <div className="p-card-padding-sm space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3 animate-pulse">
                        <div className="w-8 h-8 rounded-lg bg-muted" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3.5 bg-muted rounded-md w-3/4" />
                          <div className="h-2.5 bg-muted/60 rounded-md w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Not enrolled */}
                {!isLoading && enrolled === false && (
                  <div className="p-card-padding-lg text-center">
                    <Lock className="w-10 h-10 text-warning mx-auto mb-3 opacity-60" />
                    <p className="text-body-sm font-medium text-warning">{t('enrollRequired')}</p>
                    <p className="text-body-xs text-muted-foreground mt-1">
                      {t('enrollRequiredHint')}
                    </p>
                  </div>
                )}

                {/* Error */}
                {!isLoading && error && (
                  <div className="p-card-padding-lg text-center text-body-sm text-destructive">
                    {t('error')}
                  </div>
                )}

                {/* No results */}
                {!isLoading && enrolled === true && results && !hasResults && (
                  <div className="p-card-padding-lg text-center">
                    <SearchIcon className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                    <p className="text-body-sm text-muted-foreground">{t('noResults')}</p>
                  </div>
                )}

                {/* Results */}
                {!isLoading && enrolled === true && results && hasResults && (
                  <>
                    {results.courses && results.courses.length > 0 && (
                      <SearchSection icon={GraduationCap} title={t('courses')}>
                        {results.courses.map((course) => (
                          <SearchResultItem
                            key={course.id}
                            href={course.url}
                            title={course.title}
                            subtitle=""
                            dotColor="bg-primary"
                            onClick={handleResultClick}
                          />
                        ))}
                      </SearchSection>
                    )}

                    {results.lessons.length > 0 && (
                      <SearchSection icon={BookOpen} title={t('lessons')}>
                        {results.lessons.map((lesson) => (
                          <SearchResultItem
                            key={lesson.id}
                            href={lesson.url}
                            title={lesson.title}
                            subtitle={lesson.type}
                            dotColor="bg-blue-500"
                            onClick={handleResultClick}
                          />
                        ))}
                      </SearchSection>
                    )}

                    {results.exercises.length > 0 && (
                      <SearchSection icon={FileText} title={t('exercises')}>
                        {results.exercises.map((exercise) => (
                          <SearchResultItem
                            key={exercise.id}
                            href={exercise.url}
                            title={exercise.title}
                            subtitle={exercise.lessonTitle}
                            dotColor="bg-green-500"
                            onClick={handleResultClick}
                          />
                        ))}
                      </SearchSection>
                    )}

                    {results.questions.length > 0 && (
                      <SearchSection icon={HelpCircle} title={t('questions')}>
                        {results.questions.map((question) => (
                          <SearchResultItem
                            key={question.id}
                            href={question.url}
                            title={question.promptSnippet}
                            subtitle={question.exerciseTitle}
                            dotColor="bg-purple-500"
                            onClick={handleResultClick}
                          />
                        ))}
                      </SearchSection>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Empty state hint */}
            {!showResults && (
              <div className="px-4 py-section-sm text-center">
                <p className="text-body-xs text-muted-foreground">{t('placeholder')}</p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

interface SearchSectionProps {
  icon: React.FC<{ className?: string }>
  title: string
  children: React.ReactNode
}

const SearchSection: React.FC<SearchSectionProps> = ({ icon: Icon, title, children }) => (
  <div className="border-b border-border/30 last:border-b-0">
    <div className="flex items-center gap-2 px-4 py-2 bg-muted/20">
      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      <span className="text-body-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {title}
      </span>
    </div>
    <div className="py-1">{children}</div>
  </div>
)

interface SearchResultItemProps {
  href: string
  title: string
  subtitle: string
  dotColor: string
  onClick: () => void
}

const SearchResultItem: React.FC<SearchResultItemProps> = ({
  href,
  title,
  subtitle,
  dotColor,
  onClick,
}) => (
  <SystemLink
    href={href}
    onClick={onClick}
    className="group flex items-center gap-3 px-4 py-2.5 mx-1 rounded-lg hover:bg-muted/50 transition-all duration-normal"
  >
    <span className={cn('w-2 h-2 rounded-full flex-shrink-0', dotColor)} />
    <div className="flex-1 min-w-0">
      <p className="text-body-sm text-foreground truncate">{title}</p>
      {subtitle && <p className="text-body-xs text-muted-foreground truncate">{subtitle}</p>}
    </div>
    <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-normal flex-shrink-0" />
  </SystemLink>
)
