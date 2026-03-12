'use client'

import type { GeometrySpecV1 } from '@/infra/contracts/graphics/geometry.v1'
import { DEFAULT_TEXT_COLOR, sizeScaleToPixels } from '@/infra/contracts/graphics/textColors'
import type { JXGBoard, JXGElement } from 'jsxgraph'
import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { JSXGraphBoard } from '../shared/JSXGraphBoard'

interface PointUpdate {
  name: string
  x: number
  y: number
}

interface GeometryCanvasProps {
  id: string
  geometry: GeometrySpecV1
  displayWidth?: number
  displayHeight?: number
  interactionMode?: 'move' | 'addPoint'
  onPointMoved?: (name: string, x: number, y: number) => void
  onMultiPointMoved?: (updates: PointUpdate[]) => void
  onCanvasClick?: (x: number, y: number) => void
  onTextMoved?: (index: number, x: number, y: number) => void
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
  onMultiPointMoved,
  onCanvasClick,
  onTextMoved,
}) => {
  const boardRef = useRef<JXGBoard | null>(null)
  const isSyncingRef = useRef(false)
  const isDraggingRef = useRef(false)
  const elementsRef = useRef<Map<string, JXGElement>>(new Map())
  const modeRef = useRef(interactionMode)
  const onCanvasClickRef = useRef(onCanvasClick)
  const onPointMovedRef = useRef(onPointMoved)
  const onMultiPointMovedRef = useRef(onMultiPointMoved)
  const onTextMovedRef = useRef(onTextMoved)
  modeRef.current = interactionMode
  onCanvasClickRef.current = onCanvasClick
  onPointMovedRef.current = onPointMoved
  onMultiPointMovedRef.current = onMultiPointMoved
  onTextMovedRef.current = onTextMoved

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
      syncLineLabels(board, geometry, newIds, elementsRef)
      syncCircles(board, geometry, newIds, elementsRef)
      syncAngles(board, geometry, newIds, elementsRef)
      syncPolygons(
        board,
        geometry,
        newIds,
        elementsRef,
        isSyncingRef,
        isDraggingRef,
        onMultiPointMovedRef,
      )
      syncTexts(board, geometry, newIds, elementsRef, isSyncingRef, isDraggingRef, onTextMovedRef)

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

    const pointColor = point.color ?? '#000000'
    const pointSize = point.size ?? 4

    if (existing && existing.moveTo) {
      existing.moveTo([point.x, point.y])
      existing.setAttribute({
        visible: point.visible !== false,
        name: point.name,
        fillColor: pointColor,
        strokeColor: pointColor,
        size: pointSize,
      })
    } else {
      if (existing) {
        board.removeObject(existing)
        elementsRef.current.delete(elemId)
      }
      const el = board.create('point', [point.x, point.y], {
        name: point.name,
        size: pointSize,
        fillColor: pointColor,
        strokeColor: pointColor,
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

function syncLineLabels(
  board: JXGBoard,
  geometry: GeometrySpecV1,
  newIds: Set<string>,
  elementsRef: React.MutableRefObject<Map<string, JXGElement>>,
) {
  for (let i = 0; i < geometry.elements.lines.length; i++) {
    const line = geometry.elements.lines[i]
    const elemId = `linelabel-${line.from}-${line.to}`
    if (!line.label?.value) continue
    newIds.add(elemId)
    const fromEl = elementsRef.current.get(`point-${line.from}`)
    const toEl = elementsRef.current.get(`point-${line.to}`)
    if (!fromEl || !toEl) continue

    const existing = elementsRef.current.get(elemId)
    if (existing) {
      board.removeObject(existing)
      elementsRef.current.delete(elemId)
    }

    const f = fromEl as unknown as { X: () => number; Y: () => number }
    const t = toEl as unknown as { X: () => number; Y: () => number }
    const offset = line.label.position === 'b' ? -1.5 : 1.5
    const el = board.create(
      'text',
      [() => (f.X() + t.X()) / 2, () => (f.Y() + t.Y()) / 2 + offset, line.label.value],
      {
        fontSize: line.label.fontSize || 12,
        anchorX: 'middle',
        anchorY: 'middle',
        rotate: () => {
          const dx = t.X() - f.X()
          const dy = t.Y() - f.Y()
          let deg = (Math.atan2(dy, dx) * 180) / Math.PI
          if (deg > 90) deg -= 180
          if (deg < -90) deg += 180
          return deg
        },
        fixed: true,
      },
    )
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

function syncAngles(
  board: JXGBoard,
  geometry: GeometrySpecV1,
  newIds: Set<string>,
  elementsRef: React.MutableRefObject<Map<string, JXGElement>>,
) {
  for (let i = 0; i < geometry.elements.angles.length; i++) {
    const angle = geometry.elements.angles[i]
    const elemId = `angle-${angle.ray1}-${angle.center}-${angle.ray2}`
    newIds.add(elemId)

    const ray1El = elementsRef.current.get(`point-${angle.ray1}`)
    const centerEl = elementsRef.current.get(`point-${angle.center}`)
    const ray2El = elementsRef.current.get(`point-${angle.ray2}`)
    if (!ray1El || !centerEl || !ray2El) continue

    const existing = elementsRef.current.get(elemId)
    if (existing) {
      existing.setAttribute({
        strokeColor: angle.color || '#3366cc',
        fillColor: angle.color || '#3366cc',
        radius: angle.arcRadius || 30,
      })
      continue
    }

    const isSquare = angle.style === 'square'
    const el = board.create('angle', [ray1El, centerEl, ray2El], {
      radius: angle.arcRadius || 30,
      orthoType: isSquare ? 'square' : 'sector',
      strokeColor: angle.color || '#3366cc',
      fillColor: angle.color || '#3366cc',
      fillOpacity: 0.15,
      strokeWidth: 2,
      fixed: true,
      withLabel: !!angle.label?.value,
      name: angle.label?.value || '',
      label: angle.label ? { fontSize: angle.label.fontSize || 12 } : undefined,
    })
    elementsRef.current.set(elemId, el)
  }
}

function syncPolygons(
  board: JXGBoard,
  geometry: GeometrySpecV1,
  newIds: Set<string>,
  elementsRef: React.MutableRefObject<Map<string, JXGElement>>,
  isSyncingRef: React.MutableRefObject<boolean>,
  isDraggingRef: React.MutableRefObject<boolean>,
  onMultiPointMovedRef: React.RefObject<((updates: PointUpdate[]) => void) | undefined>,
) {
  const triangles = geometry.elements.triangles || []
  for (let i = 0; i < triangles.length; i++) {
    const tri = triangles[i]
    const elemId = `triangle-${tri.points.join('-')}`
    newIds.add(elemId)
    if (elementsRef.current.has(elemId)) continue
    const ptEls = tri.points.map((name) => elementsRef.current.get(`point-${name}`)).filter(Boolean)
    if (ptEls.length < 3) continue
    const el = board.create('polygon', ptEls, {
      borders: { strokeColor: tri.color || '#000000', strokeWidth: tri.thickness || 2 },
      fillColor: tri.fill || 'transparent',
      fillOpacity: tri.fill ? 0.3 : 0,
      hasInnerPoints: true,
    })
    addPolygonDragHandlers(el, tri.points, isSyncingRef, isDraggingRef, onMultiPointMovedRef)
    elementsRef.current.set(elemId, el)
  }

  const rectangles = geometry.elements.rectangles || []
  for (let i = 0; i < rectangles.length; i++) {
    const rect = rectangles[i]
    const elemId = `rectangle-${rect.points.join('-')}`
    newIds.add(elemId)
    if (elementsRef.current.has(elemId)) continue
    const ptEls = rect.points
      .map((name) => elementsRef.current.get(`point-${name}`))
      .filter(Boolean)
    if (ptEls.length < 4) continue
    const el = board.create('polygon', ptEls, {
      borders: { strokeColor: rect.color || '#000000', strokeWidth: rect.thickness || 2 },
      fillColor: rect.fill || 'transparent',
      fillOpacity: rect.fill ? 0.3 : 0,
      hasInnerPoints: true,
    })
    addPolygonDragHandlers(el, rect.points, isSyncingRef, isDraggingRef, onMultiPointMovedRef)
    elementsRef.current.set(elemId, el)
  }
}

function addPolygonDragHandlers(
  polygon: JXGElement,
  pointNames: string[],
  isSyncingRef: React.MutableRefObject<boolean>,
  isDraggingRef: React.MutableRefObject<boolean>,
  onMultiPointMovedRef: React.RefObject<((updates: PointUpdate[]) => void) | undefined>,
) {
  const poly = polygon as unknown as { vertices: Array<{ X: () => number; Y: () => number }> }
  polygon.on('drag', () => {
    if (isSyncingRef.current) return
    isDraggingRef.current = true
    if (!poly.vertices) return
    const updates: PointUpdate[] = pointNames.map((name, idx) => ({
      name,
      x: round1(poly.vertices[idx].X()),
      y: round1(poly.vertices[idx].Y()),
    }))
    onMultiPointMovedRef.current?.(updates)
  })
  polygon.on('up', () => {
    isDraggingRef.current = false
  })
}

function syncTexts(
  board: JXGBoard,
  geometry: GeometrySpecV1,
  newIds: Set<string>,
  elementsRef: React.MutableRefObject<Map<string, JXGElement>>,
  isSyncingRef: React.MutableRefObject<boolean>,
  isDraggingRef: React.MutableRefObject<boolean>,
  onTextMovedRef: React.RefObject<((index: number, x: number, y: number) => void) | undefined>,
) {
  const texts = geometry.elements.texts || []
  for (let i = 0; i < texts.length; i++) {
    const text = texts[i]
    const elemId = `text-${i}`
    newIds.add(elemId)

    let x = text.place?.x ?? 0
    let y = text.place?.y ?? 0

    if (text.on?.from && text.on?.to) {
      const fromEl = elementsRef.current.get(`point-${text.on.from}`)
      const toEl = elementsRef.current.get(`point-${text.on.to}`)
      if (fromEl && toEl) {
        const f = fromEl as unknown as { X: () => number; Y: () => number }
        const t = toEl as unknown as { X: () => number; Y: () => number }
        x = (f.X() + t.X()) / 2
        y = (f.Y() + t.Y()) / 2
      }
    }

    // Always remove and recreate — JSXGraph text elements don't support moveTo or
    // reliable in-place attribute updates. This matches the syncLineLabels pattern.
    const existing = elementsRef.current.get(elemId)
    if (existing) {
      board.removeObject(existing)
      elementsRef.current.delete(elemId)
    }

    const color = text.color ?? DEFAULT_TEXT_COLOR
    const fontSize =
      text.sizeScale !== undefined ? sizeScaleToPixels(text.sizeScale) : (text.fontSize ?? 14)

    const el = board.create('text', [x, y, text.value], {
      fontSize,
      strokeColor: color,
      color,
      anchorX: 'middle',
      anchorY: 'middle',
      fixed: false,
      highlight: true,
    })

    el.on('drag', () => {
      if (isSyncingRef.current) return
      isDraggingRef.current = true
      const textEl = el as unknown as { X: () => number; Y: () => number }
      onTextMovedRef.current?.(i, round1(textEl.X()), round1(textEl.Y()))
    })
    el.on('up', () => {
      isDraggingRef.current = false
    })
    elementsRef.current.set(elemId, el)
  }
}
