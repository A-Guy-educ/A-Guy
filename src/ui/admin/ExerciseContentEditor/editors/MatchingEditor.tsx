'use client'

import React from 'react'
import type {
  QuestionMatchingBlock,
  MatchingOption,
  MatchingPair,
} from '@/server/payload/collections/Exercises/types'
import { InlineRichTextEditor } from './InlineRichTextEditor'
import { HintSolutionPanel } from './HintSolutionPanel'
import { ColumnEditor } from '../components/matching/ColumnEditor'
import { MatchingPairsList } from '../components/matching/MatchingPairsList'
import { normalizeMatchingPairs } from './normalizers'

interface MatchingEditorProps {
  block: QuestionMatchingBlock
  onChange: (block: QuestionMatchingBlock) => void
}

export const MatchingEditor: React.FC<MatchingEditorProps> = ({ block, onChange }) => {
  const handleLeftColumnChange = (leftColumn: MatchingOption[]) => {
    onChange(normalizeMatchingPairs({ ...block, leftColumn }))
  }

  const handleRightColumnChange = (rightColumn: MatchingOption[]) => {
    onChange(normalizeMatchingPairs({ ...block, rightColumn }))
  }

  const handlePairsChange = (correctPairs: MatchingPair[]) => {
    onChange({ ...block, correctPairs })
  }

  const handleShuffleToggle = () => {
    onChange({ ...block, shuffleRightColumn: !block.shuffleRightColumn })
  }

  return (
    <div className="matching-editor">
      <div className="question-editor-section">
        <label className="question-editor-label">Prompt</label>
        <InlineRichTextEditor
          value={block.prompt}
          onChange={(prompt) => onChange({ ...block, prompt })}
          placeholder="Enter your matching question..."
        />
      </div>

      <div className="question-editor-section">
        <div className="matching-columns">
          <ColumnEditor
            label="Left Column"
            options={block.leftColumn}
            onChange={handleLeftColumnChange}
          />
          <ColumnEditor
            label="Right Column"
            options={block.rightColumn}
            onChange={handleRightColumnChange}
          />
        </div>
      </div>

      <div className="question-editor-section">
        <label className="question-editor-label">Correct Pairs</label>
        <MatchingPairsList
          leftColumn={block.leftColumn}
          rightColumn={block.rightColumn}
          correctPairs={block.correctPairs}
          onChange={handlePairsChange}
        />
      </div>

      <div className="question-editor-section">
        <label className="matching-shuffle-toggle">
          <input
            type="checkbox"
            checked={block.shuffleRightColumn ?? false}
            onChange={handleShuffleToggle}
          />
          <span>Shuffle right column for students</span>
        </label>
      </div>

      <div className="question-editor-section">
        <HintSolutionPanel
          hint={block.hint}
          solution={block.solution}
          fullSolution={block.fullSolution}
          blockId={block.id}
          onChange={(field, value) => onChange({ ...block, [field]: value })}
          onBatchChange={(fields) => onChange({ ...block, ...fields })}
        />
      </div>
    </div>
  )
}
