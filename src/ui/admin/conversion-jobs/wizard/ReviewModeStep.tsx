/**
 * Review Mode Step
 *
 * Fifth step - select how exercises should be reviewed
 *
 * @fileType component
 * @domain admin
 * @pattern wizard-step
 * @ai-summary Fifth wizard step for review mode selection
 */

'use client'

import { useEffect } from 'react'

interface ReviewModeStepProps {
  reviewMode: 'auto' | 'segment' | 'batch' | 'manual'
  onChange: (data: { reviewMode: 'auto' | 'segment' | 'batch' | 'manual' }) => void
  onValidationChange: (isValid: boolean) => void
}

const REVIEW_MODES = [
  {
    value: 'auto',
    label: 'Auto-Approve',
    description: 'Automatically approve exercises above confidence threshold',
    icon: '⚡',
  },
  {
    value: 'segment',
    label: 'Segment Review',
    description: 'Review all exercises after each segment completes',
    icon: '📋',
  },
  {
    value: 'batch',
    label: 'Batch Review',
    description: 'Review all exercises after entire conversion',
    icon: '📦',
  },
  {
    value: 'manual',
    label: 'Manual Only',
    description: 'Require manual approval for every exercise',
    icon: '✋',
  },
]

export function ReviewModeStep({ reviewMode, onChange, onValidationChange }: ReviewModeStepProps) {
  useEffect(() => {
    onValidationChange(true)
  }, [onValidationChange])

  return (
    <div className="wizard-step review-mode-step">
      <h2>Review Mode</h2>
      <p className="step-description">Choose how exercises should be reviewed and approved</p>

      <div className="review-modes">
        {REVIEW_MODES.map((mode) => (
          <label
            key={mode.value}
            className={`review-mode-option ${reviewMode === mode.value ? 'selected' : ''}`}
          >
            <input
              type="radio"
              name="reviewMode"
              value={mode.value}
              checked={reviewMode === mode.value}
              onChange={(e) =>
                onChange({ reviewMode: e.target.value as 'auto' | 'segment' | 'batch' | 'manual' })
              }
            />
            <span className="mode-icon">{mode.icon}</span>
            <div className="mode-content">
              <span className="mode-label">{mode.label}</span>
              <span className="mode-description">{mode.description}</span>
            </div>
            {reviewMode === mode.value && <span className="check-mark">✓</span>}
          </label>
        ))}
      </div>

      {reviewMode === 'auto' && (
        <div className="auto-config">
          <h3>Auto-Approve Settings</h3>
          <p className="config-hint">Exercises with confidence above 85% will be auto-approved</p>
        </div>
      )}

      <style>{`
        .review-mode-step { padding: 1rem; }
        .step-description { color: var(--theme-elevation-500); margin-bottom: 1.5rem; }
        .review-modes { display: flex; flex-direction: column; gap: 0.75rem; }
        .review-mode-option {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          border: 2px solid var(--theme-elevation-200);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .review-mode-option:hover { border-color: var(--theme-elevation-300); }
        .review-mode-option.selected {
          border-color: var(--theme-primary);
          background: var(--theme-primary-50);
        }
        .review-mode-option input { display: none; }
        .mode-icon { font-size: 1.5rem; }
        .mode-content { flex: 1; display: flex; flex-direction: column; }
        .mode-label { font-weight: 600; }
        .mode-description { font-size: 0.875rem; color: var(--theme-elevation-500); }
        .check-mark {
          width: 24px;
          height: 24px;
          background: var(--theme-primary);
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.875rem;
        }
        .auto-config {
          margin-top: 1.5rem;
          padding: 1rem;
          background: var(--theme-elevation-50);
          border-radius: 4px;
        }
        .auto-config h3 { font-size: 1rem; margin-bottom: 0.5rem; }
        .config-hint { font-size: 0.875rem; color: var(--theme-elevation-500); }
      `}</style>
    </div>
  )
}
