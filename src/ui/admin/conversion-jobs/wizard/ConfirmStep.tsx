/**
 * Confirmation Step
 *
 * Final step - review all settings and start conversion
 *
 * @fileType component
 * @domain admin
 * @pattern wizard-step
 * @ai-summary Final wizard step for confirmation and start
 */

'use client'

interface ConfirmStepProps {
  config: {
    lessonId: string
    mediaId: string
    pageRange: { start: number; end?: number; excludePages: number[] }
    segmentation: { pagesPerSegment: number }
    extraction: { mode: string; exerciseTypes: string[]; customInstructions?: string }
    reviewMode: string
    additionalRounds: Array<{
      name: string
      promptId: string
      targetField: string
      triggerCondition: string
      order: number
      isEnabled: boolean
    }>
  }
  lessonTitle?: string
  mediaFilename?: string
  onConfirm: () => void
  onBack: () => void
  isCreating?: boolean
}

export function ConfirmStep({
  config,
  lessonTitle,
  mediaFilename,
  onConfirm,
  onBack,
  isCreating,
}: ConfirmStepProps) {
  const pageRangeText = config.pageRange.end
    ? `Pages ${config.pageRange.start} - ${config.pageRange.end}`
    : `Page ${config.pageRange.start} onwards`

  const roundsText =
    config.additionalRounds.filter((r) => r.isEnabled).length === 0
      ? 'None'
      : config.additionalRounds
          .filter((r) => r.isEnabled)
          .map((r) => r.name)
          .join(', ')

  return (
    <div className="wizard-step confirm-step">
      <h2>Confirm Configuration</h2>
      <p className="step-description">Review your settings before starting the conversion</p>

      <div className="summary-section">
        <div className="summary-card">
          <h3>Source</h3>
          <dl>
            <dt>Lesson</dt>
            <dd>{lessonTitle || config.lessonId}</dd>
            <dt>Media</dt>
            <dd>{mediaFilename || config.mediaId}</dd>
          </dl>
        </div>

        <div className="summary-card">
          <h3>Page Range</h3>
          <dl>
            <dt>Selected Pages</dt>
            <dd>{pageRangeText}</dd>
            <dt>Segment Size</dt>
            <dd>{config.segmentation.pagesPerSegment} pages per segment</dd>
          </dl>
        </div>

        <div className="summary-card">
          <h3>Extraction</h3>
          <dl>
            <dt>Mode</dt>
            <dd style={{ textTransform: 'capitalize' }}>{config.extraction.mode}</dd>
            <dt>Exercise Types</dt>
            <dd>{config.extraction.exerciseTypes.join(', ')}</dd>
            {config.extraction.customInstructions && (
              <>
                <dt>Instructions</dt>
                <dd>{config.extraction.customInstructions}</dd>
              </>
            )}
          </dl>
        </div>

        <div className="summary-card">
          <h3>Review</h3>
          <dl>
            <dt>Review Mode</dt>
            <dd style={{ textTransform: 'capitalize' }}>{config.reviewMode}</dd>
            <dt>Enrichment Rounds</dt>
            <dd>{roundsText}</dd>
          </dl>
        </div>
      </div>

      <div className="confirmation-notice">
        <p>
          <strong>Ready to start!</strong>
        </p>
        <p>
          The conversion will begin immediately. Progress can be monitored in the job detail page.
        </p>
      </div>

      <div className="step-actions">
        <button onClick={onBack} className="btn-back" disabled={isCreating}>
          Back
        </button>
        <button onClick={onConfirm} className="btn-confirm" disabled={isCreating}>
          {isCreating ? 'Creating...' : 'Start Conversion'}
        </button>
      </div>

      <style>{`
        .confirm-step { padding: 1rem; }
        .step-description { color: var(--theme-elevation-500); margin-bottom: 1.5rem; }
        .summary-section {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        .summary-card {
          padding: 1rem;
          border: 1px solid var(--theme-elevation-200);
          border-radius: 8px;
        }
        .summary-card h3 {
          font-size: 0.875rem;
          font-weight: 600;
          margin-bottom: 0.75rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid var(--theme-elevation-100);
        }
        .summary-card dl { margin: 0; }
        .summary-card dt {
          font-size: 0.75rem;
          color: var(--theme-elevation-500);
          margin-top: 0.5rem;
        }
        .summary-card dd {
          margin: 0;
          font-weight: 500;
        }
        .confirmation-notice {
          padding: 1rem;
          background: var(--theme-primary-50);
          border: 1px solid var(--theme-primary);
          border-radius: 8px;
          margin-bottom: 1.5rem;
        }
        .confirmation-notice p { margin: 0.25rem 0; }
        .step-actions {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
        }
        .btn-back, .btn-confirm {
          padding: 0.75rem 1.5rem;
          border-radius: 4px;
          font-weight: 500;
          cursor: pointer;
        }
        .btn-back {
          background: var(--theme-elevation-100);
          border: none;
        }
        .btn-confirm {
          background: var(--theme-primary);
          color: white;
          border: none;
        }
        .btn-confirm:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  )
}
