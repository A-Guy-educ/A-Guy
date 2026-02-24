'use client'

import React, { useEffect, useRef } from 'react'
import { cn } from '@/infra/utils/ui'

interface JSXGraphBoardProps {
  id: string
  width: number
  height: number
  boundingBox?: [number, number, number, number]
  showGrid?: boolean
  showAxis?: boolean
  axisConfig?: {
    showNumbers?: boolean
    showLabels?: boolean
    ticks?: number
    labels?: { x: string; y: string }
  }
  onBoardReady: (board: JXG.Board) => void
  className?: string
}

export function JSXGraphBoard({
  id,
  width,
  height,
  boundingBox = [-10, 10, 10, -10],
  showGrid = false,
  showAxis = false,
  axisConfig,
  onBoardReady,
  className,
}: JSXGraphBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<JXG.Board | null>(null)
  const jxgRef = useRef<typeof JXG | null>(null)

  useEffect(() => {
    let destroyed = false

    async function init() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod = (await import('jsxgraph')) as any
      const JXGLib = mod.default || mod
      if (destroyed || !containerRef.current) return

      jxgRef.current = JXGLib
      const containerId = `jsxgraph-${id}`

      const axisOpts = showAxis
        ? {
            axis: true,
            defaultAxes: {
              x: {
                ticks: {
                  visible: axisConfig?.showNumbers ?? true,
                  ticksDistance: axisConfig?.ticks ?? 1,
                },
                name: axisConfig?.labels?.x ?? 'x',
                withLabel: axisConfig?.showLabels ?? true,
              },
              y: {
                ticks: {
                  visible: axisConfig?.showNumbers ?? true,
                  ticksDistance: axisConfig?.ticks ?? 1,
                },
                name: axisConfig?.labels?.y ?? 'y',
                withLabel: axisConfig?.showLabels ?? true,
              },
            },
          }
        : { axis: false }

      const board = JXGLib.JSXGraph.initBoard(containerId, {
        boundingbox: boundingBox,
        ...axisOpts,
        grid: showGrid,
        showNavigation: false,
        showCopyright: false,
        keepAspectRatio: false,
        pan: { needShift: true },
        zoom: { factorX: 1, factorY: 1 },
      } as JXG.BoardAttributes)

      boardRef.current = board
      onBoardReady(board)
    }

    init()

    return () => {
      destroyed = true
      if (boardRef.current && jxgRef.current) {
        try {
          jxgRef.current.JSXGraph.freeBoard(boardRef.current)
        } catch {
          /* ignore cleanup errors */
        }
        boardRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  return (
    <div
      ref={containerRef}
      id={`jsxgraph-${id}`}
      className={cn('w-full border rounded-lg overflow-hidden bg-white', className)}
      style={{ width, height, maxWidth: '100%' }}
    />
  )
}
