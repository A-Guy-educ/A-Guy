/**
 * Wizard Container
 *
 * Multi-step wizard for creating new conversions.
 *
 * @fileType component
 * @domain admin
 * @pattern wizard
 * @ai-summary Multi-step wizard for conversion creation
 */

'use client'

import { useCallback, useState } from 'react'

import { useRouter } from 'next/navigation'
import { ConfigStep } from './ConfigStep'
import { ConfirmStep } from './ConfirmStep'
import { PreviewStep } from './PreviewStep'
import { ReviewModeStep } from './ReviewModeStep'
import { RoundsStep } from './RoundsStep'
import { SourceStep } from './SourceStep'
import { WizardProgress } from './WizardProgress'

const STEPS = ['source', 'preview', 'config', 'rounds', 'review-mode', 'confirm'] as const

interface AdditionalRound {
  name: string
  promptId: string
  targetField: string
  triggerCondition: string
  order: number
  isEnabled: boolean
}

interface PageRangeConfig {
  start: number
  end?: number
  excludePages: number[]
}

interface SegmentationConfig {
  pagesPerSegment: number
}

interface ExtractionConfig {
  mode: string
  exerciseTypes: string[]
  customInstructions?: string
}

interface PromptConfig {
  extractorPromptId: string
  verifierPromptId: string
}

interface ConversionWizardProps {
  initialLessonId?: string
  initialMediaId?: string
}

interface WizardConfig {
  lessonId: string
  mediaId: string
  pageRange: PageRangeConfig
  segmentation: SegmentationConfig
  extraction: ExtractionConfig
  reviewMode: 'auto' | 'segment' | 'batch' | 'manual'
  prompts: PromptConfig
  additionalRounds: AdditionalRound[]
}

export function ConversionWizard({ initialLessonId, initialMediaId }: ConversionWizardProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<(typeof STEPS)[number]>('source')
  const [isLoading, setIsLoading] = useState(false)
  const [lessonTitle, _setLessonTitle] = useState('')
  const [mediaFilename, _setMediaFilename] = useState('')

  const [config, setConfig] = useState<WizardConfig>({
    lessonId: initialLessonId || '',
    mediaId: initialMediaId || '',
    pageRange: { start: 1, excludePages: [] },
    segmentation: { pagesPerSegment: 2 },
    extraction: { mode: 'structured', exerciseTypes: ['mcq', 'free_response', 'select'] },
    reviewMode: 'segment',
    prompts: { extractorPromptId: '', verifierPromptId: '' },
    additionalRounds: [],
  })

  const currentIndex = STEPS.indexOf(currentStep)

  const _handleNext = () => {
    const nextIndex = Math.min(currentIndex + 1, STEPS.length - 1)
    setCurrentStep(STEPS[nextIndex])
  }

  const handleBack = () => {
    const prevIndex = Math.max(currentIndex - 1, 0)
    setCurrentStep(STEPS[prevIndex])
  }

  const updateConfig = useCallback((updates: Partial<WizardConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }))
  }, [])

  const handleSourceChange = (data: { lessonId: string; mediaId: string }) => {
    updateConfig(data)
  }

  const handlePreviewChange = (data: { pageRange: PageRangeConfig }) => {
    updateConfig({ pageRange: data.pageRange })
  }

  const handleConfigChange = (data: {
    segmentation: SegmentationConfig
    extraction: ExtractionConfig
  }) => {
    updateConfig(data)
  }

  const handleRoundsChange = (rounds: AdditionalRound[]) => {
    updateConfig({ additionalRounds: rounds })
  }

  const handleReviewModeChange = (data: { reviewMode: WizardConfig['reviewMode'] }) => {
    updateConfig({ reviewMode: data.reviewMode })
  }

  const handleCreate = async () => {
    setIsLoading(true)
    try {
      // Create the conversion job
      const response = await fetch('/api/conversion-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lesson: config.lessonId,
          sourceMedia: config.mediaId,
          title: `Conversion - ${new Date().toISOString()}`,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create conversion job')
      }

      const { id: jobId } = await response.json()

      // Update with full config
      await fetch(`/api/conversion-jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            pageRange: config.pageRange,
            segmentation: config.segmentation,
            extraction: config.extraction,
            reviewMode: config.reviewMode,
          },
          prompts: {
            extractor: config.prompts.extractorPromptId,
            verifier: config.prompts.verifierPromptId,
          },
          additionalRounds: config.additionalRounds,
        }),
      })

      // Start the job
      await fetch(`/api/conversion-jobs/${jobId}/start`, {
        method: 'POST',
      })

      router.push(`/admin/conversion-jobs/${jobId}`)
    } catch (error) {
      console.error('Failed to create conversion:', error)
      alert('Failed to create conversion. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const renderStep = () => {
    switch (currentStep) {
      case 'source':
        return (
          <SourceStep
            lessonId={config.lessonId}
            mediaId={config.mediaId}
            onChange={handleSourceChange}
            onValidationChange={() => {}}
          />
        )
      case 'preview':
        return (
          <PreviewStep
            mediaId={config.mediaId}
            pageRange={config.pageRange}
            onChange={handlePreviewChange}
            onValidationChange={() => {}}
          />
        )
      case 'config':
        return (
          <ConfigStep
            segmentation={config.segmentation}
            extraction={config.extraction}
            onChange={handleConfigChange}
            onValidationChange={() => {}}
          />
        )
      case 'rounds':
        return (
          <RoundsStep
            rounds={config.additionalRounds}
            onChange={handleRoundsChange}
            onValidationChange={() => {}}
          />
        )
      case 'review-mode':
        return (
          <ReviewModeStep
            reviewMode={config.reviewMode}
            onChange={handleReviewModeChange}
            onValidationChange={() => {}}
          />
        )
      case 'confirm':
        return (
          <ConfirmStep
            config={config}
            lessonTitle={lessonTitle}
            mediaFilename={mediaFilename}
            onConfirm={handleCreate}
            onBack={handleBack}
            isCreating={isLoading}
          />
        )
    }
  }

  return (
    <div className="wizard-container">
      <WizardProgress currentStep={currentStep} />
      <div className="wizard-content">{renderStep()}</div>

      <style>{`
        .wizard-container { max-width: 800px; margin: 0 auto; padding: 1.5rem; }
        .wizard-content { margin-top: 1.5rem; }
      `}</style>
    </div>
  )
}
