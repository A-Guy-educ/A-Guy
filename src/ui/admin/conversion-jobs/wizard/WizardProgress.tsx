/**
 * Wizard Progress Component
 *
 * Step indicator for the conversion wizard.
 *
 * @fileType component
 * @domain admin
 * @pattern progress-indicator
 * @ai-summary Step progress indicator for wizard flow
 */

'use client'

const STEPS = [
  { key: 'source', label: 'Source' },
  { key: 'preview', label: 'Preview' },
  { key: 'config', label: 'Config' },
  { key: 'rounds', label: 'Rounds' },
  { key: 'review-mode', label: 'Review' },
  { key: 'confirm', label: 'Confirm' },
] as const

interface WizardProgressProps {
  currentStep: (typeof STEPS)[number]['key']
  onStepClick?: (step: (typeof STEPS)[number]['key']) => void
}

export function WizardProgress({ currentStep, onStepClick }: WizardProgressProps) {
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep)

  return (
    <nav aria-label="Progress" className="mb-8">
      <ol className="flex items-center">
        {STEPS.map((step, index) => {
          const isCompleted = index < currentIndex
          const isCurrent = index === currentIndex

          return (
            <li key={step.key} className={`relative ${index !== STEPS.length - 1 ? 'flex-1' : ''}`}>
              {/* Connector */}
              {index !== STEPS.length - 1 && (
                <div
                  className={`absolute left-1/2 top-4 h-0.5 w-full ${
                    isCompleted ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                  aria-hidden="true"
                />
              )}

              {/* Step Circle */}
              <div className="relative flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => onStepClick?.(step.key)}
                  disabled={!onStepClick || isCompleted}
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    isCompleted
                      ? 'bg-blue-600 text-white'
                      : isCurrent
                        ? 'bg-blue-600 text-white ring-2 ring-offset-2 ring-blue-600'
                        : 'bg-white border-2 border-gray-300 text-gray-500'
                  } ${onStepClick && !isCompleted ? 'cursor-pointer hover:border-blue-400' : ''}`}
                >
                  {isCompleted ? (
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </button>
              </div>

              {/* Label */}
              <div className="mt-2 text-center">
                <span
                  className={`text-sm ${isCurrent ? 'font-medium text-blue-600' : 'text-gray-500'}`}
                >
                  {step.label}
                </span>
              </div>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
