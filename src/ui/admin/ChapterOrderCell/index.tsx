'use client'

/**
 * Custom cell for the `order` field in the Chapters admin list view.
 * Renders the current order number with ↑ / ↓ arrow buttons that move
 * the chapter up or down within its course.  After a successful move the
 * page is refreshed so the list reflects the new sort order.
 *
 * @fileType component
 * @domain courses
 * @pattern admin-cell
 * @ai-summary Order cell with up/down arrows for reordering chapters in admin list
 */

import React, { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DefaultCellComponentProps } from 'payload'

export const ChapterOrderCell: React.FC<DefaultCellComponentProps> = ({ cellData, rowData }) => {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const order = typeof cellData === 'number' ? cellData : Number(cellData ?? 0)
  const chapterId = rowData?.id as string | undefined

  const move = useCallback(
    async (direction: 'up' | 'down') => {
      if (!chapterId || loading) return
      setLoading(true)
      try {
        const res = await fetch('/api/chapters/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ id: chapterId, direction }),
        })
        if (res.ok) {
          router.refresh()
        }
      } finally {
        setLoading(false)
      }
    },
    [chapterId, loading, router],
  )

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        minWidth: '80px',
      }}
    >
      <span style={{ minWidth: '24px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {order}
      </span>
      <button
        type="button"
        title="Move up"
        disabled={loading}
        onClick={(e) => {
          e.stopPropagation()
          move('up')
        }}
        style={{
          background: 'none',
          border: '1px solid var(--theme-elevation-200)',
          borderRadius: '3px',
          cursor: loading ? 'not-allowed' : 'pointer',
          padding: '2px 4px',
          lineHeight: 1,
          fontSize: '12px',
          opacity: loading ? 0.5 : 1,
          color: 'var(--theme-text)',
        }}
      >
        ↑
      </button>
      <button
        type="button"
        title="Move down"
        disabled={loading}
        onClick={(e) => {
          e.stopPropagation()
          move('down')
        }}
        style={{
          background: 'none',
          border: '1px solid var(--theme-elevation-200)',
          borderRadius: '3px',
          cursor: loading ? 'not-allowed' : 'pointer',
          padding: '2px 4px',
          lineHeight: 1,
          fontSize: '12px',
          opacity: loading ? 0.5 : 1,
          color: 'var(--theme-text)',
        }}
      >
        ↓
      </button>
    </div>
  )
}
