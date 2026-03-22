'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useField, useDocumentInfo } from '@payloadcms/ui'
import {
  GripVertical,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  BookOpen,
  FileText,
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
  const docInfo = useDocumentInfo()
  const lessonId = docInfo?.id

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

  const removeBlock = useCallback(
    (index: number) => {
      updateBlocks(blocks.filter((_, i) => i !== index))
    },
    [blocks, updateBlocks],
  )

  // Picker state
  const [showPicker, setShowPicker] = useState<'exercise' | 'contentPage' | null>(null)
  const [pickerResults, setPickerResults] = useState<Array<{ id: string; title: string }>>([])
  const [pickerLoading, setPickerLoading] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')

  const openPicker = useCallback(
    (type: 'exercise' | 'contentPage') => {
      setShowPicker(type)
      setPickerSearch('')
      setPickerResults([])
      setPickerLoading(true)

      const collection = type === 'exercise' ? 'exercises' : 'content-pages'
      const params = new URLSearchParams({ depth: '0', limit: '50', sort: 'title' })

      if (type === 'exercise' && lessonId) {
        params.set('where[lesson][equals]', String(lessonId))
      }
      if (type === 'contentPage' && lessonId) {
        params.set('where[lesson][equals]', String(lessonId))
        params.set('where[status][equals]', 'published')
        params.set('where[isActive][equals]', 'true')
      }

      fetch(`/api/${collection}?${params}`, { credentials: 'include' })
        .then((res) => res.json())
        .then((data) => {
          setPickerResults(
            (data.docs || []).map((doc: { id: string; title?: string }) => ({
              id: doc.id,
              title: doc.title || doc.id,
            })),
          )
        })
        .catch(() => setPickerResults([]))
        .finally(() => setPickerLoading(false))
    },
    [lessonId],
  )

  const addBlock = useCallback(
    (type: 'exercise' | 'contentPage', refId: string, title: string) => {
      const newBlock: RawBlock =
        type === 'exercise'
          ? { id: generateBlockId(), blockType: 'exerciseRef', exercise: refId }
          : { id: generateBlockId(), blockType: 'contentPageRef', contentPage: refId }

      // Read current value directly to avoid stale closure
      const current = parseBlocks(value)
      updateBlocks([...current, newBlock])
      setTitleCache((prev) => ({ ...prev, [refId]: title }))
      setShowPicker(null)
    },
    [value, updateBlocks],
  )

  const filteredResults = useMemo(() => {
    if (!pickerSearch) return pickerResults
    const q = pickerSearch.toLowerCase()
    return pickerResults.filter((r) => r.title.toLowerCase().includes(q))
  }, [pickerResults, pickerSearch])

  const addedIds = useMemo(() => {
    const ids = new Set<string>()
    for (const block of blocks) {
      const refField = block.blockType === 'exerciseRef' ? block.exercise : block.contentPage
      const id = extractId(refField)
      if (id) ids.add(id)
    }
    return ids
  }, [blocks])

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
            No blocks added yet. Add exercises or content pages below.
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
              onClick={() => removeBlock(row.index)}
              style={{
                padding: 4,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                opacity: 0.5,
                color: 'var(--theme-error-500, #ef4444)',
              }}
              title="Remove"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Add buttons */}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button
          type="button"
          onClick={() => openPicker('exercise')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            border: '1px dashed var(--theme-elevation-150)',
            borderRadius: 6,
            background: 'transparent',
            cursor: 'pointer',
            color: 'var(--theme-text)',
            fontSize: 13,
          }}
        >
          <Plus size={14} />
          <BookOpen size={14} />
          Add Exercise
        </button>
        <button
          type="button"
          onClick={() => openPicker('contentPage')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            border: '1px dashed var(--theme-elevation-150)',
            borderRadius: 6,
            background: 'transparent',
            cursor: 'pointer',
            color: 'var(--theme-text)',
            fontSize: 13,
          }}
        >
          <Plus size={14} />
          <FileText size={14} />
          Add Content Page
        </button>
      </div>

      {/* Picker modal */}
      {showPicker && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)',
          }}
          onClick={() => setShowPicker(null)}
        >
          <div
            style={{
              background: 'var(--theme-bg)',
              borderRadius: 8,
              padding: 20,
              width: 480,
              maxHeight: '70vh',
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid var(--theme-elevation-150)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>
              {showPicker === 'exercise' ? 'Select Exercise' : 'Select Content Page'}
            </h3>

            <input
              type="text"
              placeholder="Search..."
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              autoFocus
              style={{
                padding: '8px 12px',
                border: '1px solid var(--theme-elevation-150)',
                borderRadius: 4,
                background: 'var(--theme-input-bg)',
                color: 'var(--theme-text)',
                fontSize: 14,
                marginBottom: 12,
              }}
            />

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {pickerLoading && (
                <p
                  style={{
                    textAlign: 'center',
                    color: 'var(--theme-elevation-400)',
                    padding: 20,
                  }}
                >
                  Loading...
                </p>
              )}
              {!pickerLoading && filteredResults.length === 0 && (
                <p
                  style={{
                    textAlign: 'center',
                    color: 'var(--theme-elevation-400)',
                    padding: 20,
                  }}
                >
                  No results found
                </p>
              )}
              {filteredResults.map((result) => {
                const alreadyAdded = addedIds.has(result.id)
                return (
                  <button
                    key={result.id}
                    type="button"
                    disabled={alreadyAdded}
                    onClick={() => addBlock(showPicker, result.id, result.title)}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '10px 12px',
                      border: 'none',
                      borderBottom: '1px solid var(--theme-elevation-100)',
                      background: alreadyAdded ? 'var(--theme-elevation-50)' : 'transparent',
                      cursor: alreadyAdded ? 'not-allowed' : 'pointer',
                      textAlign: 'start',
                      fontSize: 14,
                      color: alreadyAdded ? 'var(--theme-elevation-300)' : 'var(--theme-text)',
                    }}
                  >
                    {result.title}
                    {alreadyAdded && (
                      <span style={{ fontSize: 11, marginInlineStart: 8, opacity: 0.6 }}>
                        (already added)
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              onClick={() => setShowPicker(null)}
              style={{
                marginTop: 12,
                padding: '8px 16px',
                border: '1px solid var(--theme-elevation-150)',
                borderRadius: 4,
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--theme-text)',
                fontSize: 13,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
