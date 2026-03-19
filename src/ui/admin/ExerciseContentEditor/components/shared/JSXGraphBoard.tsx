'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { JXGBoard, JXGBoardOptions } from 'jsxgraph'

interface JSXGraphBoardProps {
  id: string
  width?: number
  height?: number
  boundingBox: [number, number, number, number]
  showAxis?: boolean
  showGrid?: boolean
  showNavigation?: boolean
  axisConfig?: {
    showNumbers?: boolean
    showLabels?: boolean
    ticks?: number
    labels?: { x: string; y: string }
    tickPosition?: { x: 'default' | 'inverted'; y: 'default' | 'inverted' }
  }
  onBoardReady?: (board: JXGBoard) => void
}

export const JSXGraphBoard: React.FC<JSXGraphBoardProps> = ({
  id,
  width = 600,
  height = 400,
  boundingBox,
  showAxis = false,
  showGrid = false,
  showNavigation = false,
  axisConfig,
  onBoardReady,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<JXGBoard | null>(null)
  const [loaded, setLoaded] = useState(false)
  const jxgRef = useRef<typeof import('jsxgraph').default | null>(null)
  const onBoardReadyRef = useRef(onBoardReady)
  onBoardReadyRef.current = onBoardReady

  useEffect(() => {
    let cancelled = false
    import('jsxgraph').then((mod) => {
      if (cancelled) return
      jxgRef.current = mod.default
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const initBoard = useCallback(() => {
    if (!loaded || !containerRef.current || !jxgRef.current) return
    if (boardRef.current) {
      jxgRef.current.JSXGraph.freeBoard(boardRef.current)
      boardRef.current = null
    }

    // Build axis options - use defaultAxes when axisConfig is provided
    const axisOpts =
      showAxis && axisConfig
        ? {
            axis: true,
            defaultAxes: {
              x: {
                ticks: {
                  visible: axisConfig.showNumbers ?? true,
                  ticksDistance: axisConfig.ticks ?? 1,
                  label: {
                    // Invert tick position: -10 (above) for default, 10 (below) for inverted
                    offset: [0, axisConfig.tickPosition?.x === 'inverted' ? 10 : -10] as [
                      number,
                      number,
                    ],
                  },
                },
                name: axisConfig.labels?.x ?? 'x',
                withLabel: axisConfig.showLabels ?? true,
                // Standardized title position: far right, slightly below
                label: { position: 'rt', offset: [0, 12] as [number, number] },
              },
              y: {
                ticks: {
                  visible: axisConfig.showNumbers ?? true,
                  ticksDistance: axisConfig.ticks ?? 1,
                  label: {
                    // Invert tick position: -10 (left) for default, 10 (right) for inverted
                    offset: [axisConfig.tickPosition?.y === 'inverted' ? 10 : -10, 0] as [
                      number,
                      number,
                    ],
                  },
                },
                name: axisConfig.labels?.y ?? 'y',
                withLabel: axisConfig.showLabels ?? true,
                // Standardized title position: near top, slightly to right
                label: { position: 'rt', offset: [15, 0] as [number, number] },
              },
            },
          }
        : showAxis
          ? { axis: true }
          : { axis: false }

    const options: JXGBoardOptions = {
      boundingbox: boundingBox,
      grid: showGrid,
      showNavigation,
      showCopyright: false,
      keepAspectRatio: false,
      pan: { enabled: true },
      zoom: { enabled: true },
      ...axisOpts,
    }

    const board = jxgRef.current.JSXGraph.initBoard(containerRef.current, options)
    boardRef.current = board
    onBoardReadyRef.current?.(board)
  }, [loaded, boundingBox, showAxis, showGrid, showNavigation, axisConfig])

  useEffect(() => {
    initBoard()
  }, [initBoard])

  useEffect(() => {
    return () => {
      if (boardRef.current && jxgRef.current) {
        jxgRef.current.JSXGraph.freeBoard(boardRef.current)
        boardRef.current = null
      }
    }
  }, [])

  return (
    <div className="jsxgraph-board-container">
      <div ref={containerRef} id={id} className="jsxgraph-board" style={{ width, height }} />
      {!loaded && <div className="jsxgraph-board-loading">Loading canvas...</div>}
    </div>
  )
}
