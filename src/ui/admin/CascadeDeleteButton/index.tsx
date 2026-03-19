'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'

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

export const CascadeDeleteButton: React.FC<{ collection: CollectionSlug }> = ({ collection }) => {
  const { id } = useDocumentInfo()
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  const label = COLLECTION_LABELS[collection]
  const descendants = DESCENDANT_DESCRIPTIONS[collection]

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
        setResult({
          success: true,
          message: data.message,
        })
        // Redirect to collection list after short delay
        setTimeout(() => {
          router.push(`/admin/collections/${collection}`)
        }, 1500)
      } else {
        setResult({
          success: false,
          message: data.error || 'Cascade delete failed',
        })
      }
    } catch {
      setResult({
        success: false,
        message: 'Network error — could not reach the server',
      })
    } finally {
      setIsDeleting(false)
      setShowConfirm(false)
    }
  }, [id, collection, router])

  if (!id) return null

  return (
    <div
      style={{
        padding: 16,
        marginTop: 16,
        border: '1px solid var(--theme-elevation-200)',
        borderRadius: 4,
        backgroundColor: 'var(--theme-elevation-50)',
      }}
    >
      <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600 }}>Cascade Delete</h4>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--theme-elevation-600)' }}>
        Delete this {label.toLowerCase()} and {descendants} that belong to it.
      </p>

      {!showConfirm ? (
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          disabled={isDeleting}
          style={{
            padding: '6px 14px',
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 4,
            border: 'none',
            backgroundColor: '#dc2626',
            color: '#fff',
            cursor: isDeleting ? 'not-allowed' : 'pointer',
            opacity: isDeleting ? 0.6 : 1,
          }}
        >
          Cascade Delete {label}
        </button>
      ) : (
        <div>
          <p
            style={{
              margin: '0 0 8px',
              fontSize: 12,
              fontWeight: 600,
              color: '#dc2626',
            }}
          >
            Are you sure? This will permanently delete this {label.toLowerCase()} and {descendants}.
            This action cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={handleCascadeDelete}
              disabled={isDeleting}
              style={{
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 4,
                border: 'none',
                backgroundColor: '#dc2626',
                color: '#fff',
                cursor: isDeleting ? 'not-allowed' : 'pointer',
                opacity: isDeleting ? 0.6 : 1,
              }}
            >
              {isDeleting ? 'Deleting...' : 'Yes, Delete Everything'}
            </button>
            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              disabled={isDeleting}
              style={{
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 500,
                borderRadius: 4,
                border: '1px solid var(--theme-elevation-300)',
                backgroundColor: 'transparent',
                color: 'var(--theme-elevation-800)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {result && (
        <p
          style={{
            marginTop: 10,
            fontSize: 12,
            fontWeight: 500,
            color: result.success ? '#16a34a' : '#dc2626',
          }}
        >
          {result.message}
        </p>
      )}
    </div>
  )
}

// Collection-specific wrappers for Payload's component registration
export const CourseCascadeDelete = () => <CascadeDeleteButton collection="courses" />
export const ChapterCascadeDelete = () => <CascadeDeleteButton collection="chapters" />
export const LessonCascadeDelete = () => <CascadeDeleteButton collection="lessons" />
