'use client'

import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import type { AxisSpecV1 } from '@/infra/contracts/graphics/axis.v1'
import type { JXGBoard, JXGElement } from 'jsxgraph'
import { JSXGraphBoard } from '../shared/JSXGraphBoard'
import { resolveViewport } from '@/infra/utils/graphics/viewport-utils'

interface AxisCanvasProps {
  id: string
  axis: AxisSpecV1
  onPointMoved?: (index: number, x: number, y: number) => void
}

export const AxisCanvas: React.FC<AxisCanvasProps> = ({ id, axis, onPointMoved }) => {
  const boardRef = useRef<JXGBoard | null>(null)
  const isSyncingRef = useRef(false)
  const elementsRef = useRef<Map<string, JXGElement>>(new Map())

  const syncToBoard = useCallback(() => {
    const board = boardRef.current
    if (!board) return

    isSyncingRef.current = true
    board.suspendUpdate()

    try {
      const existingIds = new Set(elementsRef.current.keys())
      const newIds = new Set<string>()

      // Sync points
      axis.elements.points.forEach((point, index) => {
        const elemId = `point-${index}`
        newIds.add(elemId)
        const existing = elementsRef.current.get(elemId)

        if (existing && existing.moveTo) {
          existing.moveTo([point.x, point.y])
        } else {
          if (existing) {
            board.removeObject(existing)
            elementsRef.current.delete(elemId)
          }

          const attrs: Record<string, unknown> = {
            name: point.label || '',
            size: point.type === 'hole' ? 4 : 3,
            color: point.color || '#3366cc',
            fillColor: point.type === 'hole' ? '#ffffff' : point.color || '#3366cc',
            strokeColor: point.color || '#3366cc',
            fixed: false,
            withLabel: !!point.label,
            visible: point.type !== 'floating_text',
          }

          const el = board.create('point', [point.x, point.y], attrs)
          el.on('drag', () => {
            if (isSyncingRef.current) return
            if (el.X && el.Y) {
              onPointMoved?.(index, Math.round(el.X() * 100) / 100, Math.round(el.Y() * 100) / 100)
            }
          })
          elementsRef.current.set(elemId, el)
        }
      })

      // Sync graphs (function graphs)
      axis.elements.graphs.forEach((graph, index) => {
        const elemId = `graph-${index}`
        newIds.add(elemId)
        const existing = elementsRef.current.get(elemId)
        if (existing) {
          board.removeObject(existing)
          elementsRef.current.delete(elemId)
        }

        try {
          const fn = new Function('x', `return ${graph.fn.replace(/\^/g, '**')}`)
          const dashMap: Record<string, number> = { solid: 0, dashed: 2, dotted: 4 }
          const el = board.create('functiongraph', [fn], {
            strokeColor: graph.color || '#3366cc',
            strokeWidth: graph.thickness || 2,
            dash: dashMap[graph.style] || 0,
          })
          elementsRef.current.set(elemId, el)
        } catch {
          // Invalid function expression - skip rendering
        }
      })

      // Sync asymptotes
      const vertAsym = axis.elements.asymptotesVertical || []
      vertAsym.forEach((xVal, index) => {
        const elemId = `vasym-${index}`
        newIds.add(elemId)
        const existing = elementsRef.current.get(elemId)
        if (existing) {
          board.removeObject(existing)
          elementsRef.current.delete(elemId)
        }
        const el = board.create(
          'line',
          [
            [xVal, 0],
            [xVal, 1],
          ],
          {
            strokeColor: '#999999',
            dash: 3,
            strokeWidth: 1,
            fixed: true,
            straightFirst: true,
            straightLast: true,
          },
        )
        elementsRef.current.set(elemId, el)
      })

      const horizAsym = axis.elements.asymptotesHorizontal || []
      horizAsym.forEach((yVal, index) => {
        const elemId = `hasym-${index}`
        newIds.add(elemId)
        const existing = elementsRef.current.get(elemId)
        if (existing) {
          board.removeObject(existing)
          elementsRef.current.delete(elemId)
        }
        const el = board.create(
          'line',
          [
            [0, yVal],
            [1, yVal],
          ],
          {
            strokeColor: '#999999',
            dash: 3,
            strokeWidth: 1,
            fixed: true,
            straightFirst: true,
            straightLast: true,
          },
        )
        elementsRef.current.set(elemId, el)
      })

      // Sync line segments between points
      const linesBetween = axis.elements.lineBetweenPoints || []
      linesBetween.forEach((line, index) => {
        const elemId = `lbp-${index}`
        newIds.add(elemId)
        const existing = elementsRef.current.get(elemId)
        if (existing) {
          board.removeObject(existing)
          elementsRef.current.delete(elemId)
        }
        const dashMap: Record<string, number> = { solid: 0, dashed: 2, dotted: 4 }
        const el = board.create(
          'segment',
          [
            [line.a.x, line.a.y],
            [line.b.x, line.b.y],
          ],
          {
            strokeColor: line.color || '#000000',
            strokeWidth: line.thickness || 2,
            dash: dashMap[line.style] || 0,
            fixed: true,
          },
        )
        elementsRef.current.set(elemId, el)
      })

      // Remove stale elements
      for (const oldId of existingIds) {
        if (!newIds.has(oldId)) {
          const el = elementsRef.current.get(oldId)
          if (el) {
            board.removeObject(el)
            elementsRef.current.delete(oldId)
          }
        }
      }
    } finally {
      board.unsuspendUpdate()
      isSyncingRef.current = false
    }
  }, [axis, onPointMoved])

  const syncToBoardRef = useRef(syncToBoard)
  syncToBoardRef.current = syncToBoard

  useEffect(() => {
    syncToBoard()
  }, [syncToBoard])

  const handleBoardReady = useCallback((board: JXGBoard) => {
    boardRef.current = board
    elementsRef.current.clear()
    syncToBoardRef.current()
  }, [])

  const bbox = useMemo<[number, number, number, number]>(() => {
    const resolved = resolveViewport(axis)
    return [resolved.xMin, resolved.yMax, resolved.xMax, resolved.yMin]
  }, [axis])

  return (
    <JSXGraphBoard
      id={id}
      width={600}
      height={400}
      boundingBox={bbox}
      showAxis
      showGrid={axis.grid.enabled}
      axisConfig={{
        showNumbers: axis.axes.showNumbers,
        showLabels: axis.axes.showLabels,
        ticks: axis.axes.ticks,
        labels: axis.axes.labels,
        tickPosition: axis.axes.tickPosition ?? { x: 'default', y: 'default' },
      }}
      onBoardReady={handleBoardReady}
    />
  )
}
