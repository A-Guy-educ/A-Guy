/**
 * Lesson Selector Component
 *
 * @fileType component
 * @domain admin
 * @pattern searchable-select
 * @ai-summary Searchable dropdown to select a lesson for PDF conversion
 */
'use client'

import { useDebounce } from '@/client/hooks/useDebounce'
import { useCallback, useEffect, useRef, useState } from 'react'
import { dropdownStyle, inputStyle, labelStyle } from '../styles'

interface LessonOption {
  id: string
  title: string
  chapterTitle?: string
}

interface LessonSelectorProps {
  selectedLessonId: string | null
  onSelectLesson: (lessonId: string, lesson: LessonOption) => void
}

const containerStyle: React.CSSProperties = {
  position: 'relative',
}

const loadingStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--theme-elevation-500)',
  marginTop: 4,
}

const selectedStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--theme-elevation-600)',
  marginTop: 4,
}

const dropdownItemStyle: React.CSSProperties = {
  padding: '8px 12px',
  cursor: 'pointer',
  fontSize: 13,
}

const dropdownItemHoverStyle: React.CSSProperties = {
  ...dropdownItemStyle,
  backgroundColor: 'var(--theme-elevation-100)',
}

const dropdownItemTitleStyle: React.CSSProperties = {
  fontWeight: 500,
  color: 'var(--theme-elevation-1000)',
}

const dropdownItemChapterStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--theme-elevation-500)',
}

export function LessonSelector({ selectedLessonId, onSelectLesson }: LessonSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState<LessonOption[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [hoveredIndex, setHoveredIndex] = useState<number>(-1)
  const [selectedLessonName, setSelectedLessonName] = useState<string>('')
  const debouncedQuery = useDebounce(searchQuery, 300)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([])
      setIsDropdownOpen(false)
      return
    }

    async function fetchLessons() {
      setIsLoading(true)
      try {
        const response = await fetch(
          `/api/lessons?where[title][contains]=${encodeURIComponent(debouncedQuery)}&limit=10&depth=1`,
        )
        if (response.ok) {
          const data = await response.json()
          const lessons: LessonOption[] =
            data.docs?.map((doc: { id: string; title: string; chapter?: { title: string } }) => ({
              id: doc.id,
              title: doc.title,
              chapterTitle: doc.chapter?.title,
            })) || []
          setResults(lessons)
          setIsDropdownOpen(lessons.length > 0)
        }
      } catch (error) {
        console.error('Failed to fetch lessons:', error)
        setResults([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchLessons()
  }, [debouncedQuery])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = useCallback(
    (lesson: LessonOption) => {
      onSelectLesson(lesson.id, lesson)
      setSelectedLessonName(lesson.title)
      setIsDropdownOpen(false)
      setSearchQuery('')
    },
    [onSelectLesson],
  )

  return (
    <div style={containerStyle} ref={containerRef}>
      <label htmlFor="lesson-search" style={labelStyle}>
        Select Lesson
      </label>
      <input
        id="lesson-search"
        type="text"
        style={inputStyle}
        placeholder="Search lessons..."
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value)
          setIsDropdownOpen(true)
        }}
        onFocus={() => {
          if (results.length > 0) setIsDropdownOpen(true)
        }}
        disabled={isLoading}
      />
      {isLoading && <div style={loadingStyle}>Loading...</div>}
      {isDropdownOpen && results.length > 0 && (
        <ul style={dropdownStyle}>
          {results.map((lesson, index) => (
            <li
              key={lesson.id}
              style={hoveredIndex === index ? dropdownItemHoverStyle : dropdownItemStyle}
              onClick={() => handleSelect(lesson)}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(-1)}
            >
              <div style={dropdownItemTitleStyle}>{lesson.title}</div>
              {lesson.chapterTitle && (
                <div style={dropdownItemChapterStyle}>{lesson.chapterTitle}</div>
              )}
            </li>
          ))}
        </ul>
      )}
      {selectedLessonId && (
        <div style={selectedStyle}>
          Selected:{' '}
          <span style={{ fontWeight: 500 }}>{selectedLessonName || selectedLessonId}</span>
        </div>
      )}
    </div>
  )
}
