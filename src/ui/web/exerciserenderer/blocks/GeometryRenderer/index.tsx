'use client'

import React, { useCallback } from 'react'
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

function calculateBoundingBox(spec: GeometrySpecV1): [number, number, number, number] {
  const points = spec.elements.points
  if (points.length === 0) {
    return [-1, spec.canvas.height + 1, spec.canvas.width + 1, -1]
  }
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const padding = 50
  return [
    Math.min(...xs) - padding,
    Math.max(...ys) + padding,
    Math.max(...xs) + padding,
    Math.min(...ys) - padding,
  ]
}

export function GeometryRenderer({ blockId, spec }: GeometryRendererProps) {
  const handleBoardReady = useCallback(
    (board: JXG.Board) => {
      renderGeometrySpec(board, spec)
    },
    [spec],
  )

  const boundingBox = calculateBoundingBox(spec)

  return (
    <div className="my-4 flex justify-center">
      <JSXGraphBoard
        id={blockId}
        width={spec.canvas.width}
        height={spec.canvas.height}
        boundingBox={boundingBox}
        showGrid={spec.canvas.grid ?? false}
        showAxis={false}
        onBoardReady={handleBoardReady}
        className="border-border"
      />
    </div>
  )
}
