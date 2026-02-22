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

    const options: JXGBoardOptions = {
      boundingbox: boundingBox,
      axis: showAxis,
      grid: showGrid,
      showNavigation,
      showCopyright: false,
      keepAspectRatio: false,
      pan: { enabled: true },
      zoom: { enabled: true },
    }

    const board = jxgRef.current.JSXGraph.initBoard(containerRef.current, options)
    boardRef.current = board
    onBoardReadyRef.current?.(board)
  }, [loaded, boundingBox, showAxis, showGrid, showNavigation])

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
