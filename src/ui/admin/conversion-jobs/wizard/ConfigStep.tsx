/**
 * Configuration Step
 *
 * Third step - configure segmentation and extraction settings
 *
 * @fileType component
 * @domain admin
 * @pattern wizard-step
 * @ai-summary Third wizard step for conversion configuration
 */

'use client'

import { useEffect } from 'react'

interface ConfigStepProps {
  segmentation: { pagesPerSegment: number }
  extraction: { mode: string; exerciseTypes: string[]; customInstructions?: string }
  onChange: (data: {
    segmentation: { pagesPerSegment: number }
    extraction: { mode: string; exerciseTypes: string[]; customInstructions?: string }
  }) => void
  onValidationChange: (isValid: boolean) => void
}

const EXERCISE_TYPES = [
  { value: 'mcq', label: 'Multiple Choice (MCQ)' },
  { value: 'free_response', label: 'Free Response' },
  { value: 'select', label: 'Select All That Apply' },
  { value: 'fill_blank', label: 'Fill in the Blank' },
  { value: 'matching', label: 'Matching' },
  { value: 'ordering', label: 'Ordering/Sequencing' },
  { value: 'true_false', label: 'True/False' },
  { value: 'short_answer', label: 'Short Answer' },
]

export function ConfigStep({
  segmentation,
  extraction,
  onChange,
  onValidationChange,
}: ConfigStepProps) {
  useEffect(() => {
    // Always valid - defaults are set
    onValidationChange(true)
  }, [onValidationChange])

  const handleSegmentationChange = (value: number) => {
    onChange({
      segmentation: { pagesPerSegment: value },
      extraction,
    })
  }

  const handleModeChange = (value: string) => {
    onChange({
      segmentation,
      extraction: { ...extraction, mode: value },
    })
  }

  const handleExerciseTypeToggle = (type: string) => {
    const types = extraction.exerciseTypes.includes(type)
      ? extraction.exerciseTypes.filter((t) => t !== type)
      : [...extraction.exerciseTypes, type]

    onChange({
      segmentation,
      extraction: { ...extraction, exerciseTypes: types },
    })
  }

  const handleInstructionsChange = (value: string) => {
    onChange({
      segmentation,
      extraction: { ...extraction, customInstructions: value || undefined },
    })
  }

  return (
    <div className="wizard-step config-step">
      <h2>Configure Extraction</h2>
      <p className="step-description">
        Set up how the PDF should be processed and what types of exercises to extract
      </p>

      <div className="config-section">
        <h3>Segmentation</h3>
        <div className="form-group">
          <label htmlFor="pagesPerSegment">Pages per Segment</label>
          <input
            id="pagesPerSegment"
            type="number"
            min={1}
            max={20}
            value={segmentation.pagesPerSegment}
            onChange={(e) => handleSegmentationChange(parseInt(e.target.value) || 1)}
            className="form-input"
          />
          <p className="field-hint">Smaller segments process faster and use less memory</p>
        </div>
      </div>

      <div className="config-section">
        <h3>Extraction Mode</h3>
        <div className="radio-group">
          <label className="radio-option">
            <input
              type="radio"
              name="mode"
              value="structured"
              checked={extraction.mode === 'structured'}
              onChange={(e) => handleModeChange(e.target.value)}
            />
            <span className="radio-label">
              <strong>Structured</strong>
              <span className="radio-description">Extract with full exercise structure</span>
            </span>
          </label>
          <label className="radio-option">
            <input
              type="radio"
              name="mode"
              value="simple"
              checked={extraction.mode === 'simple'}
              onChange={(e) => handleModeChange(e.target.value)}
            />
            <span className="radio-label">
              <strong>Simple</strong>
              <span className="radio-description">Extract basic question and answer pairs</span>
            </span>
          </label>
        </div>
      </div>

      <div className="config-section">
        <h3>Exercise Types</h3>
        <div className="checkbox-group">
          {EXERCISE_TYPES.map((type) => (
            <label key={type.value} className="checkbox-option">
              <input
                type="checkbox"
                checked={extraction.exerciseTypes.includes(type.value)}
                onChange={() => handleExerciseTypeToggle(type.value)}
              />
              <span>{type.label}</span>
            </label>
          ))}
        </div>
        {extraction.exerciseTypes.length === 0 && (
          <p className="field-error">Select at least one exercise type</p>
        )}
      </div>

      <div className="config-section">
        <h3>Custom Instructions</h3>
        <div className="form-group">
          <label htmlFor="instructions">Additional Instructions (optional)</label>
          <textarea
            id="instructions"
            value={extraction.customInstructions || ''}
            onChange={(e) => handleInstructionsChange(e.target.value)}
            className="form-textarea"
            placeholder="e.g., Focus on extracting questions from the last chapter..."
            rows={3}
          />
        </div>
      </div>

      <style>{`
        .config-step { padding: 1rem; }
        .step-description { color: var(--theme-elevation-500); margin-bottom: 1.5rem; }
        .config-section {
          margin-bottom: 1.5rem;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid var(--theme-elevation-100);
        }
        .config-section:last-child { border-bottom: none; }
        .config-section h3 {
          font-size: 1rem;
          font-weight: 600;
          margin-bottom: 1rem;
        }
        .form-group { margin-bottom: 1rem; }
        .form-group label { display: block; font-weight: 500; margin-bottom: 0.5rem; }
        .form-input { width: 100%; max-width: 200px; padding: 0.5rem; border: 1px solid var(--theme-elevation-200); border-radius: 4px; }
        .form-textarea { width: 100%; padding: 0.5rem; border: 1px solid var(--theme-elevation-200); border-radius: 4px; resize: vertical; }
        .field-hint { font-size: 0.75rem; color: var(--theme-elevation-500); margin-top: 0.25rem; }
        .field-error { font-size: 0.875rem; color: #dc2626; margin-top: 0.5rem; }
        .radio-group { display: flex; flex-direction: column; gap: 0.75rem; }
        .radio-option {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          padding: 0.75rem;
          border: 1px solid var(--theme-elevation-200);
          border-radius: 4px;
          cursor: pointer;
        }
        .radio-option:has(input:checked) { border-color: var(--theme-primary); background: var(--theme-primary-50); }
        .radio-label { display: flex; flex-direction: column; }
        .radio-description { font-size: 0.875rem; color: var(--theme-elevation-500); }
        .checkbox-group { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.5rem; }
        .checkbox-option {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem;
          border-radius: 4px;
          cursor: pointer;
        }
        .checkbox-option:hover { background: var(--theme-elevation-50); }
      `}</style>
    </div>
  )
}
