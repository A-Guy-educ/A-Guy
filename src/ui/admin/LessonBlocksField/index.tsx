'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useField } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import {
  GripVertical,
  ChevronUp,
  ChevronDown,
  BookOpen,
  FileText,
  Trash2,
  Pencil,
} from 'lucide-react'

function generateBlockId(): string {
  return Math.random().toString(36).slice(2, 14)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawBlock = Record<string, any>

/** Extract a plain ID string from a value that might be a string ID or a populated object */
function extractId(val: unknown): string | null {
  if (typeof val === 'string' && val.length > 0) return val
  if (val && typeof val === 'object' && 'id' in val) return String((val as { id: unknown }).id)
  return null
}

/** Extract title from a potentially populated relationship value */
function extractTitle(val: unknown): string | null {
  if (val && typeof val === 'object' && 'title' in val) {
    return String((val as { title: unknown }).title) || null
  }
  return null
}

/** Normalize a block to the format Payload expects for saving:
 *  - Ensure blockType is present
 *  - Ensure id is present
 *  - Relationship values are plain ID strings
 */
function normalizeBlock(block: RawBlock): RawBlock | null {
  if (!block.blockType) return null

  const normalized: RawBlock = {
    id: block.id || generateBlockId(),
    blockType: block.blockType,
  }

  if (block.blockType === 'exerciseRef') {
    const id = extractId(block.exercise)
    if (!id) return null
    normalized.exercise = id
  } else if (block.blockType === 'contentPageRef') {
    const id = extractId(block.contentPage)
    if (!id) return null
    normalized.contentPage = id
  } else {
    return null
  }

  return normalized
}

interface ResolvedRow {
  index: number
  blockType: string
  refId: string
  title: string
  loading: boolean
}

/**
 * Custom Payload admin field for lesson blocks.
 * Shows a flat sortable list of exercise/content page titles
 * instead of the default expandable blocks UI.
 */
/** Parse blocks from the textarea value (string or array) */
function parseBlocks(val: unknown): RawBlock[] {
  if (Array.isArray(val)) return val
  if (typeof val === 'string' && val.trim()) {
    try {
      const parsed = JSON.parse(val)
      if (Array.isArray(parsed)) return parsed
    } catch {
      // ignore parse errors
    }
  }
  return []
}

export const LessonBlocksField: React.FC<{ path: string }> = ({ path }) => {
  const { value, setValue } = useField<string>({ path })
  const router = useRouter()

  const blocks: RawBlock[] = useMemo(() => parseBlocks(value), [value])

  // Drag-and-drop state
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<number | null>(null)

  // Title cache (refId -> title)
  const [titleCache, setTitleCache] = useState<Record<string, string>>({})
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())

  // Extract inline titles from populated objects into cache on first render
  useEffect(() => {
    const newTitles: Record<string, string> = {}
    for (const block of blocks) {
      if (block.blockType === 'exerciseRef') {
        const id = extractId(block.exercise)
        const title = extractTitle(block.exercise)
        if (id && title && !titleCache[id]) newTitles[id] = title
      } else if (block.blockType === 'contentPageRef') {
        const id = extractId(block.contentPage)
        const title = extractTitle(block.contentPage)
        if (id && title && !titleCache[id]) newTitles[id] = title
      }
    }
    if (Object.keys(newTitles).length > 0) {
      setTitleCache((prev) => ({ ...prev, ...newTitles }))
    }
    // Only run when blocks change, not when titleCache changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks])

  // Fetch titles for IDs not in cache
  useEffect(() => {
    const idsToFetch: Array<{ id: string; collection: string }> = []

    for (const block of blocks) {
      const refField = block.blockType === 'exerciseRef' ? block.exercise : block.contentPage
      const id = extractId(refField)
      if (!id || titleCache[id] || loadingIds.has(id)) continue
      const collection = block.blockType === 'exerciseRef' ? 'exercises' : 'content-pages'
      idsToFetch.push({ id, collection })
    }

    if (idsToFetch.length === 0) return

    setLoadingIds((prev) => {
      const next = new Set(prev)
      idsToFetch.forEach((item) => next.add(item.id))
      return next
    })

    for (const { id, collection } of idsToFetch) {
      fetch(`/api/${collection}/${id}?depth=0`, { credentials: 'include' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          const title = data?.title || `(${id.slice(0, 8)}...)`
          setTitleCache((prev) => ({ ...prev, [id]: title }))
        })
        .catch(() => {
          setTitleCache((prev) => ({ ...prev, [id]: `(${id.slice(0, 8)}...)` }))
        })
        .finally(() => {
          setLoadingIds((prev) => {
            const next = new Set(prev)
            next.delete(id)
            return next
          })
        })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, titleCache])

  // Build display rows
  const rows: ResolvedRow[] = useMemo(() => {
    return blocks
      .map((block, index) => {
        const refField = block.blockType === 'exerciseRef' ? block.exercise : block.contentPage
        const refId = extractId(refField) || ''
        const title = titleCache[refId] || ''
        return {
          index,
          blockType: block.blockType as string,
          refId,
          title,
          loading: !title && loadingIds.has(refId),
        }
      })
      .filter((row) => row.refId) // skip blocks with no ref
  }, [blocks, titleCache, loadingIds])

  /** Update Payload form state with normalized blocks (serialized as JSON string) */
  const updateBlocks = useCallback(
    (newBlocks: RawBlock[]) => {
      const normalized = newBlocks.map(normalizeBlock).filter(Boolean) as RawBlock[]
      setValue(JSON.stringify(normalized))
    },
    [setValue],
  )

  const moveBlock = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (toIndex < 0 || toIndex >= blocks.length) return
      const next = [...blocks]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      updateBlocks(next)
    },
    [blocks, updateBlocks],
  )

  const deleteBlock = useCallback(
    (index: number) => {
      const next = [...blocks]
      next.splice(index, 1)
      updateBlocks(next)
    },
    [blocks, updateBlocks],
  )

  const editBlock = useCallback(
    (refId: string, blockType: string) => {
      const collection = blockType === 'exerciseRef' ? 'exercises' : 'content-pages'
      router.push(`/admin/collections/${collection}/${refId}`)
    },
    [router],
  )

  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    setDragIndex(idx)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(idx))
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropTarget(idx)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDropTarget(null)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent, toIdx: number) => {
      e.preventDefault()
      const fromIdx = dragIndex
      setDragIndex(null)
      setDropTarget(null)
      if (fromIdx !== null && fromIdx !== toIdx) {
        moveBlock(fromIdx, toIdx)
      }
    },
    [dragIndex, moveBlock],
  )

  const handleDragEnd = useCallback(() => {
    setDragIndex(null)
    setDropTarget(null)
  }, [])

  return (
    <div style={{ marginBottom: 24 }}>
      <label
        style={{
          display: 'block',
          marginBottom: 12,
          fontWeight: 600,
          fontSize: 14,
          color: 'var(--theme-text)',
        }}
      >
        Lesson Blocks
      </label>
      <p
        style={{
          fontSize: 12,
          color: 'var(--theme-elevation-500)',
          marginBottom: 12,
          marginTop: -4,
        }}
      >
        Ordered playlist of exercises and content pages. Defines the lesson flow.
      </p>

      {/* Block list */}
      <div
        style={{
          border: '1px solid var(--theme-elevation-150)',
          borderRadius: 6,
          overflow: 'hidden',
        }}
      >
        {rows.length === 0 && (
          <div
            style={{
              padding: '24px 16px',
              textAlign: 'center',
              color: 'var(--theme-elevation-400)',
              fontSize: 13,
            }}
          >
            No blocks yet. Create exercises or content pages for this lesson.
          </div>
        )}

        {rows.map((row, idx) => (
          <div
            key={`${row.blockType}-${row.refId}-${idx}`}
            draggable
            onDragStart={(e) => handleDragStart(e, idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, idx)}
            onDragEnd={handleDragEnd}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderBottom: idx < rows.length - 1 ? '1px solid var(--theme-elevation-100)' : 'none',
              background:
                dropTarget === idx
                  ? 'var(--theme-elevation-100)'
                  : dragIndex === idx
                    ? 'var(--theme-elevation-50)'
                    : idx % 2 === 0
                      ? 'transparent'
                      : 'var(--theme-elevation-50)',
              opacity: dragIndex === idx ? 0.5 : 1,
              borderTop:
                dropTarget === idx ? '2px solid var(--theme-success-500, #22c55e)' : 'none',
              transition: 'background 0.15s, opacity 0.15s',
              cursor: 'grab',
            }}
          >
            <span style={{ color: 'var(--theme-elevation-300)', flexShrink: 0 }}>
              <GripVertical size={16} />
            </span>

            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--theme-elevation-400)',
                minWidth: 20,
                textAlign: 'center',
                flexShrink: 0,
              }}
            >
              {idx + 1}
            </span>

            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 600,
                flexShrink: 0,
                background:
                  row.blockType === 'exerciseRef'
                    ? 'var(--theme-success-100, #dcfce7)'
                    : 'var(--theme-warning-100, #fef3c7)',
                color:
                  row.blockType === 'exerciseRef'
                    ? 'var(--theme-success-600, #16a34a)'
                    : 'var(--theme-warning-600, #ca8a04)',
              }}
            >
              {row.blockType === 'exerciseRef' ? (
                <>
                  <BookOpen size={12} /> Exercise
                </>
              ) : (
                <>
                  <FileText size={12} /> Content
                </>
              )}
            </span>

            <span
              style={{
                flex: 1,
                fontSize: 14,
                color: 'var(--theme-text)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {row.loading ? (
                <span style={{ color: 'var(--theme-elevation-400)' }}>Loading...</span>
              ) : (
                row.title || (
                  <span style={{ color: 'var(--theme-elevation-400)', fontStyle: 'italic' }}>
                    Untitled
                  </span>
                )
              )}
            </span>

            <button
              type="button"
              onClick={() => moveBlock(row.index, row.index - 1)}
              disabled={idx === 0}
              style={{
                padding: 4,
                border: 'none',
                background: 'transparent',
                cursor: idx === 0 ? 'not-allowed' : 'pointer',
                opacity: idx === 0 ? 0.2 : 0.6,
                color: 'var(--theme-text)',
              }}
              title="Move up"
            >
              <ChevronUp size={14} />
            </button>
            <button
              type="button"
              onClick={() => moveBlock(row.index, row.index + 1)}
              disabled={idx === rows.length - 1}
              style={{
                padding: 4,
                border: 'none',
                background: 'transparent',
                cursor: idx === rows.length - 1 ? 'not-allowed' : 'pointer',
                opacity: idx === rows.length - 1 ? 0.2 : 0.6,
                color: 'var(--theme-text)',
              }}
              title="Move down"
            >
              <ChevronDown size={14} />
            </button>
            <button
              type="button"
              onClick={() => editBlock(row.refId, row.blockType)}
              style={{
                padding: 4,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                opacity: 0.6,
                color: 'var(--theme-text)',
              }}
              title="Edit"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={() => deleteBlock(row.index)}
              style={{
                padding: 4,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                opacity: 0.6,
                color: 'var(--theme-error-500, #ef4444)',
              }}
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
