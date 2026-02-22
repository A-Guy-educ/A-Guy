'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Info } from 'lucide-react'
import type { QuestionMatchingBlock, UserAnswer, CheckResult, RichTextBlock } from '../../types'
import { RichTextRenderer } from '../../blocks/RichTextRenderer'
import { MatchingColumn } from './MatchingColumn'
import { MatchingLines } from './MatchingLines'
import { seededShuffle, type LinePosition } from './matchingUtils'

interface MatchingQuestionProps {
  question: QuestionMatchingBlock
  answer: UserAnswer
  onChange: (answer: UserAnswer) => void
  disabled: boolean
  checkResult: CheckResult | null
  t: (key: string) => string
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
  const connectedRightIds = useMemo(() => new Set(connections.map((c) => c.rightId)), [connections])

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

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const calculate = () => {
      const rect = container.getBoundingClientRect()
      const positions: LinePosition[] = connections
        .map((conn) => {
          const leftEl = leftRefs.current.get(conn.leftId)
          const rightEl = rightRefs.current.get(conn.rightId)
          if (!leftEl || !rightEl) return null
          const lr = leftEl.getBoundingClientRect()
          const rr = rightEl.getBoundingClientRect()
          const lCenterX = lr.left + lr.width / 2 - rect.left
          const rCenterX = rr.left + rr.width / 2 - rect.left
          const x1 = lCenterX < rCenterX ? lr.right - rect.left : lr.left - rect.left
          const x2 = lCenterX < rCenterX ? rr.left - rect.left : rr.right - rect.left
          return {
            x1,
            y1: lr.top + lr.height / 2 - rect.top,
            x2,
            y2: rr.top + rr.height / 2 - rect.top,
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

  const getCorrectState = useCallback(
    (side: 'left' | 'right', itemId: string): boolean | null => {
      if (!checkResult) return null
      const conn = connections.find(
        side === 'left' ? (c) => c.leftId === itemId : (c) => c.rightId === itemId,
      )
      return conn ? isConnectionCorrect(conn.leftId, conn.rightId) : null
    },
    [checkResult, connections, isConnectionCorrect],
  )

  const setRef =
    (refs: React.MutableRefObject<Map<string, HTMLButtonElement>>) =>
    (id: string, el: HTMLButtonElement | null) => {
      if (el) refs.current.set(id, el)
    }

  const promptBlock: RichTextBlock = {
    ...question.prompt,
    id: `${question.id}-prompt`,
    mediaIds: question.prompt.mediaIds || [],
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="text-base font-medium text-foreground leading-relaxed">
        <RichTextRenderer block={promptBlock} />
      </div>

      <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-primary/5 border border-primary/20 text-sm text-primary">
        <Info className="w-4 h-4 shrink-0" />
        {t('matchingInstruction')}
      </div>

      <div ref={containerRef} className="relative flex gap-16 px-5">
        <MatchingLines lines={linePositions} getCorrectness={isConnectionCorrect} />
        <MatchingColumn
          items={question.leftColumn}
          side="left"
          questionId={question.id}
          header={t('matchingColumnA')}
          selectedLeft={selectedLeft}
          connectedIds={connectedLeftIds}
          disabled={disabled}
          getCorrectState={getCorrectState}
          onClick={handleLeftClick}
          onRef={setRef(leftRefs)}
        />
        <MatchingColumn
          items={shuffledRight}
          side="right"
          questionId={question.id}
          header={t('matchingColumnB')}
          selectedLeft={selectedLeft}
          connectedIds={connectedRightIds}
          disabled={disabled}
          getCorrectState={getCorrectState}
          onClick={handleRightClick}
          onRef={setRef(rightRefs)}
        />
      </div>

      {connections.length > 0 && !disabled && (
        <button
          onClick={handleClearAll}
          className="self-start text-sm text-muted-foreground hover:text-foreground transition-colors underline"
        >
          {t('matchingClear')}
        </button>
      )}
    </div>
  )
}
