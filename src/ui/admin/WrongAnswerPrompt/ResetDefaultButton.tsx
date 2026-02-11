'use client'

import { useField, useFormFields } from '@payloadcms/ui'
import type { UIFieldClientComponent } from 'payload'

const DEFAULT_TEMPLATE = `The student answered incorrectly. Here is the full question data:
{{questionData}}

The student's answer was: "{{studentAnswer}}"

Please help them understand why their answer is wrong and guide them toward the correct solution. Be encouraging and supportive.`

export const ResetDefaultButton: UIFieldClientComponent = () => {
  const templateField = useFormFields(([fields]) => fields.template)
  const { setValue } = useField<string>({ path: 'template' })

  const isDefault = templateField?.value === DEFAULT_TEMPLATE

  const handleReset = () => {
    setValue(DEFAULT_TEMPLATE)
  }

  return (
    <div style={{ marginBottom: '1rem' }}>
      <button
        type="button"
        onClick={handleReset}
        disabled={isDefault}
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: isDefault ? 'var(--theme-elevation-100)' : 'var(--theme-elevation-200)',
          color: 'var(--theme-text)',
          border: '1px solid var(--theme-elevation-300)',
          borderRadius: '4px',
          cursor: isDefault ? 'default' : 'pointer',
          opacity: isDefault ? 0.5 : 1,
        }}
      >
        {isDefault ? 'Using default template' : 'Reset to Default'}
      </button>
    </div>
  )
}

export default ResetDefaultButton
