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

interface LessonOption {
  id: string
  title: string
  chapterTitle?: string
}

interface LessonSelectorProps {
  selectedLessonId: string | null
  onSelectLesson: (lessonId: string, lesson: LessonOption) => void
}

export function LessonSelector({ selectedLessonId, onSelectLesson }: LessonSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState<LessonOption[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
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
      setIsDropdownOpen(false)
      setSearchQuery('')
    },
    [onSelectLesson],
  )

  const selectedLessonTitle = results.find((l) => l.id === selectedLessonId)?.title

  return (
    <div className="space-y-1" ref={containerRef}>
      <label htmlFor="lesson-search" className="block text-sm font-medium text-gray-700">
        Select Lesson
      </label>
      <input
        id="lesson-search"
        type="text"
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm placeholder:text-gray-400"
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
      {isLoading && <div className="text-sm text-gray-500">Loading...</div>}
      {isDropdownOpen && results.length > 0 && (
        <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
          {results.map((lesson) => (
            <li
              key={lesson.id}
              className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
              onClick={() => handleSelect(lesson)}
            >
              <div className="text-sm font-medium text-gray-900">{lesson.title}</div>
              {lesson.chapterTitle && (
                <div className="text-xs text-gray-500">{lesson.chapterTitle}</div>
              )}
            </li>
          ))}
        </ul>
      )}
      {selectedLessonId && (
        <div className="text-sm text-gray-600">
          Selected: <span className="font-medium">{selectedLessonTitle || selectedLessonId}</span>
        </div>
      )}
    </div>
  )
}
