import { z } from 'zod'

export const ImprovementTypeSchema = z.enum([
  'DOC',
  'INDEX',
  'GUARDRAIL',
  'PROMPT',
  'AUTOMATION',
  'NAMING_STRUCTURE',
])

export const ClassificationSchema = z.enum(['SPEC_PROMPT', 'CONTEXT', 'EXECUTION', 'UNKNOWN'])

export const RunStateSchema = z.enum(['SUCCESS', 'FAILURE', 'ABORTED'])

export const RetrySafeSchema = z.enum(['YES', 'NO', 'UNKNOWN'])

export const ChosenImprovementSchema = z.object({
  type: ImprovementTypeSchema,
  title: z.string().min(1).describe('Short imperative title'),
  rationale: z.string().min(1).max(500).describe('1-2 sentences'),
  whereItLives: z.array(z.string().min(1)).min(1).describe('File path(s) or rule identifier'),
  acceptanceCriteria: z
    .array(z.string().min(1))
    .min(2)
    .max(5)
    .describe('Testable/verifiable checks'),
})

export const FailureAnalysisSchema = z.object({
  rootCause: z.string().min(1).max(300).describe('One concrete sentence'),
  earliestMissedSignal: z.string().min(1).max(300),
  responsibilityBoundary: z.enum(['orchestrator', 'verifier', 'executor', 'planner', 'spec']),
})

export const AuditorOutputSchema = z
  .object({
    runId: z.string().min(1),
    taskId: z.string().min(1),
    runState: RunStateSchema,
    classification: ClassificationSchema,
    processDelta: z
      .array(z.string().min(1))
      .min(1)
      .max(4)
      .describe('Short bullets on what happened'),
    chosenImprovement: ChosenImprovementSchema,
    canClose: z.boolean(),
    followUpRequired: z.boolean(),
    retrySafe: RetrySafeSchema,
    notes: z.array(z.string()).max(3).optional(),
    failureAnalysis: FailureAnalysisSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.runState === 'FAILURE' || data.runState === 'ABORTED') {
      if (!data.failureAnalysis) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'failureAnalysis is required on FAILURE/ABORTED runs',
          path: ['failureAnalysis'],
        })
      }
      if (data.classification === 'UNKNOWN' && (!data.notes || data.notes.length === 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'notes with justification required when classification is UNKNOWN on FAILURE/ABORTED',
          path: ['notes'],
        })
      }
    }
  })

export type AuditorOutput = z.infer<typeof AuditorOutputSchema>
export type ChosenImprovement = z.infer<typeof ChosenImprovementSchema>
export type FailureAnalysis = z.infer<typeof FailureAnalysisSchema>
