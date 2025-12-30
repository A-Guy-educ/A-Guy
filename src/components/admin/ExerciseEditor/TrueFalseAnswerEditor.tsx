'use client'

/**
 * True/False Answer Spec Editor
 */

import React from 'react'
import type { TrueFalseAnswerSpec } from '@/contracts'
import type { AnswerSpecEditorProps } from '../shared/types'
import { ErrorDisplay } from '../shared/ErrorDisplay'

export function TrueFalseAnswerEditor({ value, onChange, errors }: AnswerSpecEditorProps) {
  const tfValue = value as TrueFalseAnswerSpec

  return (
    <div>
      <h3 style={{ marginBottom: '0.75rem' }}>True/False Answer</h3>

      <ErrorDisplay errors={errors} />

      <div
        style={{
          border: '1px solid var(--theme-elevation-150)',
          borderRadius: '4px',
          padding: '1.5rem',
          marginTop: '1rem',
        }}
      >
        <label
          style={{
            display: 'block',
            fontSize: '0.875rem',
            fontWeight: '500',
            marginBottom: '1rem',
          }}
        >
          Select the correct answer:
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '1rem',
              border: '1px solid var(--theme-elevation-150)',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            <input
              type="radio"
              name="true-false-answer"
              checked={tfValue.correct === true}
              onChange={() => onChange({ ...tfValue, correct: true })}
              style={{ width: '1.25rem', height: '1.25rem' }}
            />
            <div>
              <div style={{ fontSize: '1rem', fontWeight: '500' }}>True</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>The statement is correct</div>
            </div>
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '1rem',
              border: '1px solid var(--theme-elevation-150)',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            <input
              type="radio"
              name="true-false-answer"
              checked={tfValue.correct === false}
              onChange={() => onChange({ ...tfValue, correct: false })}
              style={{ width: '1.25rem', height: '1.25rem' }}
            />
            <div>
              <div style={{ fontSize: '1rem', fontWeight: '500' }}>False</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>The statement is incorrect</div>
            </div>
          </label>
        </div>

        <div
          style={{
            marginTop: '1rem',
            padding: '0.75rem',
            border: '1px solid var(--theme-elevation-150)',
            borderRadius: '4px',
          }}
        >
          <p style={{ fontSize: '0.875rem' }}>
            <strong>Currently selected:</strong>{' '}
            <span style={{ fontWeight: 'bold' }}>{tfValue.correct ? 'True' : 'False'}</span>
          </p>
        </div>
      </div>
    </div>
  )
}
