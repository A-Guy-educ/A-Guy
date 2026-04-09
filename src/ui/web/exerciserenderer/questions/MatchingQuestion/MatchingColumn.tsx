'use client'

import React from 'react'
import type { MatchingOption } from '../../types'
import { MatchingItem } from './MatchingItem'

interface MatchingColumnProps {
  items: MatchingOption[]
  side: 'left' | 'right'
  questionId: string
  header: string
  selectedLeft: string | null
  connectedIds: Set<string>
  disabled: boolean
  getCorrectState: (side: 'left' | 'right', itemId: string) => boolean | null
  onClick: (id: string) => void
  onRef: (id: string, el: HTMLButtonElement | null) => void
}

export function MatchingColumn({
  items,
  side,
  questionId,
  header,
  selectedLeft,
  connectedIds,
  disabled,
  getCorrectState,
  onClick,
  onRef,
}: MatchingColumnProps) {
  return (
    <div className="flex-1 flex flex-col gap-content-gap-xs relative z-[2] min-w-[180px] max-w-[350px]">
      <div
        className="bg-[hsl(var(--tab-exams)/0.08)] border border-[hsl(var(--tab-exams)/0.2)] rounded-xl py-2.5 font-bold text-center text-body-sm"
        style={{ color: 'hsl(var(--tab-exams))' }}
      >
        {header}
      </div>
      {items.map((item, i) => (
        <MatchingItem
          key={item.id}
          item={item}
          index={i}
          side={side}
          questionId={questionId}
          isSelected={side === 'left' && selectedLeft === item.id}
          isConnected={connectedIds.has(item.id)}
          correctState={getCorrectState(side, item.id)}
          canSelect={side === 'right' && selectedLeft !== null && !connectedIds.has(item.id)}
          disabled={disabled}
          onClick={onClick}
          onRef={onRef}
        />
      ))}
    </div>
  )
}
