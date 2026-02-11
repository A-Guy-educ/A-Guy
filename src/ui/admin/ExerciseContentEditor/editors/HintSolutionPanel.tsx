'use client'

import React from 'react'
import type { InlineRichText } from '@/shared/exercise-content/types'
import { CollapsibleSection } from '../../shared/CollapsibleSection'
import { InlineRichTextEditor } from './InlineRichTextEditor'
import { Plus, X } from 'lucide-react'

interface HintSolutionPanelProps {
  hint?: InlineRichText
  solution?: InlineRichText
  fullSolution?: InlineRichText
  onChange: (field: 'hint' | 'solution' | 'fullSolution', value: InlineRichText | undefined) => void
}

function createDefaultInlineRichText(): InlineRichText {
  return {
    type: 'rich_text',
    format: 'md-math-v1',
    value: '',
    mediaIds: [],
  }
}

export const HintSolutionPanel: React.FC<HintSolutionPanelProps> = ({
  hint,
  solution,
  fullSolution,
  onChange,
}) => {
  const [expanded, setExpanded] = React.useState(false)

  return (
    <CollapsibleSection
      title="Hints & Solutions"
      defaultExpanded={false}
      isExpanded={expanded}
      onToggle={setExpanded}
    >
      <div className="hint-solution-panel">
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

interface HintSolutionFieldProps {
  label: string
  value?: InlineRichText
  onChange: (value: InlineRichText | undefined) => void
}

const HintSolutionField: React.FC<HintSolutionFieldProps> = ({ label, value, onChange }) => {
  if (!value) {
    return (
      <div className="hint-solution-field-empty">
        <button
          type="button"
          className="hint-solution-enable-btn"
          onClick={() => onChange(createDefaultInlineRichText())}
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
      <InlineRichTextEditor
        value={value}
        onChange={onChange}
        placeholder={`Enter ${label.toLowerCase()}...`}
        minHeight="60px"
      />
    </div>
  )
}
