'use client'

import React, { useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import type { AxisSpecV1 } from '@/infra/contracts'
import { renderAxisSpec } from '../../graphics/axisElements'
import { resolveViewport } from '@/infra/utils/graphics/viewport-utils'

const JSXGraphBoard = dynamic(
  () => import('../../graphics/JSXGraphBoard').then((m) => ({ default: m.JSXGraphBoard })),
  {
    ssr: false,
    loading: () => <div className="w-full h-64 bg-muted animate-pulse rounded-lg" />,
  },
)

interface AxisRendererProps {
  blockId: string
  spec: AxisSpecV1
}

export function AxisRenderer({ blockId, spec }: AxisRendererProps) {
  const handleBoardReady = useCallback(
    (board: JXG.Board) => {
      renderAxisSpec(board, spec)
    },
    [spec],
  )

  const boundingBox = useMemo<[number, number, number, number]>(() => {
    const resolved = resolveViewport(spec)
    return [resolved.xMin, resolved.yMax, resolved.xMax, resolved.yMin]
  }, [spec])

  return (
    <div className="my-4 flex justify-center">
      <JSXGraphBoard
        id={blockId}
        width={600}
        height={400}
        boundingBox={boundingBox}
        showGrid={spec.grid.enabled}
        showAxis
        axisConfig={{
          showNumbers: spec.axes.showNumbers,
          showLabels: spec.axes.showLabels,
          ticks: spec.axes.ticks,
          labels: spec.axes.labels,
          tickPosition: spec.axes.tickPosition ?? { x: 'default', y: 'default' },
        }}
        onBoardReady={handleBoardReady}
        className="border-border"
      />
    </div>
  )
}
