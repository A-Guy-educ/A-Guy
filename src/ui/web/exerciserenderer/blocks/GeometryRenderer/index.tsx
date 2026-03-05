'use client'

import React, { useCallback, useMemo } from 'react'
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
    () => [0, canvas.height, canvas.width, 0],
    [canvas.width, canvas.height],
  )

  return (
    <div className="my-4 flex justify-center">
      <JSXGraphBoard
        id={blockId}
        width={canvas.width}
        height={canvas.height}
        boundingBox={boundingBox}
        showGrid={canvas.grid ?? false}
        showAxis={false}
        onBoardReady={handleBoardReady}
        className="border-border"
      />
    </div>
  )
}
