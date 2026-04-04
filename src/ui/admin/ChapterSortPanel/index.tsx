'use client'

/**
 * Drag-and-drop sort panel for the Chapters admin list view.
 * Rendered in the `beforeList` slot — shows a "Sort chapters" button that
 * opens a modal containing all chapters for the currently-filtered course,
 * ordered by the `order` field.  Users can drag items to reorder them;
 * saving commits the new order to the database via POST /api/chapters/reorder.
 *
 * @fileType component
 * @domain courses
 * @pattern admin-sort-panel
 * @ai-summary Drag-and-drop chapter reorder modal shown above the chapters list
 */

import React, { useCallback, useEffect, useState } from 'react'
import { Reorder } from 'framer-motion'
import { useRouter, useSearchParams } from 'next/navigation'

interface ChapterItem {
  id: string
  order: number
  title?: string | null
  adminTitle?: string | null
  chapterLabel?: string | null
}

export const ChapterSortPanel: React.FC = () => {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [open, setOpen] = useState(false)
  const [chapters, setChapters] = useState<ChapterItem[]>([])
  const [courseId, setCourseId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Read courseId from Payload admin filter params (?where[course][equals]=<id>)
  const extractCourseId = useCallback((): string | null => {
    // Payload encodes filter as: where[course][equals]=<id>
    const raw = searchParams.get('where[course][equals]')
    if (raw) return raw

    // Also try the encoded form that Payload sometimes produces
    for (const [key, value] of searchParams.entries()) {
      if (key.includes('course') && key.includes('equals')) {
        return value
      }
    }
    return null
  }, [searchParams])

  const fetchChapters = useCallback(
    async (cId: string) => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({
          'where[course][equals]': cId,
          sort: 'order',
          limit: '500',
          depth: '0',
        })
        const res = await fetch(`/api/chapters?${params}`, {
          credentials: 'include',
        })
        if (!res.ok) throw new Error(`Failed to fetch chapters: ${res.status}`)
        const data = await res.json()
        setChapters(data.docs ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load chapters')
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const handleOpen = useCallback(async () => {
    const cId = extractCourseId()
    if (!cId) {
      setError('Please filter the list by a specific course before sorting.')
      setOpen(true)
      return
    }
    setCourseId(cId)
    setOpen(true)
    await fetchChapters(cId)
  }, [extractCourseId, fetchChapters])

  const handleSave = useCallback(async () => {
    if (!courseId || chapters.length === 0) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/chapters/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          courseId,
          orderedIds: chapters.map((c) => c.id),
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `Request failed: ${res.status}`)
      }
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save order')
    } finally {
      setSaving(false)
    }
  }, [courseId, chapters, router])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  const labelFor = (c: ChapterItem) =>
    c.adminTitle ?? `${c.chapterLabel ? `${c.chapterLabel} – ` : ''}${c.title ?? c.id}`

  return (
    <>
      <div style={{ padding: '8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          type="button"
          onClick={handleOpen}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            borderRadius: '4px',
            border: '1px solid var(--theme-elevation-300)',
            background: 'var(--theme-elevation-50)',
            color: 'var(--theme-text)',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          ⠿ Sort Chapters
        </button>
        <span style={{ fontSize: '12px', color: 'var(--theme-elevation-500)' }}>
          Filter by course first, then drag to reorder
        </span>
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Sort chapters"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false)
          }}
        >
          <div
            style={{
              background: 'var(--theme-bg)',
              border: '1px solid var(--theme-elevation-200)',
              borderRadius: '8px',
              width: '480px',
              maxWidth: '95vw',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--theme-elevation-200)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Sort Chapters</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '18px',
                  color: 'var(--theme-elevation-500)',
                  lineHeight: 1,
                  padding: '2px 6px',
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
              {loading && (
                <p style={{ color: 'var(--theme-elevation-500)', fontSize: '13px' }}>
                  Loading chapters…
                </p>
              )}
              {error && (
                <p style={{ color: 'var(--theme-error-500, #ef4444)', fontSize: '13px' }}>
                  {error}
                </p>
              )}
              {!loading && !error && chapters.length === 0 && (
                <p style={{ color: 'var(--theme-elevation-500)', fontSize: '13px' }}>
                  No chapters found for this course.
                </p>
              )}
              {!loading && chapters.length > 0 && (
                <Reorder.Group
                  axis="y"
                  values={chapters}
                  onReorder={setChapters}
                  style={{ listStyle: 'none', margin: 0, padding: 0 }}
                >
                  {chapters.map((chapter) => (
                    <Reorder.Item
                      key={chapter.id}
                      value={chapter}
                      style={{
                        padding: '10px 12px',
                        marginBottom: '6px',
                        background: 'var(--theme-elevation-50)',
                        border: '1px solid var(--theme-elevation-200)',
                        borderRadius: '4px',
                        cursor: 'grab',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        fontSize: '13px',
                        userSelect: 'none',
                      }}
                    >
                      <span
                        style={{
                          color: 'var(--theme-elevation-400)',
                          fontSize: '16px',
                          flexShrink: 0,
                        }}
                      >
                        ⠿
                      </span>
                      <span
                        style={{
                          minWidth: '24px',
                          color: 'var(--theme-elevation-500)',
                          fontSize: '11px',
                          flexShrink: 0,
                        }}
                      >
                        #{chapters.indexOf(chapter) + 1}
                      </span>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {labelFor(chapter)}
                      </span>
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '14px 20px',
                borderTop: '1px solid var(--theme-elevation-200)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
              }}
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  padding: '7px 16px',
                  borderRadius: '4px',
                  border: '1px solid var(--theme-elevation-300)',
                  background: 'none',
                  color: 'var(--theme-text)',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || chapters.length === 0}
                style={{
                  padding: '7px 16px',
                  borderRadius: '4px',
                  border: 'none',
                  background: 'var(--theme-success-500, #22c55e)',
                  color: '#fff',
                  cursor: saving || chapters.length === 0 ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                  opacity: saving || chapters.length === 0 ? 0.6 : 1,
                }}
              >
                {saving ? 'Saving…' : 'Save Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
