'use client'

import React from 'react'
import type { MatchingOption, MatchingPair } from '@/server/payload/collections/Exercises/types'
import { Plus, Trash2 } from 'lucide-react'

interface MatchingPairsListProps {
  leftColumn: MatchingOption[]
  rightColumn: MatchingOption[]
  correctPairs: MatchingPair[]
  onChange: (pairs: MatchingPair[]) => void
}

const getLabel = (options: MatchingOption[], id: string, fallbackIdx: number) => {
  const opt = options.find((o) => o.id === id)
  const text = opt?.content.value?.slice(0, 30)
  return text || `Item ${fallbackIdx + 1}`
}

export const MatchingPairsList: React.FC<MatchingPairsListProps> = ({
  leftColumn,
  rightColumn,
  correctPairs,
  onChange,
}) => {
  const handleAdd = () => {
    const usedLeft = new Set(correctPairs.map((p) => p.optionId))
    const usedRight = new Set(correctPairs.map((p) => p.matchId))
    const nextLeft = leftColumn.find((o) => !usedLeft.has(o.id))?.id || leftColumn[0]?.id || ''
    const nextRight = rightColumn.find((o) => !usedRight.has(o.id))?.id || rightColumn[0]?.id || ''
    if (!nextLeft || !nextRight) return
    onChange([...correctPairs, { optionId: nextLeft, matchId: nextRight }])
  }

  const handleRemove = (index: number) => {
    onChange(correctPairs.filter((_, i) => i !== index))
  }

  const handleUpdate = (index: number, field: 'optionId' | 'matchId', value: string) => {
    onChange(correctPairs.map((p, i) => (i === index ? { ...p, [field]: value } : p)))
  }

  return (
    <div className="matching-pairs-list">
      {correctPairs.length === 0 && (
        <p className="matching-pairs-empty">No pairs defined yet. Add a pair below.</p>
      )}
      {correctPairs.map((pair, index) => (
        <div key={index} className="panel-item-row">
          <span className="matching-pair-number">{index + 1}.</span>
          <select
            className="panel-field-select matching-pair-select"
            value={pair.optionId}
            onChange={(e) => handleUpdate(index, 'optionId', e.target.value)}
          >
            {leftColumn.map((opt, i) => (
              <option key={opt.id} value={opt.id}>
                {getLabel(leftColumn, opt.id, i)}
              </option>
            ))}
          </select>
          <span className="matching-pair-arrow">&rarr;</span>
          <select
            className="panel-field-select matching-pair-select"
            value={pair.matchId}
            onChange={(e) => handleUpdate(index, 'matchId', e.target.value)}
          >
            {rightColumn.map((opt, i) => (
              <option key={opt.id} value={opt.id}>
                {getLabel(rightColumn, opt.id, i)}
              </option>
            ))}
          </select>
          <button type="button" className="panel-remove-btn" onClick={() => handleRemove(index)}>
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button type="button" className="panel-add-btn" onClick={handleAdd}>
        <Plus size={14} />
        <span>Add Pair</span>
      </button>
    </div>
  )
}
