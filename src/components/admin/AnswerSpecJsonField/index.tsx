'use client'

import React from 'react'
import { useField, useFormFields, useTranslation } from '@payloadcms/ui'
import { Highlight, themes } from 'prism-react-renderer'
// Import example JSON files
import mcqExample from '@/contracts/examples/answer-spec-mcq.example.json'
import trueFalseExample from '@/contracts/examples/answer-spec-true-false.example.json'
import freeResponseExample from '@/contracts/examples/answer-spec-free-response.example.json'
import type { JSONFieldClientComponent } from 'payload'

type QuestionType = 'mcq' | 'true_false' | 'free_response'

const EXAMPLE_MAP: Record<QuestionType, unknown> = {
  mcq: mcqExample,
  true_false: trueFalseExample,
  free_response: freeResponseExample,
}

export const AnswerSpecJsonField: JSONFieldClientComponent = ({ path, field }) => {
  const { value, setValue } = useField<unknown>({ path })
  const questionTypeField = useFormFields(([fields]) => fields.questionType)
  const questionType = questionTypeField?.value as QuestionType | undefined
  const { t, i18n } = useTranslation()

  // Handle i18n labels and descriptions
  const getLabel = () => {
    if (typeof field.label === 'string') return field.label
    if (typeof field.label === 'object') return field.label[i18n.language] || field.label['en']
    return 'Answer Specification JSON'
  }

  const getDescription = () => {
    if (!field.admin?.description) return null
    if (typeof field.admin.description === 'string') return field.admin.description
    if (typeof field.admin.description === 'object')
      return field.admin.description[i18n.language] || field.admin.description['en']
    return null
  }

  const [jsonString, setJsonString] = React.useState(() => {
    return JSON.stringify(value || {}, null, 2)
  })
  const [jsonError, setJsonError] = React.useState<string | null>(null)
  const [hasManualEdits, setHasManualEdits] = React.useState(false)

  // Update JSON string when value changes externally
  React.useEffect(() => {
    setJsonString(JSON.stringify(value || {}, null, 2))
  }, [value])

  // When questionType changes, update the JSON if it doesn't match
  React.useEffect(() => {
    if (!questionType) return

    const currentValue = value as { questionType?: string } | null | undefined
    const currentQuestionType = currentValue?.questionType

    // If the JSON doesn't match the selected questionType, update it
    // Only auto-update if:
    // 1. JSON is empty/null OR
    // 2. questionType doesn't match OR
    // 3. User hasn't manually edited yet
    const shouldUpdate =
      !value || !currentQuestionType || (currentQuestionType !== questionType && !hasManualEdits)

    if (shouldUpdate) {
      const example = EXAMPLE_MAP[questionType]
      if (example) {
        setValue(example)
        setJsonString(JSON.stringify(example, null, 2))
        setJsonError(null)
        // Reset manual edits flag when auto-updating from questionType change
        if (currentQuestionType !== questionType) {
          setHasManualEdits(false)
        }
      }
    }
  }, [questionType, setValue, hasManualEdits, value])

  const handleJsonChange = (newJson: string) => {
    setJsonString(newJson)
    setJsonError(null)
    setHasManualEdits(true)

    try {
      const parsed = JSON.parse(newJson)
      setValue(parsed)
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : 'Invalid JSON')
    }
  }

  const handleLoadExample = () => {
    if (!questionType) return

    const example = EXAMPLE_MAP[questionType]
    if (example) {
      setValue(example)
      setJsonString(JSON.stringify(example, null, 2))
      setJsonError(null)
      setHasManualEdits(false)
    }
  }

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(jsonString)
      const formatted = JSON.stringify(parsed, null, 2)
      setJsonString(formatted)
      setValue(parsed)
      setJsonError(null)
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : 'Cannot format invalid JSON')
    }
  }

  // Get example JSON based on questionType
  const getExampleJson = (): string | null => {
    if (!questionType) return null

    const example = EXAMPLE_MAP[questionType]
    return example ? JSON.stringify(example, null, 2) : null
  }

  const exampleJson = getExampleJson()

  return (
    <div style={{ width: '100%' }}>
      <div style={{ marginBottom: '0.5rem' }}>
        <label
          style={{
            display: 'block',
            fontSize: '0.875rem',
            fontWeight: 500,
            marginBottom: '0.25rem',
            color: 'var(--theme-text)',
          }}
        >
          {getLabel()}
        </label>
        {getDescription() && (
          <p
            style={{
              fontSize: '0.75rem',
              color: 'var(--theme-elevation-500)',
              marginBottom: '0.5rem',
            }}
          >
            {getDescription()}
          </p>
        )}
      </div>

      {questionType && (
        <div style={{ marginBottom: '1rem' }}>
          <button
            type="button"
            onClick={handleLoadExample}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              backgroundColor: 'var(--theme-success-500)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Load Example for{' '}
            {questionType === 'mcq'
              ? 'MCQ'
              : questionType === 'true_false'
                ? 'True/False'
                : 'Free Response'}
          </button>
        </div>
      )}

      <div style={{ marginBottom: '0.5rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.5rem',
          }}
        >
          <label
            style={{
              fontSize: '0.75rem',
              fontWeight: 500,
              color: 'var(--theme-elevation-600)',
            }}
          >
            Edit JSON
          </label>
          <button
            type="button"
            onClick={handleFormat}
            style={{
              padding: '0.25rem 0.5rem',
              fontSize: '0.75rem',
              backgroundColor: 'transparent',
              color: 'var(--theme-text)',
              border: '1px solid var(--theme-elevation-300)',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Format JSON
          </button>
        </div>
        <div
          style={{
            position: 'relative',
            border: `1px solid ${jsonError ? 'var(--theme-error-500)' : 'var(--theme-elevation-300)'}`,
            borderRadius: '4px',
            backgroundColor: 'var(--theme-elevation-0)',
            overflow: 'hidden',
          }}
        >
          {/* Syntax highlighted background */}
          <div
            id={`json-highlight-${path}`}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              padding: '0.75rem',
              pointerEvents: 'none',
              overflow: 'hidden',
              minHeight: '300px',
            }}
          >
            <Highlight code={jsonString} language="json" theme={themes.github}>
              {({ tokens, getLineProps, getTokenProps }) => (
                <pre
                  style={{
                    margin: 0,
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                    lineHeight: '1.5',
                  }}
                >
                  {tokens.map((line, i) => (
                    <div key={i} {...getLineProps({ line })}>
                      {line.map((token, key) => (
                        <span key={key} {...getTokenProps({ token })} />
                      ))}
                    </div>
                  ))}
                </pre>
              )}
            </Highlight>
          </div>
          {/* Editable textarea overlay */}
          <textarea
            id={`json-textarea-${path}`}
            value={jsonString}
            onChange={(e) => handleJsonChange(e.target.value)}
            onScroll={(e) => {
              // Sync scroll between textarea and highlighted background
              const highlightDiv = document.getElementById(`json-highlight-${path}`)
              if (highlightDiv) {
                highlightDiv.scrollTop = e.currentTarget.scrollTop
                highlightDiv.scrollLeft = e.currentTarget.scrollLeft
              }
            }}
            spellCheck={false}
            style={{
              position: 'relative',
              width: '100%',
              minHeight: '300px',
              padding: '0.75rem',
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              lineHeight: '1.5',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'transparent',
              resize: 'vertical',
              caretColor: 'var(--theme-text)',
              outline: 'none',
              zIndex: 1,
            }}
          />
        </div>
        {jsonError && (
          <div
            style={{
              marginTop: '0.5rem',
              padding: '0.5rem',
              backgroundColor: 'var(--theme-error-50)',
              color: 'var(--theme-error-500)',
              borderRadius: '4px',
              fontSize: '0.75rem',
            }}
          >
            {jsonError}
          </div>
        )}
      </div>

      {questionType && exampleJson && (
        <details
          style={{
            marginTop: '1rem',
            padding: '0.75rem',
            border: '1px solid var(--theme-elevation-300)',
            borderRadius: '4px',
            backgroundColor: 'var(--theme-elevation-50)',
          }}
        >
          <summary
            style={{
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '0.875rem',
              marginBottom: '0.5rem',
              userSelect: 'none',
            }}
          >
            View Example JSON ({questionType})
          </summary>
          <div
            style={{
              margin: '0.5rem 0 0 0',
              padding: '0.75rem',
              borderRadius: '4px',
              overflow: 'auto',
              fontSize: '0.75rem',
              fontFamily: 'monospace',
              lineHeight: '1.5',
            }}
          >
            <Highlight code={exampleJson || ''} language="json" theme={themes.github}>
              {({ tokens, getLineProps, getTokenProps }) => (
                <pre style={{ margin: 0 }}>
                  {tokens.map((line, i) => (
                    <div key={i} {...getLineProps({ line })}>
                      {line.map((token, key) => (
                        <span key={key} {...getTokenProps({ token })} />
                      ))}
                    </div>
                  ))}
                </pre>
              )}
            </Highlight>
          </div>
        </details>
      )}
    </div>
  )
}
