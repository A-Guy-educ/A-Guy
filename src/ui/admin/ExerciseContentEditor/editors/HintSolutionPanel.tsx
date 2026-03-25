'use client'

import React from 'react'
import type { RichContent } from '@/server/payload/collections/Exercises/types'
import { hasRichContentText } from '@/server/payload/collections/Exercises/types'
import { createInlineRichText } from '@/server/payload/endpoints/exercises/generate-support/support-block-utils'
import { useDocumentInfo } from '@payloadcms/ui'
import { CollapsibleSection } from '../../shared/CollapsibleSection'
import { ContentSlotEditor } from '../ContentSlotEditor'
import { useGenerateSupport } from './useGenerateSupport'
import { Plus, X, Sparkles, Loader2 } from 'lucide-react'

export interface SupportFields {
  hint?: RichContent
  solution?: RichContent
  fullSolution?: RichContent
}

interface HintSolutionPanelProps {
  hint?: RichContent
  solution?: RichContent
  fullSolution?: RichContent
  blockId: string
  onChange: (field: 'hint' | 'solution' | 'fullSolution', value: RichContent | undefined) => void
  onBatchChange: (fields: SupportFields) => void
}

export const HintSolutionPanel: React.FC<HintSolutionPanelProps> = ({
  hint,
  solution,
  fullSolution,
  blockId,
  onChange,
  onBatchChange,
}) => {
  const [expanded, setExpanded] = React.useState(false)
  const { id: exerciseId } = useDocumentInfo()

  const { isGenerating, generateError, handleGenerate } = useGenerateSupport({
    exerciseId,
    blockId,
    onBatchChange,
    onExpandPanel: () => setExpanded(true),
  })

  const hasContent =
    hasRichContentText(hint) || hasRichContentText(solution) || hasRichContentText(fullSolution)

  return (
    <CollapsibleSection
      title="Hints & Solutions"
      defaultExpanded={false}
      isExpanded={expanded}
      onToggle={setExpanded}
    >
      <div className="hint-solution-panel">
        <GenerateBar
          isGenerating={isGenerating}
          hasContent={hasContent}
          exerciseId={exerciseId}
          onGenerate={handleGenerate}
        />
        {generateError && <div className="hint-solution-error">{generateError}</div>}
        <HintSolutionField label="Hint" value={hint} onChange={(val) => onChange('hint', val)} />
        <HintSolutionField
          label="Solution"
          value={solution}
          onChange={(val) => onChange('solution', val)}
        />
        <HintSolutionField
          label="Full Solution"
          value={fullSolution}
          onChange={(val) => onChange('fullSolution', val)}
        />
      </div>
    </CollapsibleSection>
  )
}

function GenerateBar({
  isGenerating,
  hasContent,
  exerciseId,
  onGenerate,
}: {
  isGenerating: boolean
  hasContent: boolean
  exerciseId: string | number | undefined
  onGenerate: (overwrite: boolean) => void
}) {
  return (
    <div className="hint-solution-generate-bar">
      <button
        type="button"
        className="hint-solution-generate-btn"
        onClick={() => onGenerate(false)}
        disabled={isGenerating || !exerciseId}
        title="Generate hints and solutions with AI"
      >
        {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
        <span>{isGenerating ? 'Generating...' : 'Generate with AI'}</span>
      </button>
      {hasContent && (
        <button
          type="button"
          className="hint-solution-regenerate-btn"
          onClick={() => onGenerate(true)}
          disabled={isGenerating || !exerciseId}
          title="Regenerate and overwrite existing content"
        >
          <span>Overwrite All</span>
        </button>
      )}
    </div>
  )
}

const HintSolutionField: React.FC<{
  label: string
  value?: RichContent
  onChange: (value: RichContent | undefined) => void
}> = ({ label, value, onChange }) => {
  if (!value) {
    return (
      <div className="hint-solution-field-empty">
        <button
          type="button"
          className="hint-solution-enable-btn"
          onClick={() => onChange(createInlineRichText(''))}
        >
          <Plus size={14} />
          <span>Add {label}</span>
        </button>
      </div>
    )
  }

  return (
    <div className="hint-solution-field">
      <div className="hint-solution-field-header">
        <span className="hint-solution-field-label">{label}</span>
        <button
          type="button"
          className="hint-solution-remove-btn"
          onClick={() => onChange(undefined)}
          title={`Remove ${label}`}
        >
          <X size={14} />
        </button>
      </div>
      <ContentSlotEditor
        value={value}
        onChange={onChange}
        placeholder={`Enter ${label.toLowerCase()}...`}
        minHeight="60px"
      />
    </div>
  )
}
