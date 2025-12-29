'use client'

/**
 * Payload Custom Field Component for answerSpecJson
 */

import React from 'react'
import type { TextFieldClientComponent } from 'payload'
import { FieldLabel, FieldDescription, useField, useFormFields } from '@payloadcms/ui'
import { AnswerSpecJsonEditor } from './AnswerSpecJsonEditor'
import type { AnswerSpec } from '@/contracts'

export const AnswerSpecJsonField: TextFieldClientComponent = (props) => {
  const { path, field, readOnly } = props
  const { value, setValue } = useField<AnswerSpec>({ path })

  // Get the questionType from the form
  const questionTypeField = useFormFields(([fields]) => fields.questionType)
  const questionType = (questionTypeField?.value as 'mcq' | 'true_false' | 'free_response') || 'mcq'

  // Generate valid default based on current questionType
  const getDefaultValue = (): AnswerSpec => {
    switch (questionType) {
      case 'mcq':
        return {
          questionType: 'mcq',
          multiSelect: false,
          options: [
            {
              id: 'opt1',
              content: [{ id: 't1', type: 'rich_text', format: 'md-math-v1', value: 'Option A' }],
            },
            {
              id: 'opt2',
              content: [{ id: 't2', type: 'rich_text', format: 'md-math-v1', value: 'Option B' }],
            },
          ],
          correctOptionIds: ['opt1'],
        }
      case 'true_false':
        return {
          questionType: 'true_false',
          correct: true,
        }
      case 'free_response':
        return {
          questionType: 'free_response',
          responseKind: 'numeric',
          acceptedAnswers: ['0'],
          tolerance: 0,
        }
    }
  }

  return (
    <div className="field-type-json">
      <div className="field-type-wrapper">
        <FieldLabel label={field.label} path={path} required={field.required} />
        {field?.admin?.description && (
          <FieldDescription description={field.admin.description} path={path} />
        )}
        <div style={{ marginTop: '0.75rem' }}>
          <AnswerSpecJsonEditor
            value={value || getDefaultValue()}
            onChange={readOnly ? () => {} : setValue}
            questionType={questionType}
            path={path}
          />
        </div>
      </div>
    </div>
  )
}
