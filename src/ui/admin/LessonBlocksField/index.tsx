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

interface BlockItem {
  id?: string
  blockType: 'exerciseRef' | 'contentPageRef'
  exercise?: string | { id: string; title?: string }
  contentPage?: string | { id: string; title?: string }
}

interface ResolvedBlock {
  index: number
  blockType: 'exerciseRef' | 'contentPageRef'
  refId: string
  title: string
  loading: boolean
}

/**
 * Custom Payload admin field for lesson blocks.
 * Shows a flat sortable list of exercise/content page titles
 * instead of the default expandable blocks UI.
 */
export const LessonBlocksField: React.FC<{ path: string }> = ({ path }) => {
  const { value, setValue } = useField<BlockItem[]>({ path })
  const docInfo = useDocumentInfo()
  const lessonId = docInfo?.id

  const blocks: BlockItem[] = useMemo(() => (Array.isArray(value) ? value : []), [value])

  // Resolved titles cache
  const [titleCache, setTitleCache] = useState<Record<string, string>>({})
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())

  // Extract ref IDs from blocks
  const getRefId = (block: BlockItem): string | null => {
    if (block.blockType === 'exerciseRef') {
      if (!block.exercise) return null
      return typeof block.exercise === 'string' ? block.exercise : block.exercise.id
    }
    if (block.blockType === 'contentPageRef') {
      if (!block.contentPage) return null
      return typeof block.contentPage === 'string' ? block.contentPage : block.contentPage.id
    }
    return null
  }

  const getInlineTitle = (block: BlockItem): string | null => {
    if (block.blockType === 'exerciseRef' && block.exercise && typeof block.exercise === 'object') {
      return block.exercise.title || null
    }
    if (
      block.blockType === 'contentPageRef' &&
      block.contentPage &&
      typeof block.contentPage === 'object'
    ) {
      return block.contentPage.title || null
    }
    return null
  }

  // Fetch titles for unresolved IDs
  useEffect(() => {
    const idsToFetch: Array<{ id: string; collection: string }> = []

    for (const block of blocks) {
      const refId = getRefId(block)
      if (!refId || titleCache[refId] || loadingIds.has(refId)) continue
      const inlineTitle = getInlineTitle(block)
      if (inlineTitle) {
        setTitleCache((prev) => ({ ...prev, [refId]: inlineTitle }))
        continue
      }
      const collection = block.blockType === 'exerciseRef' ? 'exercises' : 'content-pages'
      idsToFetch.push({ id: refId, collection })
    }

    if (idsToFetch.length === 0) return

    setLoadingIds((prev) => {
      const next = new Set(prev)
      idsToFetch.forEach((item) => next.add(item.id))
      return next
    })

    // Fetch each title
    for (const { id, collection } of idsToFetch) {
      fetch(`/api/${collection}/${id}?depth=0`, { credentials: 'include' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.title) {
            setTitleCache((prev) => ({ ...prev, [id]: data.title }))
          } else {
            setTitleCache((prev) => ({ ...prev, [id]: `(${id.slice(0, 8)}...)` }))
          }
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
  }, [blocks, titleCache, loadingIds])

  // Build resolved list
  const resolvedBlocks: ResolvedBlock[] = useMemo(() => {
    return blocks.map((block, index) => {
      const refId = getRefId(block) || ''
      const inlineTitle = getInlineTitle(block)
      const title = inlineTitle || titleCache[refId] || ''
      return {
        index,
        blockType: block.blockType,
        refId,
        title,
        loading: !title && loadingIds.has(refId),
      }
    })
  }, [blocks, titleCache, loadingIds])

  const moveBlock = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (toIndex < 0 || toIndex >= blocks.length) return
      const next = [...blocks]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      setValue(next)
    },
    [blocks, setValue],
  )

  const removeBlock = useCallback(
    (index: number) => {
      const next = blocks.filter((_, i) => i !== index)
      setValue(next)
    },
    [blocks, setValue],
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
      const params = new URLSearchParams({
        depth: '0',
        limit: '50',
        sort: 'title',
      })

      // Filter exercises by lesson
      if (type === 'exercise' && lessonId) {
        params.set('where[lesson][equals]', String(lessonId))
      }
      // Filter content pages by lesson + published
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
    (type: 'exercise' | 'contentPage', id: string, title: string) => {
      const newBlock: BlockItem =
        type === 'exercise'
          ? { blockType: 'exerciseRef', exercise: id }
          : { blockType: 'contentPageRef', contentPage: id }

      setValue([...blocks, newBlock])
      setTitleCache((prev) => ({ ...prev, [id]: title }))
      setShowPicker(null)
    },
    [blocks, setValue],
  )

  const filteredResults = useMemo(() => {
    if (!pickerSearch) return pickerResults
    const q = pickerSearch.toLowerCase()
    return pickerResults.filter((r) => r.title.toLowerCase().includes(q))
  }, [pickerResults, pickerSearch])

  // Already-added IDs to prevent duplicates
  const addedIds = useMemo(() => new Set(blocks.map(getRefId).filter(Boolean)), [blocks])

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
        {resolvedBlocks.length === 0 && (
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

        {resolvedBlocks.map((block, idx) => (
          <div
            key={`${block.blockType}-${block.refId}-${idx}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderBottom:
                idx < resolvedBlocks.length - 1 ? '1px solid var(--theme-elevation-100)' : 'none',
              background: idx % 2 === 0 ? 'transparent' : 'var(--theme-elevation-50)',
            }}
          >
            {/* Drag handle / order indicator */}
            <span
              style={{
                color: 'var(--theme-elevation-300)',
                flexShrink: 0,
                cursor: 'grab',
              }}
            >
              <GripVertical size={16} />
            </span>

            {/* Order number */}
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

            {/* Type icon + badge */}
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
                  block.blockType === 'exerciseRef'
                    ? 'var(--theme-success-100, #dcfce7)'
                    : 'var(--theme-warning-100, #fef3c7)',
                color:
                  block.blockType === 'exerciseRef'
                    ? 'var(--theme-success-600, #16a34a)'
                    : 'var(--theme-warning-600, #ca8a04)',
              }}
            >
              {block.blockType === 'exerciseRef' ? (
                <>
                  <BookOpen size={12} /> Exercise
                </>
              ) : (
                <>
                  <FileText size={12} /> Content
                </>
              )}
            </span>

            {/* Title */}
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
              {block.loading ? (
                <span style={{ color: 'var(--theme-elevation-400)' }}>Loading...</span>
              ) : (
                block.title || (
                  <span style={{ color: 'var(--theme-elevation-400)', fontStyle: 'italic' }}>
                    Untitled
                  </span>
                )
              )}
            </span>

            {/* Move up/down */}
            <button
              type="button"
              onClick={() => moveBlock(idx, idx - 1)}
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
              onClick={() => moveBlock(idx, idx + 1)}
              disabled={idx === resolvedBlocks.length - 1}
              style={{
                padding: 4,
                border: 'none',
                background: 'transparent',
                cursor: idx === resolvedBlocks.length - 1 ? 'not-allowed' : 'pointer',
                opacity: idx === resolvedBlocks.length - 1 ? 0.2 : 0.6,
                color: 'var(--theme-text)',
              }}
              title="Move down"
            >
              <ChevronDown size={14} />
            </button>

            {/* Remove */}
            <button
              type="button"
              onClick={() => removeBlock(idx)}
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
                  style={{ textAlign: 'center', color: 'var(--theme-elevation-400)', padding: 20 }}
                >
                  Loading...
                </p>
              )}
              {!pickerLoading && filteredResults.length === 0 && (
                <p
                  style={{ textAlign: 'center', color: 'var(--theme-elevation-400)', padding: 20 }}
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
