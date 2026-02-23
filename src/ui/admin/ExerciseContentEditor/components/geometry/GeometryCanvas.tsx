'use client'

import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import type { GeometrySpecV1 } from '@/infra/contracts/graphics/geometry.v1'
import type { JXGBoard, JXGElement } from 'jsxgraph'
import { JSXGraphBoard } from '../shared/JSXGraphBoard'

interface GeometryCanvasProps {
  id: string
  geometry: GeometrySpecV1
  displayWidth?: number
  displayHeight?: number
  interactionMode?: 'move' | 'addPoint'
  onPointMoved?: (name: string, x: number, y: number) => void
  onCanvasClick?: (x: number, y: number) => void
}

const DISPLAY_WIDTH = 420
const DISPLAY_HEIGHT = 320

const round1 = (n: number) => Math.round(n * 10) / 10

export const GeometryCanvas: React.FC<GeometryCanvasProps> = ({
  id,
  geometry,
  displayWidth = DISPLAY_WIDTH,
  displayHeight = DISPLAY_HEIGHT,
  interactionMode = 'move',
  onPointMoved,
  onCanvasClick,
}) => {
  const boardRef = useRef<JXGBoard | null>(null)
  const isSyncingRef = useRef(false)
  const isDraggingRef = useRef(false)
  const elementsRef = useRef<Map<string, JXGElement>>(new Map())
  const modeRef = useRef(interactionMode)
  const onCanvasClickRef = useRef(onCanvasClick)
  const onPointMovedRef = useRef(onPointMoved)
  modeRef.current = interactionMode
  onCanvasClickRef.current = onCanvasClick
  onPointMovedRef.current = onPointMoved

  const syncToBoard = useCallback(() => {
    const board = boardRef.current
    if (!board || isDraggingRef.current) return

    isSyncingRef.current = true
    board.suspendUpdate()

    try {
      const existingIds = new Set(elementsRef.current.keys())
      const newIds = new Set<string>()

      syncPoints(board, geometry, newIds, elementsRef, isSyncingRef, isDraggingRef, onPointMovedRef)
      syncSegments(board, geometry, newIds, elementsRef)
      syncCircles(board, geometry, newIds, elementsRef)
      syncPolygons(board, geometry, newIds, elementsRef)

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
  }, [geometry])

  const syncToBoardRef = useRef(syncToBoard)
  syncToBoardRef.current = syncToBoard

  useEffect(() => {
    syncToBoard()
  }, [syncToBoard])

  const handleBoardReady = useCallback((board: JXGBoard) => {
    boardRef.current = board
    elementsRef.current.clear()
    syncToBoardRef.current()
    const b = board as unknown as Record<string, (...args: unknown[]) => unknown>
    b.on('down', (e: unknown) => {
      if (modeRef.current !== 'addPoint') return
      const coords = b.getUsrCoordsOfMouse(e) as number[]
      const x = coords.length > 2 ? coords[1] : coords[0]
      const y = coords.length > 2 ? coords[2] : coords[1]
      if (typeof x === 'number' && typeof y === 'number' && !isNaN(x) && !isNaN(y)) {
        onCanvasClickRef.current?.(round1(x), round1(y))
      }
    })
  }, [])

  const { canvas } = geometry
  const bbox = useMemo<[number, number, number, number]>(
    () => [0, canvas.height, canvas.width, 0],
    [canvas.width, canvas.height],
  )

  return (
    <div
      className={`geo-canvas-wrap geo-canvas-wrap--${interactionMode}`}
      style={{ background: canvas.background || '#ffffff' }}
    >
      <JSXGraphBoard
        id={id}
        width={displayWidth}
        height={displayHeight}
        boundingBox={bbox}
        showGrid={canvas.grid ?? false}
        onBoardReady={handleBoardReady}
      />
    </div>
  )
}

function syncPoints(
  board: JXGBoard,
  geometry: GeometrySpecV1,
  newIds: Set<string>,
  elementsRef: React.MutableRefObject<Map<string, JXGElement>>,
  isSyncingRef: React.MutableRefObject<boolean>,
  isDraggingRef: React.MutableRefObject<boolean>,
  onPointMovedRef: React.RefObject<((name: string, x: number, y: number) => void) | undefined>,
) {
  for (const point of geometry.elements.points) {
    const elemId = `point-${point.name}`
    newIds.add(elemId)
    const existing = elementsRef.current.get(elemId)

    if (existing && existing.moveTo) {
      existing.moveTo([point.x, point.y])
      existing.setAttribute({ visible: point.visible !== false, name: point.name })
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
        isDraggingRef.current = true
        if (el.X && el.Y) onPointMovedRef.current?.(point.name, round1(el.X()), round1(el.Y()))
      })
      el.on('up', () => {
        isDraggingRef.current = false
      })
      elementsRef.current.set(elemId, el)
    }
  }
}

function syncSegments(
  board: JXGBoard,
  geometry: GeometrySpecV1,
  newIds: Set<string>,
  elementsRef: React.MutableRefObject<Map<string, JXGElement>>,
) {
  for (let i = 0; i < geometry.elements.lines.length; i++) {
    const line = geometry.elements.lines[i]
    const elemId = `line-${line.from}-${line.to}`
    newIds.add(elemId)
    const fromEl = elementsRef.current.get(`point-${line.from}`)
    const toEl = elementsRef.current.get(`point-${line.to}`)
    if (!fromEl || !toEl) continue

    const existing = elementsRef.current.get(elemId)
    if (existing) {
      existing.setAttribute({
        strokeColor: line.color || '#000000',
        strokeWidth: line.thickness || 2,
        dash: line.style === 'dashed' ? 2 : 0,
      })
      continue
    }
    const el = board.create('segment', [fromEl, toEl], {
      strokeColor: line.color || '#000000',
      strokeWidth: line.thickness || 2,
      dash: line.style === 'dashed' ? 2 : 0,
      fixed: true,
    })
    elementsRef.current.set(elemId, el)
  }
}

function syncCircles(
  board: JXGBoard,
  geometry: GeometrySpecV1,
  newIds: Set<string>,
  elementsRef: React.MutableRefObject<Map<string, JXGElement>>,
) {
  for (let i = 0; i < geometry.elements.circles.length; i++) {
    const circle = geometry.elements.circles[i]
    const key = circle.through
      ? `${circle.center}-${circle.through}`
      : `${circle.center}-r${circle.radius}`
    const elemId = `circle-${key}`
    newIds.add(elemId)
    const centerEl = elementsRef.current.get(`point-${circle.center}`)
    if (!centerEl) continue

    const existing = elementsRef.current.get(elemId)
    if (existing) {
      existing.setAttribute({
        strokeColor: circle.color || '#000000',
        dash: circle.style === 'dashed' ? 2 : 0,
      })
      continue
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
}

function syncPolygons(
  board: JXGBoard,
  geometry: GeometrySpecV1,
  newIds: Set<string>,
  elementsRef: React.MutableRefObject<Map<string, JXGElement>>,
) {
  const triangles = geometry.elements.triangles || []
  for (let i = 0; i < triangles.length; i++) {
    const tri = triangles[i]
    const elemId = `triangle-${i}`
    newIds.add(elemId)
    if (elementsRef.current.has(elemId)) continue
    const pts = tri.points.map((name) => elementsRef.current.get(`point-${name}`)).filter(Boolean)
    if (pts.length < 3) continue
    const el = board.create('polygon', pts, {
      borders: { strokeColor: tri.color || '#000000', strokeWidth: tri.thickness || 2 },
      fillColor: tri.fill || 'transparent',
      fillOpacity: tri.fill ? 0.3 : 0,
      fixed: true,
      hasInnerPoints: false,
    })
    elementsRef.current.set(elemId, el)
  }

  const rectangles = geometry.elements.rectangles || []
  for (let i = 0; i < rectangles.length; i++) {
    const rect = rectangles[i]
    const elemId = `rectangle-${i}`
    newIds.add(elemId)
    if (elementsRef.current.has(elemId)) continue
    const pts = rect.points.map((name) => elementsRef.current.get(`point-${name}`)).filter(Boolean)
    if (pts.length < 4) continue
    const el = board.create('polygon', pts, {
      borders: { strokeColor: rect.color || '#000000', strokeWidth: rect.thickness || 2 },
      fillColor: rect.fill || 'transparent',
      fillOpacity: rect.fill ? 0.3 : 0,
      fixed: true,
      hasInnerPoints: false,
    })
    elementsRef.current.set(elemId, el)
  }
}
