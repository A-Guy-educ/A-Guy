'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import type { GeometrySpecV1 } from '@/infra/contracts'
import { renderGeometrySpec } from '../../graphics/geometryElements'

const JSXGraphBoard = dynamic(
  () => import('../../graphics/JSXGraphBoard').then((m) => ({ default: m.JSXGraphBoard })),
  {
    ssr: false,
    loading: () => <div className="w-full h-64 bg-muted animate-pulse rounded-lg" />,
  },
)

// Display size to percentage mapping (same as AxisRenderer)
const SIZE_MAP = {
  small: 0.33,
  medium: 0.5,
  large: 0.75,
  full: 1,
} as const

export type DisplaySize = 'small' | 'medium' | 'large' | 'full'

interface GeometryRendererProps {
  blockId: string
  spec: GeometrySpecV1
  displaySize?: DisplaySize
}

export function GeometryRenderer({ blockId, spec, displaySize = 'full' }: GeometryRendererProps) {
  const handleBoardReady = useCallback(
    (board: JXG.Board) => {
      renderGeometrySpec(board, spec)
    },
    [spec],
  )

  const { canvas } = spec
  const boundingBox = useMemo<[number, number, number, number]>(
    () => canvas.boundingBox ?? [0, canvas.height, canvas.width, 0],
    [canvas.boundingBox, canvas.width, canvas.height],
  )

  // Responsive sizing via ResizeObserver — follow AxisRenderer pattern
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: canvas.width, height: canvas.height })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const aspectRatio = canvas.width / canvas.height
    const percentage = SIZE_MAP[displaySize]
    const minWidth = Math.min(canvas.width * percentage, 200)
    const minHeight = Math.min(canvas.height * percentage, Math.round(minWidth / aspectRatio))

    function updateDimensions() {
      if (!container) return
      const containerWidth = container.clientWidth
      const availableWidth = containerWidth * percentage
      const calculatedHeight = availableWidth / aspectRatio
      const finalWidth = Math.min(availableWidth, canvas.width)
      const finalHeight = Math.min(calculatedHeight, canvas.height)
      setDimensions({
        width: Math.max(finalWidth, minWidth),
        height: Math.max(finalHeight, minHeight),
      })
    }

    updateDimensions()

    const resizeObserver = new ResizeObserver(() => {
      updateDimensions()
    })
    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [canvas.width, canvas.height, displaySize])

  return (
    <div className="my-4 flex justify-center" ref={containerRef}>
      <JSXGraphBoard
        id={blockId}
        width={dimensions.width}
        height={dimensions.height}
        boundingBox={boundingBox}
        showGrid={canvas.grid ?? false}
        showAxis={canvas.axis ?? false}
        onBoardReady={handleBoardReady}
        className="border-border"
      />
    </div>
  )
}
