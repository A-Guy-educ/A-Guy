/**
 * Free Response Answer UI
 * Text input for numeric, algebraic, or text answers
 * NOTE: This component is deprecated and not used in the new block-based exercise structure
 */

import type { FreeResponseAnswerSpec } from '@/infra/contracts'
import React from 'react'

// Legacy UserAnswer type
type LegacyFreeResponseAnswer = { type: 'free_response'; value: string }

interface FreeResponseAnswerUIProps {
  spec: FreeResponseAnswerSpec
  value: LegacyFreeResponseAnswer
  onChange: (value: LegacyFreeResponseAnswer) => void
  disabled?: boolean
}

export function FreeResponseAnswerUI({
  spec,
  value,
  onChange,
  disabled = false,
}: FreeResponseAnswerUIProps) {
  const inputValue = value.type === 'free_response' ? value.value : ''

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange({ type: 'free_response', value: e.target.value })
  }

  const getPlaceholder = () => {
    switch (spec.responseKind) {
      case 'numeric':
        return 'Enter a number...'
      case 'algebraic':
        return 'Enter an expression (e.g., 2x+3)...'
      case 'text':
        return 'Enter your answer...'
      default:
        return 'Enter your answer...'
    }
  }

  const getInputType = () => {
    return spec.responseKind === 'numeric' ? 'text' : 'text'
  }

  // Use textarea for longer text responses
  const useTextarea = spec.responseKind === 'text'

  return (
    <div className="space-y-2">
      <div className="text-sm text-muted-foreground">
        {spec.responseKind === 'numeric' && 'Enter a numeric value'}
        {spec.responseKind === 'algebraic' && 'Enter an algebraic expression'}
        {spec.responseKind === 'text' && 'Enter your text answer'}
      </div>

      {useTextarea ? (
        <textarea
          value={inputValue}
          onChange={handleChange}
          disabled={disabled}
          placeholder={getPlaceholder()}
          className="w-full p-3 border border-border rounded-lg bg-background text-foreground resize-y focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
          rows={4}
        />
      ) : (
        <input
          type={getInputType()}
          value={inputValue}
          onChange={handleChange}
          disabled={disabled}
          placeholder={getPlaceholder()}
          className="w-full p-3 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
        />
      )}
    </div>
  )
}
