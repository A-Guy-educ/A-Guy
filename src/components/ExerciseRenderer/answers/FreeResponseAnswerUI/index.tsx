/**
 * Free Response Answer UI
 * Text input for numeric, algebraic, or text answers
 */

import React from 'react'
import type { FreeResponseAnswerSpec } from '@/contracts'
import type { UserAnswer } from '../../types'
import './index.scss'

const baseClass = 'free-response-answer-ui'

interface FreeResponseAnswerUIProps {
  spec: FreeResponseAnswerSpec
  value: UserAnswer
  onChange: (value: UserAnswer) => void
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
    <div className={baseClass}>
      <div className={`${baseClass}__hint`}>
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
          className={`${baseClass}__textarea`}
          rows={4}
        />
      ) : (
        <input
          type={getInputType()}
          value={inputValue}
          onChange={handleChange}
          disabled={disabled}
          placeholder={getPlaceholder()}
          className={`${baseClass}__input`}
        />
      )}
    </div>
  )
}
