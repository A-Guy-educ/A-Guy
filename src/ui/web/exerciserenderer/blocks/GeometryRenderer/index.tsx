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

interface GeometryRendererProps {
  blockId: string
  spec: GeometrySpecV1
}

export function GeometryRenderer({ blockId, spec }: GeometryRendererProps) {
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
    const minWidth = Math.min(canvas.width, 200)
    const minHeight = Math.min(canvas.height, Math.round(minWidth / aspectRatio))

    function updateDimensions() {
      if (!container) return
      const containerWidth = container.clientWidth
      const calculatedHeight = containerWidth / aspectRatio
      const finalWidth = Math.min(containerWidth, canvas.width)
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
  }, [canvas.width, canvas.height])

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
