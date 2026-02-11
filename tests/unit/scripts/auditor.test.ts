import { describe, it, expect } from 'vitest'
import { AuditorOutputSchema } from '../../../scripts/pipeline/auditor-output.schema'
import { RunBundleSchema } from '../../../scripts/pipeline/run-bundle.schema'
import { generateRunId } from '../../../scripts/pipeline/auditor-persistence'

describe('AuditorOutputSchema', () => {
  const validSuccessOutput = {
    runId: 'run-20260210-153000',
    taskId: '20260210-improver',
    runState: 'SUCCESS' as const,
    classification: 'CONTEXT' as const,
    processDelta: ['Build agent spent 3 retries finding the correct file path'],
    chosenImprovement: {
      type: 'INDEX' as const,
      title: 'Add file-path index for exercise conversion pipeline',
      rationale: 'Build agent wasted cycles finding file locations that should be indexed.',
      whereItLives: ['.ai-docs/indexes/pattern-index.json'],
      acceptanceCriteria: [
        'pattern-index.json includes exercise-conversion entries',
        'Build agent can find files in < 1 lookup',
      ],
    },
    canClose: true,
    followUpRequired: false,
    retrySafe: 'YES' as const,
  }

  const validFailureOutput = {
    ...validSuccessOutput,
    runState: 'FAILURE' as const,
    canClose: false,
    followUpRequired: true,
    retrySafe: 'NO' as const,
    classification: 'EXECUTION' as const,
    failureAnalysis: {
      rootCause:
        'Verifier failed because generated types were not regenerated after schema change.',
      earliestMissedSignal:
        'Build agent should run pnpm generate:types after modifying collections.',
      responsibilityBoundary: 'executor' as const,
    },
  }

  it('accepts valid success output', () => {
    expect(AuditorOutputSchema.safeParse(validSuccessOutput).success).toBe(true)
  })

  it('accepts valid failure output', () => {
    expect(AuditorOutputSchema.safeParse(validFailureOutput).success).toBe(true)
  })

  it('rejects empty processDelta', () => {
    const invalid = { ...validSuccessOutput, processDelta: [] }
    expect(AuditorOutputSchema.safeParse(invalid).success).toBe(false)
  })

  it('rejects more than 4 processDelta bullets', () => {
    const invalid = {
      ...validSuccessOutput,
      processDelta: ['1', '2', '3', '4', '5'],
    }
    expect(AuditorOutputSchema.safeParse(invalid).success).toBe(false)
  })

  it('rejects empty whereItLives', () => {
    const invalid = {
      ...validSuccessOutput,
      chosenImprovement: {
        ...validSuccessOutput.chosenImprovement,
        whereItLives: [],
      },
    }
    expect(AuditorOutputSchema.safeParse(invalid).success).toBe(false)
  })

  it('rejects fewer than 2 acceptanceCriteria', () => {
    const invalid = {
      ...validSuccessOutput,
      chosenImprovement: {
        ...validSuccessOutput.chosenImprovement,
        acceptanceCriteria: ['only one'],
      },
    }
    expect(AuditorOutputSchema.safeParse(invalid).success).toBe(false)
  })

  it('rejects more than 5 acceptanceCriteria', () => {
    const invalid = {
      ...validSuccessOutput,
      chosenImprovement: {
        ...validSuccessOutput.chosenImprovement,
        acceptanceCriteria: ['1', '2', '3', '4', '5', '6'],
      },
    }
    expect(AuditorOutputSchema.safeParse(invalid).success).toBe(false)
  })

  it('rejects missing failureAnalysis on failure', () => {
    const invalid = {
      ...validSuccessOutput,
      runState: 'FAILURE' as const,
      canClose: false,
    }
    expect(AuditorOutputSchema.safeParse(invalid).success).toBe(false)
  })

  it('rejects UNKNOWN classification without justification on failure', () => {
    const invalid = {
      ...validFailureOutput,
      classification: 'UNKNOWN' as const,
      notes: undefined,
    }
    expect(AuditorOutputSchema.safeParse(invalid).success).toBe(false)
  })

  it('accepts UNKNOWN classification with justification on failure', () => {
    const valid = {
      ...validFailureOutput,
      classification: 'UNKNOWN' as const,
      notes: ['Insufficient logs to determine root cause'],
    }
    expect(AuditorOutputSchema.safeParse(valid).success).toBe(true)
  })
})

describe('RunBundleSchema', () => {
  it('accepts valid run bundle', () => {
    const bundle = {
      runId: 'run-20260210-153000',
      taskId: 'test-task',
      taskTitle: 'Test Task',
      taskSpecPath: '.tasks/test-task/spec.md',
      orchestratorTimeline: [
        {
          agent: 'build',
          startedAt: '2026-02-10T15:30:00Z',
          completedAt: '2026-02-10T15:45:00Z',
          state: 'completed' as const,
        },
      ],
      agentOutputs: [
        {
          agentName: 'build',
          state: 'completed' as const,
          summary: 'Built successfully',
        },
      ],
      finalState: 'SUCCESS' as const,
      primaryArtifacts: {
        diffSummary: '3 files changed',
        filesChanged: ['src/a.ts', 'src/b.ts'],
      },
    }
    expect(RunBundleSchema.safeParse(bundle).success).toBe(true)
  })

  it('accepts bundle with optional fields', () => {
    const bundle = {
      runId: 'run-20260210-153000',
      taskId: 'test-task',
      taskTitle: 'Test Task',
      taskSpecPath: '.tasks/test-task/spec.md',
      orchestratorTimeline: [
        {
          agent: 'build',
          startedAt: '2026-02-10T15:30:00Z',
          completedAt: '2026-02-10T15:45:00Z',
          state: 'completed' as const,
        },
      ],
      agentOutputs: [
        {
          agentName: 'build',
          state: 'completed' as const,
          summary: 'Built successfully',
          filesModified: ['src/a.ts'],
          duration: '15s',
        },
      ],
      finalState: 'SUCCESS' as const,
      primaryArtifacts: {
        diffSummary: '3 files changed',
        filesChanged: ['src/a.ts', 'src/b.ts'],
        docsChanged: ['docs/a.md'],
      },
      fullLogs: '...logs...',
      toolErrors: ['Error: something'],
      ciOutput: 'verify report',
      costMetrics: {
        totalTokens: 1000,
        duration: '30s',
      },
    }
    expect(RunBundleSchema.safeParse(bundle).success).toBe(true)
  })
})

describe('generateRunId', () => {
  it('produces run-YYYYMMDD-HHMMSS format', () => {
    const id = generateRunId()
    expect(id).toMatch(/^run-\d{8}-\d{6}$/)
  })
})
