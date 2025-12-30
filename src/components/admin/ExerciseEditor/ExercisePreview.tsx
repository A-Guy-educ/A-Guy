/**
 * Exercise Preview Component
 * Admin integration: Shows live preview of exercise using current form values
 */

'use client'

import React, { useState } from 'react'
import type { TextFieldClientComponent } from 'payload'
import { useFormFields } from '@payloadcms/ui'
import { ExerciseContentSchema, AnswerSpecSchema } from '@/contracts'
import { ExerciseRenderer } from '@/components/ExerciseRenderer'
import type { PreviewMode } from '@/components/ExerciseRenderer'
import { CollapsibleSection } from '../shared/CollapsibleSection'

export const ExercisePreview: TextFieldClientComponent = () => {
  const [mode, setMode] = useState<PreviewMode>('student')

  // Get form field values using useFormFields
  const contentJson = useFormFields(([fields]) => fields.contentJson)
  const answerSpecJson = useFormFields(([fields]) => fields.answerSpecJson)
  const questionType = useFormFields(([fields]) => fields.questionType)

  // Validate content with Zod
  const contentResult = ExerciseContentSchema.safeParse(contentJson.value)
  const answerResult = AnswerSpecSchema.safeParse(answerSpecJson.value)

  // Check for validation errors
  const hasErrors = !contentResult.success || !answerResult.success

  // Type mismatch check
  const typeMismatch =
    contentResult.success &&
    answerResult.success &&
    questionType.value !== answerResult.data.questionType

  return (
    <div style={{ marginTop: '1rem' }}>
      <CollapsibleSection title="Exercise Preview" defaultExpanded={false}>
        <div>
          {/* Preview Mode Toggle */}
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              marginBottom: '1rem',
              padding: '0.5rem',
              background: 'var(--theme-elevation-100)',
              borderRadius: '4px',
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="radio"
                name="preview-mode"
                checked={mode === 'student'}
                onChange={() => setMode('student')}
              />
              <span style={{ fontSize: '0.875rem' }}>Student Mode</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="radio"
                name="preview-mode"
                checked={mode === 'debug'}
                onChange={() => setMode('debug')}
              />
              <span style={{ fontSize: '0.875rem' }}>Debug Mode</span>
            </label>
          </div>

          {/* Validation Error Display */}
          {hasErrors && (
            <div
              style={{
                padding: '1rem',
                background: 'var(--theme-error-50)',
                border: '2px solid var(--theme-error-500)',
                borderRadius: '4px',
                marginBottom: '1rem',
              }}
            >
              <h4
                style={{
                  margin: '0 0 0.5rem 0',
                  color: 'var(--theme-error-600)',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                }}
              >
                ⚠️ Validation Errors
              </h4>

              {!contentResult.success && (
                <div style={{ marginBottom: '0.5rem' }}>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      marginBottom: '0.25rem',
                    }}
                  >
                    Content Errors:
                  </div>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: '1.5rem',
                      fontSize: '0.75rem',
                      fontFamily: 'monospace',
                    }}
                  >
                    {contentResult.error.issues.map((err, idx) => (
                      <li key={idx}>
                        {err.path.join('.')}: {err.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!answerResult.success && (
                <div>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      marginBottom: '0.25rem',
                    }}
                  >
                    Answer Spec Errors:
                  </div>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: '1.5rem',
                      fontSize: '0.75rem',
                      fontFamily: 'monospace',
                    }}
                  >
                    {answerResult.error.issues.map((err, idx) => (
                      <li key={idx}>
                        {err.path.join('.')}: {err.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Type Mismatch Warning */}
          {!hasErrors && typeMismatch && (
            <div
              style={{
                padding: '1rem',
                background: 'var(--theme-warning-50)',
                border: '2px solid var(--theme-warning-500)',
                borderRadius: '4px',
                marginBottom: '1rem',
              }}
            >
              <h4
                style={{
                  margin: '0 0 0.5rem 0',
                  color: 'var(--theme-warning-700)',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                }}
              >
                ⚠️ Type Mismatch
              </h4>
              <p style={{ margin: 0, fontSize: '0.75rem' }}>
                Question Type field ({String(questionType.value)}) does not match Answer Spec
                questionType ({answerResult.data.questionType}). These must be the same.
              </p>
            </div>
          )}

          {/* Render Preview */}
          {!hasErrors && !typeMismatch && contentResult.success && answerResult.success && (
            <div
              style={{
                padding: '1.5rem',
                background: 'white',
                border: '1px solid var(--theme-elevation-200)',
                borderRadius: '8px',
              }}
            >
              <ExerciseRenderer
                content={contentResult.data}
                answerSpec={answerResult.data}
                questionType={questionType.value as 'mcq' | 'true_false' | 'free_response'}
                mode={mode}
                showCheckAnswer={true}
              />
            </div>
          )}

          {/* Help Text */}
          <div
            style={{
              marginTop: '1rem',
              padding: '0.75rem',
              background: 'var(--theme-elevation-100)',
              borderRadius: '4px',
              fontSize: '0.75rem',
              opacity: 0.8,
            }}
          >
            <p style={{ margin: 0 }}>
              <strong>Preview Mode:</strong>
            </p>
            <ul style={{ margin: '0.25rem 0 0 0', paddingLeft: '1.5rem' }}>
              <li>
                <strong>Student</strong> - See how the exercise appears to students (recommended)
              </li>
              <li>
                <strong>Debug</strong> - View technical details, block IDs, and correct answers
              </li>
            </ul>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  )
}
