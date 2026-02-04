/**
 * Enrichment Rounds Step
 *
 * Fourth step - configure additional LLM enrichment rounds
 *
 * @fileType component
 * @domain admin
 * @pattern wizard-step
 * @ai-summary Fourth wizard step for configuring enrichment rounds
 */

'use client'

import { useEffect, useState } from 'react'

interface AdditionalRound {
  name: string
  promptId: string
  targetField: string
  triggerCondition: string
  order: number
  isEnabled: boolean
}

interface Prompt {
  id: string
  name: string
}

interface RoundsStepProps {
  rounds: Array<{
    name: string
    promptId: string
    targetField: string
    triggerCondition: string
    order: number
    isEnabled: boolean
  }>
  onChange: (
    rounds: Array<{
      name: string
      promptId: string
      targetField: string
      triggerCondition: string
      order: number
      isEnabled: boolean
    }>,
  ) => void
  onValidationChange: (isValid: boolean) => void
}

export function RoundsStep({
  rounds: initialRounds,
  onChange,
  onValidationChange,
}: RoundsStepProps) {
  const [rounds, setRounds] = useState<AdditionalRound[]>(
    initialRounds.length > 0
      ? initialRounds
      : [
          {
            name: '',
            promptId: '',
            targetField: '',
            triggerCondition: 'always',
            order: 1,
            isEnabled: true,
          },
        ],
  )
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchPrompts() {
      try {
        const res = await fetch('/api/prompts?limit=100', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          setPrompts(data.docs || [])
        }
      } catch (error) {
        console.error('Failed to fetch prompts:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchPrompts()
  }, [])

  useEffect(() => {
    onValidationChange(true)
  }, [onChange, onValidationChange])

  const addRound = () => {
    const newRound: AdditionalRound = {
      name: '',
      promptId: '',
      targetField: '',
      triggerCondition: 'always',
      order: rounds.length + 1,
      isEnabled: true,
    }
    const updated = [...rounds, newRound]
    setRounds(updated)
    onChange(updated)
  }

  const removeRound = (index: number) => {
    const updated = rounds.filter((_, i) => i !== index).map((r, i) => ({ ...r, order: i + 1 }))
    setRounds(updated)
    onChange(updated)
  }

  const updateRound = (index: number, updates: Partial<AdditionalRound>) => {
    const updated = [...rounds]
    updated[index] = { ...updated[index], ...updates }
    setRounds(updated)
    onChange(updated)
  }

  const toggleRound = (index: number) => {
    updateRound(index, { isEnabled: !rounds[index].isEnabled })
  }

  if (isLoading) {
    return (
      <div className="wizard-step rounds-step">
        <div className="step-loading">Loading prompts...</div>
      </div>
    )
  }

  return (
    <div className="wizard-step rounds-step">
      <h2>Enrichment Rounds</h2>
      <p className="step-description">
        Configure additional LLM passes to enrich extracted exercises
      </p>

      {rounds.length === 0 ? (
        <div className="empty-rounds">
          <p>No enrichment rounds configured</p>
          <button onClick={addRound} className="btn-add-round">
            + Add Enrichment Round
          </button>
        </div>
      ) : (
        <div className="rounds-list">
          {rounds.map((round, index) => (
            <div key={index} className={`round-item ${!round.isEnabled ? 'disabled' : ''}`}>
              <div className="round-header">
                <span className="round-number">Round {index + 1}</span>
                <div className="round-actions">
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={round.isEnabled}
                      onChange={() => toggleRound(index)}
                    />
                    <span>{round.isEnabled ? 'Enabled' : 'Disabled'}</span>
                  </label>
                  <button onClick={() => removeRound(index)} className="btn-remove">
                    Remove
                  </button>
                </div>
              </div>

              <div className="round-fields">
                <div className="form-group">
                  <label>Round Name</label>
                  <input
                    type="text"
                    value={round.name}
                    onChange={(e) => updateRound(index, { name: e.target.value })}
                    placeholder="e.g., Add Examples"
                    className="form-input"
                    disabled={!round.isEnabled}
                  />
                </div>

                <div className="form-group">
                  <label>Prompt</label>
                  <select
                    value={round.promptId}
                    onChange={(e) => updateRound(index, { promptId: e.target.value })}
                    className="form-select"
                    disabled={!round.isEnabled}
                  >
                    <option value="">Select a prompt...</option>
                    {prompts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Target Field</label>
                  <input
                    type="text"
                    value={round.targetField}
                    onChange={(e) => updateRound(index, { targetField: e.target.value })}
                    placeholder="e.g., examples"
                    className="form-input"
                    disabled={!round.isEnabled}
                  />
                </div>

                <div className="form-group">
                  <label>Trigger Condition</label>
                  <select
                    value={round.triggerCondition}
                    onChange={(e) => updateRound(index, { triggerCondition: e.target.value })}
                    className="form-select"
                    disabled={!round.isEnabled}
                  >
                    <option value="always">Always</option>
                    <option value="has_images">Has Images</option>
                    <option value="has_tables">Has Tables</option>
                    <option value="low_confidence">Low Confidence Score</option>
                    <option value="complex">Complex Content</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {rounds.length > 0 && (
        <button onClick={addRound} className="btn-add-round">
          + Add Another Round
        </button>
      )}

      <style>{`
        .rounds-step { padding: 1rem; }
        .step-description { color: var(--theme-elevation-500); margin-bottom: 1.5rem; }
        .empty-rounds { text-align: center; padding: 2rem; background: var(--theme-elevation-50); border-radius: 4px; }
        .rounds-list { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1rem; }
        .round-item {
          border: 1px solid var(--theme-elevation-200);
          border-radius: 8px;
          overflow: hidden;
        }
        .round-item.disabled { opacity: 0.6; }
        .round-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1rem;
          background: var(--theme-elevation-50);
          border-bottom: 1px solid var(--theme-elevation-200);
        }
        .round-number { font-weight: 600; }
        .round-actions { display: flex; align-items: center; gap: 1rem; }
        .toggle-label { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; }
        .round-fields {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          padding: 1rem;
        }
        .form-group label { display: block; font-size: 0.75rem; font-weight: 500; margin-bottom: 0.25rem; }
        .form-input, .form-select { width: 100%; padding: 0.5rem; border: 1px solid var(--theme-elevation-200); border-radius: 4px; }
        .btn-add-round {
          width: 100%;
          padding: 0.75rem;
          border: 2px dashed var(--theme-elevation-200);
          border-radius: 4px;
          background: transparent;
          color: var(--theme-elevation-500);
          cursor: pointer;
        }
        .btn-add-round:hover { border-color: var(--theme-primary); color: var(--theme-primary); }
        .btn-remove {
          padding: 0.25rem 0.5rem;
          border: none;
          background: #fee2e2;
          color: #dc2626;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.75rem;
        }
        .step-loading { text-align: center; padding: 2rem; color: var(--theme-elevation-500); }
      `}</style>
    </div>
  )
}
