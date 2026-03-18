'use client'

import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react'
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

// Display size to percentage mapping
const SIZE_MAP = {
  small: 0.33,
  medium: 0.5,
  large: 0.75,
  full: 1,
} as const

export type DisplaySize = 'small' | 'medium' | 'large' | 'full'

interface AxisRendererProps {
  blockId: string
  spec: AxisSpecV1
  displaySize?: DisplaySize
}

export function AxisRenderer({ blockId, spec, displaySize = 'full' }: AxisRendererProps) {
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

  // Container ref for responsive sizing
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Calculate max available width based on displaySize percentage
    const percentage = SIZE_MAP[displaySize]
    const availableWidth = container.clientWidth * percentage

    // Calculate height maintaining 3:2 aspect ratio (600x400)
    const aspectRatio = 400 / 600 // 2:3
    const calculatedHeight = availableWidth * aspectRatio

    // Use the smaller of calculated size or max size (600x400)
    const finalWidth = Math.min(availableWidth, 600)
    const finalHeight = Math.min(calculatedHeight, 400)

    setDimensions({
      width: Math.max(finalWidth, 200), // Minimum width
      height: Math.max(finalHeight, 133), // Minimum height
    })

    // Listen for resize
    const resizeObserver = new ResizeObserver(() => {
      const newAvailableWidth = container.clientWidth * percentage
      const newCalculatedHeight = newAvailableWidth * aspectRatio
      const newFinalWidth = Math.min(newAvailableWidth, 600)
      const newFinalHeight = Math.min(newCalculatedHeight, 400)

      setDimensions({
        width: Math.max(newFinalWidth, 200),
        height: Math.max(newFinalHeight, 133),
      })
    })

    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [displaySize])

  // Determine container width style based on displaySize
  const containerWidth = displaySize === 'full' ? 'w-full' : ''

  return (
    <div className={`my-4 flex justify-center ${containerWidth}`} ref={containerRef}>
      <JSXGraphBoard
        id={blockId}
        width={dimensions.width}
        height={dimensions.height}
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
