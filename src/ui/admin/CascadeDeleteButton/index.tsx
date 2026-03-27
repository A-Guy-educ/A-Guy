'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

type CollectionSlug = 'courses' | 'chapters' | 'lessons'

const COLLECTION_LABELS: Record<CollectionSlug, string> = {
  courses: 'Course',
  chapters: 'Chapter',
  lessons: 'Lesson',
}

const DESCENDANT_DESCRIPTIONS: Record<CollectionSlug, string> = {
  courses: 'all chapters, lessons, and exercises',
  chapters: 'all lessons and exercises',
  lessons: 'all exercises',
}

const CascadeDeleteButton: React.FC<{ collection: CollectionSlug }> = ({ collection }) => {
  const { id } = useDocumentInfo()
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [showModal, setShowModal] = useState(false)

  const label = COLLECTION_LABELS[collection]
  const descendants = DESCENDANT_DESCRIPTIONS[collection]

  useEffect(() => {
    if (!showModal) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowModal(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [showModal])

  const handleCascadeDelete = useCallback(async () => {
    if (!id) return
    setIsDeleting(true)
    setResult(null)

    try {
      const response = await fetch(`/api/cascade-delete?collection=${collection}&id=${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setResult({ success: true, message: data.message })
        setTimeout(() => {
          router.push(`/admin/collections/${collection}`)
        }, 1500)
      } else {
        setResult({ success: false, message: data.error || 'Cascade delete failed' })
      }
    } catch {
      setResult({ success: false, message: 'Network error — could not reach the server' })
    } finally {
      setIsDeleting(false)
    }
  }, [id, collection, router])

  if (!id) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="rounded border-none bg-error px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap text-error-foreground hover:opacity-90 cursor-pointer"
      >
        Cascade Delete
      </button>

      {showModal && (
        <div
          onClick={() => !isDeleting && setShowModal(false)}
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-[90%] max-w-[440px] rounded-lg bg-[var(--theme-elevation-0)] p-card-padding shadow-card-hover"
          >
            <h3 className="mb-2 text-body-md font-bold text-error">Cascade Delete {label}</h3>

            <p className="mb-5 text-body-sm leading-relaxed text-[var(--theme-elevation-800)]">
              This will permanently delete this {label.toLowerCase()} and{' '}
              <strong>{descendants}</strong> that belong to it. This action cannot be undone.
            </p>

            {result && (
              <p
                className={`mb-4 rounded px-3 py-2 text-[13px] font-medium ${
                  result.success ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
                }`}
              >
                {result.message}
              </p>
            )}

            <div className="flex justify-end gap-content-gap-xs.5">
              <button
                type="button"
                onClick={() => {
                  setShowModal(false)
                  setResult(null)
                }}
                disabled={isDeleting}
                className="cursor-pointer rounded border border-[var(--theme-elevation-300)] bg-transparent px-4 py-2 text-[13px] font-medium text-[var(--theme-elevation-800)] disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCascadeDelete}
                disabled={isDeleting}
                className="cursor-pointer rounded border-none bg-error px-4 py-2 text-[13px] font-semibold text-error-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete Everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export const CourseCascadeDelete = () => <CascadeDeleteButton collection="courses" />
export const ChapterCascadeDelete = () => <CascadeDeleteButton collection="chapters" />
export const LessonCascadeDelete = () => <CascadeDeleteButton collection="lessons" />
