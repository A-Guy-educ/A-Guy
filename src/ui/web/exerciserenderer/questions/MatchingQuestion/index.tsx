'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/infra/utils/ui'
import { AlertCircle } from 'lucide-react'
import type {
  QuestionMatchingBlock,
  UserAnswer,
  CheckResult,
  RichTextBlock,
  MatchingOption,
} from '../../types'
import { RichTextRenderer } from '../../blocks/RichTextRenderer'

interface MatchingQuestionProps {
  question: QuestionMatchingBlock
  answer: UserAnswer
  onChange: (answer: UserAnswer) => void
  disabled: boolean
  checkResult: CheckResult | null
  t: (key: string) => string
}

const CONNECTION_COLORS = [
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#f97316',
  '#14b8a6',
  '#f59e0b',
  '#6366f1',
  '#06b6d4',
]

function seededShuffle<T>(items: T[], seed: string): T[] {
  const result = [...items]
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i)
    hash |= 0
  }
  for (let i = result.length - 1; i > 0; i--) {
    hash = (hash * 1103515245 + 12345) & 0x7fffffff
    const j = hash % (i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

interface LinePosition {
  x1: number
  y1: number
  x2: number
  y2: number
  leftId: string
  rightId: string
}

export function MatchingQuestion({
  question,
  answer,
  onChange,
  disabled,
  checkResult,
  t,
}: MatchingQuestionProps) {
  const connections = useMemo(
    () => (answer.type === 'matching' ? answer.connections : []),
    [answer],
  )
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null)
  const [linePositions, setLinePositions] = useState<LinePosition[]>([])

  const containerRef = useRef<HTMLDivElement>(null)
  const leftRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const rightRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  const shuffledRight = useMemo(() => {
    if (question.shuffleRightColumn === false) return question.rightColumn
    return seededShuffle(question.rightColumn, question.id)
  }, [question.rightColumn, question.shuffleRightColumn, question.id])

  const correctPairSet = useMemo(
    () => new Set(question.correctPairs.map((p) => `${p.optionId}:${p.matchId}`)),
    [question.correctPairs],
  )

  const isConnectionCorrect = useCallback(
    (leftId: string, rightId: string): boolean | null => {
      if (!checkResult) return null
      return correctPairSet.has(`${leftId}:${rightId}`)
    },
    [checkResult, correctPairSet],
  )

  const connectedLeftIds = useMemo(() => new Set(connections.map((c) => c.leftId)), [connections])

  const handleLeftClick = useCallback(
    (leftId: string) => {
      if (disabled) return
      setSelectedLeft((prev) => (prev === leftId ? null : leftId))
    },
    [disabled],
  )

  const handleRightClick = useCallback(
    (rightId: string) => {
      if (disabled || !selectedLeft) return
      const updated = connections.filter((c) => c.leftId !== selectedLeft && c.rightId !== rightId)
      updated.push({ leftId: selectedLeft, rightId })
      onChange({ type: 'matching', connections: updated })
      setSelectedLeft(null)
    },
    [disabled, selectedLeft, connections, onChange],
  )

  const handleClearAll = useCallback(() => {
    onChange({ type: 'matching', connections: [] })
    setSelectedLeft(null)
  }, [onChange])

  // Calculate line positions for SVG overlay
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const calculate = () => {
      const containerRect = container.getBoundingClientRect()
      const positions: LinePosition[] = connections
        .map((conn) => {
          const leftEl = leftRefs.current.get(conn.leftId)
          const rightEl = rightRefs.current.get(conn.rightId)
          if (!leftEl || !rightEl) return null
          const leftRect = leftEl.getBoundingClientRect()
          const rightRect = rightEl.getBoundingClientRect()
          return {
            x1: leftRect.right - containerRect.left,
            y1: leftRect.top + leftRect.height / 2 - containerRect.top,
            x2: rightRect.left - containerRect.left,
            y2: rightRect.top + rightRect.height / 2 - containerRect.top,
            leftId: conn.leftId,
            rightId: conn.rightId,
          }
        })
        .filter((p): p is LinePosition => p !== null)
      setLinePositions(positions)
    }

    calculate()

    const observer = new ResizeObserver(calculate)
    observer.observe(container)
    return () => observer.disconnect()
  }, [connections])

  const promptBlock: RichTextBlock = {
    ...question.prompt,
    id: `${question.id}-prompt`,
    mediaIds: question.prompt.mediaIds || [],
  }

  const renderColumn = (
    items: MatchingOption[],
    side: 'left' | 'right',
    refs: React.MutableRefObject<Map<string, HTMLButtonElement>>,
    onClick: (id: string) => void,
  ) =>
    items.map((item) => {
      const isSelected = side === 'left' && selectedLeft === item.id
      const isConnected =
        side === 'left'
          ? connectedLeftIds.has(item.id)
          : connections.some((c) => c.rightId === item.id)

      let correctState: boolean | null = null
      if (checkResult) {
        const conn = connections.find(
          side === 'left' ? (c) => c.leftId === item.id : (c) => c.rightId === item.id,
        )
        if (conn) {
          correctState = isConnectionCorrect(conn.leftId, conn.rightId)
        }
      }

      const optionBlock: RichTextBlock = {
        ...item.content,
        id: `${question.id}-${side}-${item.id}`,
        mediaIds: item.content.mediaIds || [],
      }

      return (
        <button
          key={item.id}
          ref={(el) => {
            if (el) refs.current.set(item.id, el)
          }}
          onClick={() => onClick(item.id)}
          className={cn(
            'p-3 rounded-lg border-2 text-start transition-all',
            'border-border bg-card',
            !disabled && 'hover:border-muted-foreground cursor-pointer',
            isSelected && 'border-primary bg-primary/10 ring-2 ring-primary shadow-sm',
            isConnected && !isSelected && 'border-primary/50 bg-primary/5',
            disabled && 'opacity-60 cursor-not-allowed',
            correctState === true && 'border-success bg-success/10',
            correctState === false && 'border-destructive bg-destructive/10',
          )}
          role="option"
          aria-selected={isSelected}
          disabled={disabled}
        >
          <RichTextRenderer block={optionBlock} />
        </button>
      )
    })

  return (
    <div className="flex flex-col gap-4">
      <div className="text-base font-medium text-foreground leading-relaxed">
        <RichTextRenderer block={promptBlock} />
      </div>

      <p className="text-sm text-muted-foreground flex items-center gap-1.5">
        <AlertCircle className="w-4 h-4" />
        {t('matchingInstruction')}
      </p>

      <div ref={containerRef} className="relative flex gap-6">
        {/* SVG overlay for connection lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
          {linePositions.map((pos, i) => {
            const midX = (pos.x1 + pos.x2) / 2
            const correctness = isConnectionCorrect(pos.leftId, pos.rightId)
            const strokeColor =
              correctness === true
                ? 'hsl(var(--success))'
                : correctness === false
                  ? 'hsl(var(--destructive))'
                  : CONNECTION_COLORS[i % CONNECTION_COLORS.length]
            return (
              <path
                key={`${pos.leftId}-${pos.rightId}`}
                d={`M ${pos.x1} ${pos.y1} C ${midX} ${pos.y1}, ${midX} ${pos.y2}, ${pos.x2} ${pos.y2}`}
                stroke={strokeColor}
                strokeWidth={2.5}
                fill="none"
              />
            )
          })}
        </svg>

        {/* Left column */}
        <div className="flex-1 flex flex-col gap-2" role="listbox" aria-label="Items to match">
          {renderColumn(question.leftColumn, 'left', leftRefs, handleLeftClick)}
        </div>

        {/* Right column */}
        <div className="flex-1 flex flex-col gap-2" role="listbox" aria-label="Matching targets">
          {renderColumn(shuffledRight, 'right', rightRefs, handleRightClick)}
        </div>
      </div>

      {connections.length > 0 && !disabled && (
        <button
          onClick={handleClearAll}
          className="self-start text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {t('matchingClear')}
        </button>
      )}
    </div>
  )
}
