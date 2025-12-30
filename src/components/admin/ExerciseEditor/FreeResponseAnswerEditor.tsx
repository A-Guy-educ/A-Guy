'use client'

/**
 * Free Response Answer Spec Editor
 */

import React from 'react'
import type { FreeResponseAnswerSpec } from '@/contracts'
import type { AnswerSpecEditorProps } from '../shared/types'
import { ErrorDisplay } from '../shared/ErrorDisplay'

export function FreeResponseAnswerEditor({ value, onChange, errors }: AnswerSpecEditorProps) {
  const frValue = value as FreeResponseAnswerSpec

  const updateResponseKind = (kind: 'numeric' | 'algebraic' | 'text') => {
    // Reset to appropriate defaults when changing kind
    const baseSpec = {
      questionType: 'free_response' as const,
      responseKind: kind,
      acceptedAnswers: [''],
    }

    switch (kind) {
      case 'numeric':
        onChange({ ...baseSpec, responseKind: 'numeric', tolerance: 0 })
        break
      case 'algebraic':
        onChange({ ...baseSpec, responseKind: 'algebraic' })
        break
      case 'text':
        onChange({
          ...baseSpec,
          responseKind: 'text',
          caseSensitive: false,
          normalizeWhitespace: true,
        })
        break
    }
  }

  const updateAcceptedAnswer = (index: number, value: string) => {
    const newAnswers = [...frValue.acceptedAnswers]
    newAnswers[index] = value
    onChange({ ...frValue, acceptedAnswers: newAnswers })
  }

  const addAcceptedAnswer = () => {
    onChange({
      ...frValue,
      acceptedAnswers: [...frValue.acceptedAnswers, ''],
    })
  }

  const removeAcceptedAnswer = (index: number) => {
    onChange({
      ...frValue,
      acceptedAnswers: frValue.acceptedAnswers.filter((_, i) => i !== index),
    })
  }

  return (
    <div>
      <h3 style={{ marginBottom: '0.75rem' }}>Free Response Answer</h3>

      <ErrorDisplay errors={errors} />

      {/* Response Kind Selector */}
      <div style={{ marginTop: '1rem' }}>
        <label
          style={{
            display: 'block',
            fontSize: '0.875rem',
            fontWeight: '500',
            marginBottom: '0.5rem',
          }}
        >
          Response Type
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem',
              border: '1px solid var(--theme-elevation-150)',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            <input
              type="radio"
              name="response-kind"
              checked={frValue.responseKind === 'numeric'}
              onChange={() => updateResponseKind('numeric')}
              style={{ width: '1rem', height: '1rem' }}
            />
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: '500' }}>Numeric</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>Numbers only</div>
            </div>
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem',
              border: '1px solid var(--theme-elevation-150)',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            <input
              type="radio"
              name="response-kind"
              checked={frValue.responseKind === 'algebraic'}
              onChange={() => updateResponseKind('algebraic')}
              style={{ width: '1rem', height: '1rem' }}
            />
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: '500' }}>Algebraic</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>Expressions</div>
            </div>
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem',
              border: '1px solid var(--theme-elevation-150)',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            <input
              type="radio"
              name="response-kind"
              checked={frValue.responseKind === 'text'}
              onChange={() => updateResponseKind('text')}
              style={{ width: '1rem', height: '1rem' }}
            />
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: '500' }}>Text</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>Free text</div>
            </div>
          </label>
        </div>
      </div>

      {/* Accepted Answers */}
      <div
        style={{
          borderTop: '1px solid var(--theme-elevation-150)',
          paddingTop: '1rem',
          marginTop: '1rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.75rem',
          }}
        >
          <label style={{ fontSize: '0.875rem', fontWeight: '500' }}>Accepted Answers</label>
          <button
            type="button"
            onClick={addAcceptedAnswer}
            className="btn btn--style-secondary btn--size-small"
          >
            + Add Answer
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {frValue.acceptedAnswers.map((answer, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="text"
                value={answer}
                onChange={(e) => updateAcceptedAnswer(idx, e.target.value)}
                placeholder={
                  frValue.responseKind === 'numeric'
                    ? 'e.g., 42'
                    : frValue.responseKind === 'algebraic'
                      ? 'e.g., 2x+3'
                      : 'e.g., photosynthesis'
                }
                style={{
                  flex: 1,
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.875rem',
                  fontFamily: 'monospace',
                }}
              />
              {frValue.acceptedAnswers.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeAcceptedAnswer(idx)}
                  className="btn btn--style-secondary btn--size-small"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>

        {frValue.acceptedAnswers.length === 0 && (
          <div className="field-error" style={{ marginTop: '0.75rem', padding: '0.75rem' }}>
            ⚠️ You must provide at least one accepted answer
          </div>
        )}
      </div>

      {/* Kind-specific options */}
      {frValue.responseKind === 'numeric' && (
        <div
          style={{
            borderTop: '1px solid var(--theme-elevation-150)',
            paddingTop: '1rem',
            marginTop: '1rem',
          }}
        >
          <label
            style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              marginBottom: '0.5rem',
            }}
          >
            Tolerance (for numeric answers)
          </label>
          <input
            type="number"
            value={frValue.tolerance ?? 0}
            onChange={(e) => onChange({ ...frValue, tolerance: parseFloat(e.target.value) || 0 })}
            style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}
            min="0"
            step="0.01"
            placeholder="0"
          />
          <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', opacity: 0.7 }}>
            Accepted range: answer ± tolerance (e.g., 42 ± 0.1 accepts 41.9 to 42.1)
          </p>
        </div>
      )}

      {frValue.responseKind === 'text' && (
        <div
          style={{
            borderTop: '1px solid var(--theme-elevation-150)',
            paddingTop: '1rem',
            marginTop: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <label
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}
          >
            <input
              type="checkbox"
              checked={frValue.caseSensitive ?? false}
              onChange={(e) => onChange({ ...frValue, caseSensitive: e.target.checked })}
            />
            Case sensitive (e.g., &quot;Apple&quot; ≠ &quot;apple&quot;)
          </label>

          <label
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}
          >
            <input
              type="checkbox"
              checked={frValue.normalizeWhitespace ?? true}
              onChange={(e) => onChange({ ...frValue, normalizeWhitespace: e.target.checked })}
            />
            Normalize whitespace (ignore extra spaces)
          </label>
        </div>
      )}
    </div>
  )
}
