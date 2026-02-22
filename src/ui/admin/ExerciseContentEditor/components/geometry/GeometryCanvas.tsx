'use client'

import React, { useCallback, useEffect, useRef } from 'react'
import type { GeometrySpecV1 } from '@/infra/contracts/graphics/geometry.v1'
import type { JXGBoard, JXGElement } from 'jsxgraph'
import { JSXGraphBoard } from '../shared/JSXGraphBoard'

interface GeometryCanvasProps {
  id: string
  geometry: GeometrySpecV1
  onPointMoved?: (name: string, x: number, y: number) => void
}

export const GeometryCanvas: React.FC<GeometryCanvasProps> = ({ id, geometry, onPointMoved }) => {
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
      for (const point of geometry.elements.points) {
        const elemId = `point-${point.name}`
        newIds.add(elemId)
        const existing = elementsRef.current.get(elemId)

        if (existing && existing.moveTo) {
          existing.moveTo([point.x, point.y])
          existing.setAttribute({
            visible: point.visible !== false,
            name: point.name,
          })
        } else {
          if (existing) {
            board.removeObject(existing)
            elementsRef.current.delete(elemId)
          }
          const el = board.create('point', [point.x, point.y], {
            name: point.name,
            size: 4,
            visible: point.visible !== false,
            withLabel: true,
            label: { fontSize: point.fontSize || 14 },
          })
          el.on('drag', () => {
            if (isSyncingRef.current) return
            if (el.X && el.Y) {
              onPointMoved?.(point.name, Math.round(el.X()), Math.round(el.Y()))
            }
          })
          elementsRef.current.set(elemId, el)
        }
      }

      // Sync lines
      for (let i = 0; i < geometry.elements.lines.length; i++) {
        const line = geometry.elements.lines[i]
        const elemId = `line-${i}`
        newIds.add(elemId)
        const fromEl = elementsRef.current.get(`point-${line.from}`)
        const toEl = elementsRef.current.get(`point-${line.to}`)
        if (!fromEl || !toEl) continue

        const existing = elementsRef.current.get(elemId)
        if (existing) {
          board.removeObject(existing)
          elementsRef.current.delete(elemId)
        }
        const el = board.create('segment', [fromEl, toEl], {
          strokeColor: line.color || '#000000',
          strokeWidth: line.thickness || 2,
          dash: line.style === 'dashed' ? 2 : 0,
          fixed: true,
        })
        elementsRef.current.set(elemId, el)
      }

      // Sync circles
      for (let i = 0; i < geometry.elements.circles.length; i++) {
        const circle = geometry.elements.circles[i]
        const elemId = `circle-${i}`
        newIds.add(elemId)
        const centerEl = elementsRef.current.get(`point-${circle.center}`)
        if (!centerEl) continue

        const existing = elementsRef.current.get(elemId)
        if (existing) {
          board.removeObject(existing)
          elementsRef.current.delete(elemId)
        }

        const parents: unknown[] = circle.through
          ? [centerEl, elementsRef.current.get(`point-${circle.through}`) || centerEl]
          : [centerEl, circle.radius || 50]

        const el = board.create('circle', parents, {
          strokeColor: circle.color || '#000000',
          dash: circle.style === 'dashed' ? 2 : 0,
          fixed: true,
        })
        elementsRef.current.set(elemId, el)
      }

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
  }, [geometry, onPointMoved])

  useEffect(() => {
    syncToBoard()
  }, [syncToBoard])

  const handleBoardReady = useCallback(
    (board: JXGBoard) => {
      boardRef.current = board
      elementsRef.current.clear()
      syncToBoard()
    },
    [syncToBoard],
  )

  const { canvas } = geometry
  const bbox: [number, number, number, number] = [0, canvas.height, canvas.width, 0]

  return (
    <GeometryCanvasInner
      id={id}
      width={canvas.width}
      height={canvas.height}
      boundingBox={bbox}
      showGrid={canvas.grid ?? false}
      onBoardReady={handleBoardReady}
    />
  )
}

const GeometryCanvasInner: React.FC<{
  id: string
  width: number
  height: number
  boundingBox: [number, number, number, number]
  showGrid: boolean
  onBoardReady: (board: JXGBoard) => void
}> = ({ id, width, height, boundingBox, showGrid, onBoardReady }) => (
  <JSXGraphBoard
    id={id}
    width={width}
    height={height}
    boundingBox={boundingBox}
    showGrid={showGrid}
    onBoardReady={onBoardReady}
  />
)
