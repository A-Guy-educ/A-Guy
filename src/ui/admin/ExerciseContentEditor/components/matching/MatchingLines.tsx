'use client'

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { MatchingOption, MatchingPair } from '@/server/payload/collections/Exercises/types'

interface MatchingLinesProps {
  leftColumn: MatchingOption[]
  rightColumn: MatchingOption[]
  correctPairs: MatchingPair[]
  onChange: (pairs: MatchingPair[]) => void
}

interface DotPosition {
  id: string
  x: number
  y: number
}

export const MatchingLines: React.FC<MatchingLinesProps> = ({
  leftColumn,
  rightColumn,
  correctPairs,
  onChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const leftDotsRef = useRef<Map<string, HTMLDivElement>>(new Map())
  const rightDotsRef = useRef<Map<string, HTMLDivElement>>(new Map())
  const [leftPositions, setLeftPositions] = useState<DotPosition[]>([])
  const [rightPositions, setRightPositions] = useState<DotPosition[]>([])
  const [pendingLeft, setPendingLeft] = useState<string | null>(null)

  const measurePositions = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()

    const newLeft: DotPosition[] = []
    leftDotsRef.current.forEach((el, id) => {
      const dotRect = el.getBoundingClientRect()
      newLeft.push({ id, x: dotRect.left - rect.left + 6, y: dotRect.top - rect.top + 6 })
    })

    const newRight: DotPosition[] = []
    rightDotsRef.current.forEach((el, id) => {
      const dotRect = el.getBoundingClientRect()
      newRight.push({ id, x: dotRect.left - rect.left + 6, y: dotRect.top - rect.top + 6 })
    })

    setLeftPositions(newLeft)
    setRightPositions(newRight)
  }, [])

  useLayoutEffect(() => {
    measurePositions()
  }, [leftColumn, rightColumn, measurePositions])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(measurePositions)
    observer.observe(container)
    return () => observer.disconnect()
  }, [measurePositions])

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPendingLeft(null)
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [])

  const handleLeftClick = (optionId: string) => {
    const existingPair = correctPairs.find((p) => p.optionId === optionId)
    if (existingPair) {
      onChange(correctPairs.filter((p) => p.optionId !== optionId))
      setPendingLeft(null)
      return
    }
    setPendingLeft(optionId)
  }

  const handleRightClick = (matchId: string) => {
    if (!pendingLeft) return
    const filtered = correctPairs.filter((p) => p.optionId !== pendingLeft && p.matchId !== matchId)
    onChange([...filtered, { optionId: pendingLeft, matchId }])
    setPendingLeft(null)
  }

  const handleLineClick = (pair: MatchingPair) => {
    onChange(correctPairs.filter((p) => p !== pair))
  }

  const getLeftPos = (id: string) => leftPositions.find((p) => p.id === id)
  const getRightPos = (id: string) => rightPositions.find((p) => p.id === id)
  const isPaired = (side: 'left' | 'right', id: string) =>
    correctPairs.some((p) => (side === 'left' ? p.optionId === id : p.matchId === id))

  const setLeftDotRef = (id: string) => (el: HTMLDivElement | null) => {
    if (el) leftDotsRef.current.set(id, el)
    else leftDotsRef.current.delete(id)
  }

  const setRightDotRef = (id: string) => (el: HTMLDivElement | null) => {
    if (el) rightDotsRef.current.set(id, el)
    else rightDotsRef.current.delete(id)
  }

  return (
    <div
      className="matching-lines-container"
      ref={containerRef}
      onClick={() => setPendingLeft(null)}
    >
      <div className="matching-lines-column matching-lines-column--left">
        {leftColumn.map((opt) => (
          <div key={opt.id} className="matching-lines-item">
            <span className="matching-lines-item-text">{opt.content.value || '(empty)'}</span>
            <div
              ref={setLeftDotRef(opt.id)}
              className={`matching-connector-dot${isPaired('left', opt.id) ? ' matching-connector-dot--paired' : ''}${pendingLeft === opt.id ? ' matching-connector-dot--pending' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                handleLeftClick(opt.id)
              }}
            />
          </div>
        ))}
      </div>

      <div className="matching-lines-gap" />

      <div className="matching-lines-column matching-lines-column--right">
        {rightColumn.map((opt) => (
          <div key={opt.id} className="matching-lines-item">
            <div
              ref={setRightDotRef(opt.id)}
              className={`matching-connector-dot${isPaired('right', opt.id) ? ' matching-connector-dot--paired' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                handleRightClick(opt.id)
              }}
            />
            <span className="matching-lines-item-text">{opt.content.value || '(empty)'}</span>
          </div>
        ))}
      </div>

      <svg className="matching-lines-svg">
        {correctPairs.map((pair) => {
          const from = getLeftPos(pair.optionId)
          const to = getRightPos(pair.matchId)
          if (!from || !to) return null
          const midX = (from.x + to.x) / 2
          return (
            <path
              key={`${pair.optionId}-${pair.matchId}`}
              className="matching-line"
              d={`M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`}
              onClick={(e) => {
                e.stopPropagation()
                handleLineClick(pair)
              }}
            />
          )
        })}
      </svg>
    </div>
  )
}
