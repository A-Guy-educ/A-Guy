'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useDocumentInfo, useField, useFormFields } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import {
  GripVertical,
  ChevronUp,
  ChevronDown,
  BookOpen,
  FileText,
  Trash2,
  Pencil,
  Loader2,
} from 'lucide-react'
import type { DocumentViewClientProps } from 'payload'
import { DefaultEditView } from '@payloadcms/ui'
import { ExerciseWorksheet } from '@/ui/web/exerciserenderer/ExerciseWorksheet'
import type { ContentData } from '@/server/payload/collections/Exercises/types'
import type { Media } from '@/payload-types'

// ── Types ─────────────────────────────────────────────────────────────────────

type RawBlock = Record<string, unknown>

interface ResolvedRow {
  index: number
  blockType: string
  refId: string
  title: string
  loading: boolean
  expanded: boolean
  exerciseData: ContentData | null
  mediaMap: Record<string, Media>
  error: boolean
}

// ── Block Parsing ────────────────────────────────────────────────────────────

function generateBlockId(): string {
  return Math.random().toString(36).slice(2, 14)
}

function extractId(val: unknown): string | null {
  if (typeof val === 'string' && val.length > 0) return val
  if (val && typeof val === 'object' && 'id' in val) return String((val as { id: unknown }).id)
  return null
}

function extractTitle(val: unknown): string | null {
  if (val && typeof val === 'object' && 'title' in val) {
    return String((val as { title: unknown }).title) || null
  }
  return null
}

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

// ── LessonExerciseEditor ───────────────────────────────────────────────────────

/**
 * LessonExerciseEditor - worksheet-style editor for lesson blocks.
 *
 * Replaces LessonBlocksField (sortable list of titles only) with a scrollable
 * worksheet view that shows the full exercise content inline, making it easier
 * to review and edit exercises directly within the lesson context.
 */
export const LessonExerciseEditor: React.FC = () => {
  useDocumentInfo() // Ensures document context is active
  const { value: blocksValue, setValue: setBlocksValue } = useField<string>({ path: 'blocks' })
  const router = useRouter()

  const blocks: RawBlock[] = useMemo(() => parseBlocks(blocksValue), [blocksValue])

  // Drag-and-drop state
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<number | null>(null)

  // Title cache (refId -> title)
  const [titleCache, setTitleCache] = useState<Record<string, string>>({})
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())

  // Exercise content cache (refId -> { content, mediaMap })
  const [exerciseCache, setExerciseCache] = useState<
    Record<string, { content: ContentData | null; mediaMap: Record<string, Media>; error: boolean }>
  >({})
  const [loadingContentIds, setLoadingContentIds] = useState<Set<string>>(new Set())

  // Expanded state per row
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  // Extract inline titles from populated objects into cache
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

  // Fetch exercise content for worksheet rendering
  useEffect(() => {
    const idsToFetch: string[] = []
    for (const block of blocks) {
      if (block.blockType !== 'exerciseRef') continue
      const id = extractId(block.exercise)
      if (!id || exerciseCache[id] || loadingContentIds.has(id)) continue
      idsToFetch.push(id)
    }
    if (idsToFetch.length === 0) return
    setLoadingContentIds((prev) => {
      const next = new Set(prev)
      idsToFetch.forEach((id) => next.add(id))
      return next
    })
    for (const id of idsToFetch) {
      fetch(`/api/exercises/${id}?depth=2`, { credentials: 'include' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          const content: ContentData | null = data?.content || null
          const mediaMap: Record<string, Media> = {}
          if (data?.mediaMap) {
            for (const m of data.mediaMap) {
              if (m.id) mediaMap[m.id] = m
            }
          }
          setExerciseCache((prev) => ({
            ...prev,
            [id]: { content, mediaMap, error: false },
          }))
        })
        .catch(() => {
          setExerciseCache((prev) => ({
            ...prev,
            [id]: { content: null, mediaMap: {}, error: true },
          }))
        })
        .finally(() => {
          setLoadingContentIds((prev) => {
            const next = new Set(prev)
            next.delete(id)
            return next
          })
        })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, exerciseCache])

  // Build display rows
  const rows: ResolvedRow[] = useMemo(() => {
    return blocks
      .map((block, index) => {
        const refField = block.blockType === 'exerciseRef' ? block.exercise : block.contentPage
        const refId = extractId(refField) || ''
        const title = titleCache[refId] || ''
        const cacheEntry = exerciseCache[refId]
        return {
          index,
          blockType: block.blockType as string,
          refId,
          title,
          loading: !title && loadingIds.has(refId),
          expanded: expandedRows.has(refId),
          exerciseData: cacheEntry?.content || null,
          mediaMap: cacheEntry?.mediaMap || {},
          error: cacheEntry?.error || false,
        }
      })
      .filter((row) => row.refId)
  }, [blocks, titleCache, loadingIds, expandedRows, exerciseCache])

  const updateBlocks = useCallback(
    (newBlocks: RawBlock[]) => {
      const normalized = newBlocks.map(normalizeBlock).filter(Boolean) as RawBlock[]
      setBlocksValue(JSON.stringify(normalized))
    },
    [setBlocksValue],
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

  const toggleRow = useCallback((refId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(refId)) next.delete(refId)
      else next.add(refId)
      return next
    })
  }, [])

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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        border: '1px solid var(--theme-elevation-150)',
        borderRadius: 6,
        overflow: 'hidden',
        backgroundColor: 'var(--theme-elevation-0)',
      }}
    >
      {rows.length === 0 && (
        <div
          style={{
            padding: '32px 16px',
            textAlign: 'center',
            color: 'var(--theme-elevation-400)',
            fontSize: 13,
          }}
        >
          No blocks yet. Create exercises or content pages for this lesson.
        </div>
      )}

      {rows.map((row, idx) => (
        <div key={`${row.blockType}-${row.refId}-${idx}`}>
          {/* Row header */}
          <div
            draggable
            onDragStart={(e) => handleDragStart(e, idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, idx)}
            onDragEnd={handleDragEnd}
            onClick={() => toggleRow(row.refId)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 12px',
              borderBottom:
                row.expanded || idx < rows.length - 1
                  ? '1px solid var(--theme-elevation-100)'
                  : 'none',
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
              userSelect: 'none',
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

            {/* Expand/collapse indicator */}
            <span
              style={{
                fontSize: 11,
                color: 'var(--theme-elevation-400)',
                flexShrink: 0,
              }}
            >
              {row.expanded ? '▲' : '▼'}
            </span>

            {/* Action buttons */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                moveBlock(row.index, row.index - 1)
              }}
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
              onClick={(e) => {
                e.stopPropagation()
                moveBlock(row.index, row.index + 1)
              }}
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
              onClick={(e) => {
                e.stopPropagation()
                editBlock(row.refId, row.blockType)
              }}
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
              onClick={(e) => {
                e.stopPropagation()
                deleteBlock(row.index)
              }}
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

          {/* Expanded worksheet content */}
          {row.expanded && (
            <div style={{ padding: '16px 24px', backgroundColor: 'var(--theme-elevation-0)' }}>
              {row.blockType === 'exerciseRef' ? (
                row.loading || loadingContentIds.has(row.refId) ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '16px 0',
                      color: 'var(--theme-elevation-400)',
                      fontSize: 13,
                    }}
                  >
                    <Loader2 size={14} className="animate-spin" />
                    Loading exercise content...
                  </div>
                ) : row.error || !row.exerciseData ? (
                  <div
                    style={{
                      padding: '12px',
                      color: 'var(--theme-error-500, #ef4444)',
                      fontSize: 13,
                    }}
                  >
                    Failed to load exercise content.
                  </div>
                ) : (
                  <div
                    style={{
                      border: '1px solid var(--theme-elevation-150)',
                      borderRadius: 6,
                      padding: '16px',
                      backgroundColor: 'var(--theme-elevation-50)',
                    }}
                  >
                    <ExerciseWorksheet
                      blocks={row.exerciseData.blocks}
                      mediaMap={row.mediaMap}
                      hideLatexBlocks={false}
                    />
                  </div>
                )
              ) : (
                <div
                  style={{
                    padding: '12px',
                    color: 'var(--theme-elevation-400)',
                    fontSize: 13,
                    fontStyle: 'italic',
                  }}
                >
                  Content page preview not available.
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Right Column Field Renderer ───────────────────────────────────────────────

interface RightColumnFieldProps {
  label: string
  children: React.ReactNode
}

function RightColumnField({ label, children }: RightColumnFieldProps) {
  return (
    <div style={{ marginBottom: 24 }}>
      <label
        style={{
          display: 'block',
          marginBottom: 8,
          fontWeight: 600,
          fontSize: 14,
          color: 'var(--theme-text)',
        }}
      >
        {label}
      </label>
      {children}
    </div>
  )
}

// ── Status Selector ────────────────────────────────────────────────────────────

function StatusField() {
  const { value, setValue } = useField<string>({ path: 'status' })
  return (
    <select
      value={value || 'draft'}
      onChange={(e) => setValue(e.target.value)}
      style={{
        width: '100%',
        padding: '8px 12px',
        fontSize: 14,
        borderRadius: 4,
        border: '1px solid var(--theme-elevation-150)',
        backgroundColor: 'var(--theme-elevation-0)',
        color: 'var(--theme-text)',
        cursor: 'pointer',
      }}
    >
      <option value="draft">Draft</option>
      <option value="published">Published</option>
      <option value="archived">Archived</option>
    </select>
  )
}

// ── Order Field ───────────────────────────────────────────────────────────────

function OrderField() {
  const { value, setValue } = useField<number>({ path: 'order' })
  return (
    <input
      type="number"
      value={value ?? 0}
      onChange={(e) => setValue(Number(e.target.value))}
      min={0}
      style={{
        width: '100%',
        padding: '8px 12px',
        fontSize: 14,
        borderRadius: 4,
        border: '1px solid var(--theme-elevation-150)',
        backgroundColor: 'var(--theme-elevation-0)',
        color: 'var(--theme-text)',
      }}
    />
  )
}

// ── Content Files Display ─────────────────────────────────────────────────────

function ContentFilesField() {
  const { value } = useField<unknown>({ path: 'contentFiles' })
  const files = Array.isArray(value) ? value : []
  if (files.length === 0) {
    return (
      <p style={{ fontSize: 13, color: 'var(--theme-elevation-400)', fontStyle: 'italic' }}>
        No content files attached.
      </p>
    )
  }
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {files.map((file: unknown, i: number) => {
        const fileId = extractId(file)
        const fileName =
          typeof file === 'object' && file && 'filename' in file
            ? String((file as { filename: unknown }).filename)
            : `File ${i + 1}`
        return (
          <li
            key={fileId || i}
            style={{
              padding: '4px 0',
              fontSize: 13,
              color: 'var(--theme-text)',
              borderBottom: '1px solid var(--theme-elevation-100)',
            }}
          >
            📎 {fileName}
          </li>
        )
      })}
    </ul>
  )
}

// ── Lesson Context Text Display ───────────────────────────────────────────────

function LessonContextTextField() {
  const { value } = useField<string>({ path: 'lessonContextText' })
  if (!value || !value.trim()) {
    return (
      <p style={{ fontSize: 13, color: 'var(--theme-elevation-400)', fontStyle: 'italic' }}>
        No context text set.
      </p>
    )
  }
  const preview = value.length > 200 ? value.slice(0, 200) + '...' : value
  return (
    <div
      style={{
        fontSize: 12,
        color: 'var(--theme-elevation-600)',
        fontFamily: 'monospace',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        maxHeight: 120,
        overflow: 'auto',
        padding: 8,
        backgroundColor: 'var(--theme-elevation-50)',
        borderRadius: 4,
        border: '1px solid var(--theme-elevation-150)',
      }}
    >
      {preview}
    </div>
  )
}

// ── LessonExerciseEditorLayout ────────────────────────────────────────────────

/**
 * Two-column edit layout for lessons.
 *
 * Left column (~65%): LessonExerciseEditor - scrollable worksheet of exercises
 * Right column (~35%): Metadata fields - order, status, contentFiles, lessonContextText
 * Header: "פרק / שיעור → תרגילים"
 */
export const LessonExerciseEditorLayout: React.FC<DocumentViewClientProps> = (props) => {
  useDocumentInfo() // Ensures document context is active
  const fields = useFormFields(([fields]) => fields)
  const title = fields?.title?.value as string | undefined
  const chapterField = fields?.chapter as { value: unknown } | undefined

  const [chapterTitle, setChapterTitle] = useState<string | null>(null)

  // Fetch chapter title if chapter relationship is set
  useEffect(() => {
    const chapterVal = chapterField?.value
    const chapterId = extractId(chapterVal)
    if (!chapterId) {
      setChapterTitle(null)
      return
    }
    fetch(`/api/chapters/${chapterId}?depth=0`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setChapterTitle(data?.title || null)
      })
      .catch(() => {
        setChapterTitle(null)
      })
  }, [chapterField?.value])

  // Build header text
  const headerText = useMemo(() => {
    const parts: string[] = []
    if (chapterTitle) parts.push(chapterTitle)
    if (title) parts.push(title)
    if (parts.length > 0) {
      return parts.join(' / ') + ' → תרגילים'
    }
    return 'תרגילים'
  }, [chapterTitle, title])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--theme-elevation-150)',
          backgroundColor: 'var(--theme-elevation-0)',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--theme-text)',
          }}
        >
          {headerText}
        </h2>
        <p
          style={{
            margin: '4px 0 0',
            fontSize: 12,
            color: 'var(--theme-elevation-500)',
          }}
        >
          Ordered playlist of exercises and content pages. Defines the lesson flow.
        </p>
      </div>

      {/* Two-column body */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '65% 35%',
          gap: 0,
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* Left column: worksheet editor */}
        <div
          style={{
            borderRight: '1px solid var(--theme-elevation-150)',
            padding: '24px',
            overflowY: 'auto',
            maxHeight: 'calc(100vh - 200px)',
          }}
        >
          <LessonExerciseEditor />
        </div>

        {/* Right column: metadata fields */}
        <div
          style={{
            padding: '24px',
            overflowY: 'auto',
            maxHeight: 'calc(100vh - 200px)',
            backgroundColor: 'var(--theme-elevation-50)',
          }}
        >
          <RightColumnField label="Order">
            <OrderField />
          </RightColumnField>

          <RightColumnField label="Status">
            <StatusField />
          </RightColumnField>

          <RightColumnField label="Content Files">
            <ContentFilesField />
          </RightColumnField>

          <RightColumnField label="Lesson Context Text">
            <LessonContextTextField />
          </RightColumnField>
        </div>
      </div>

      {/* Pass through to DefaultEditView for remaining functionality */}
      <DefaultEditView {...props} />
    </div>
  )
}

export default LessonExerciseEditorLayout
