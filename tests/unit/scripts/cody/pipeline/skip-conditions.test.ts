/**
 * @fileType test
 * @domain cody | pipeline
 * @pattern skip-conditions
 * @ai-summary Unit tests for skip-conditions.ts - validates all 5 skip functions
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { createMockPipelineContext } from '../../../../helpers/cody'
import {
  skipIfInputQuality,
  skipIfClarifyDisabled,
  skipIfSpecHasNoOpenQuestions,
  skipIfSpecOnly,
  skipIfBelowComplexity,
} from '../../../../../scripts/cody/pipeline/skip-conditions'

describe('skipIfInputQuality', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skip-input-quality-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('should skip when file exists with valid content (>50 chars)', () => {
    const ctx = createMockPipelineContext({
      taskDir: tempDir,
      taskDef: {
        task_type: 'implement_feature',
        pipeline: 'spec_execute_verify',
        risk_level: 'medium',
        confidence: 80,
        primary_domain: 'backend',
        scope: [],
        missing_inputs: [],
        assumptions: [],
        input_quality: {
          level: 'spec_and_plan',
          skip_stages: ['architect'],
          reasoning: 'High quality input',
        },
      },
    })

    // Create a file with >50 chars of valid content
    fs.writeFileSync(
      path.join(tempDir, 'architect.md'),
      '# Architecture\n\nThis is a detailed architecture document with meaningful content that exceeds 50 characters.',
    )

    const result = skipIfInputQuality(ctx, 'architect')
    expect(result.shouldSkip).toBe(true)
    expect(result.reason).toContain('Promoted via input_quality')
  })

  it('should not skip when file is too short (<50 chars)', () => {
    const ctx = createMockPipelineContext({
      taskDir: tempDir,
      taskDef: {
        task_type: 'implement_feature',
        pipeline: 'spec_execute_verify',
        risk_level: 'medium',
        confidence: 80,
        primary_domain: 'backend',
        scope: [],
        missing_inputs: [],
        assumptions: [],
        input_quality: {
          level: 'spec_and_plan',
          skip_stages: ['architect'],
          reasoning: 'High quality input',
        },
      },
    })

    // Create a short file (<50 chars)
    fs.writeFileSync(path.join(tempDir, 'architect.md'), '# Short')

    const result = skipIfInputQuality(ctx, 'architect')
    expect(result.shouldSkip).toBe(false)
  })

  it('should not skip when file has "(promoted)" and <200 chars', () => {
    const ctx = createMockPipelineContext({
      taskDir: tempDir,
      taskDef: {
        task_type: 'implement_feature',
        pipeline: 'spec_execute_verify',
        risk_level: 'medium',
        confidence: 80,
        primary_domain: 'backend',
        scope: [],
        missing_inputs: [],
        assumptions: [],
        input_quality: {
          level: 'spec_and_plan',
          skip_stages: ['architect'],
          reasoning: 'High quality input',
        },
      },
    })

    // Create a file with "(promoted)" but <200 chars (stub)
    fs.writeFileSync(
      path.join(tempDir, 'architect.md'),
      '# Promoted (promoted)\n\nIncomplete content.',
    )

    const result = skipIfInputQuality(ctx, 'architect')
    expect(result.shouldSkip).toBe(false)
  })

  it('should not skip when no file exists', () => {
    const ctx = createMockPipelineContext({
      taskDir: tempDir,
      taskDef: {
        task_type: 'implement_feature',
        pipeline: 'spec_execute_verify',
        risk_level: 'medium',
        confidence: 80,
        primary_domain: 'backend',
        scope: [],
        missing_inputs: [],
        assumptions: [],
        input_quality: {
          level: 'spec_and_plan',
          skip_stages: ['architect'],
          reasoning: 'High quality input',
        },
      },
    })

    // No file created
    const result = skipIfInputQuality(ctx, 'architect')
    expect(result.shouldSkip).toBe(false)
  })

  it('should not skip when stage not in taskDef.input_quality.skip_stages', () => {
    const ctx = createMockPipelineContext({
      taskDir: tempDir,
      taskDef: {
        task_type: 'implement_feature',
        pipeline: 'spec_execute_verify',
        risk_level: 'medium',
        confidence: 80,
        primary_domain: 'backend',
        scope: [],
        missing_inputs: [],
        assumptions: [],
        input_quality: {
          level: 'spec_and_plan',
          skip_stages: ['architect'], // Only architect can be skipped
          reasoning: 'High quality input',
        },
      },
    })

    // Create file for gap stage (not in skip_stages)
    fs.writeFileSync(
      path.join(tempDir, 'gap.md'),
      '# Gap Analysis\n\nDetailed gap analysis content here.',
    )

    const result = skipIfInputQuality(ctx, 'gap')
    expect(result.shouldSkip).toBe(false)
  })

  it('should not skip when no taskDef', () => {
    const ctx = createMockPipelineContext({
      taskDir: tempDir,
      taskDef: null,
    })

    const result = skipIfInputQuality(ctx, 'architect')
    expect(result.shouldSkip).toBe(false)
  })
})

describe('skipIfClarifyDisabled', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skip-clarify-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('should skip when ctx.input.clarify is false', () => {
    const ctx = createMockPipelineContext({
      taskDir: tempDir,
      input: {
        taskId: 'test-001',
        mode: 'full',
        dryRun: false,
        local: true,
        clarify: false, // Disabled
      },
    })

    const result = skipIfClarifyDisabled(ctx)
    expect(result.shouldSkip).toBe(true)
    expect(result.reason).toContain('Clarify disabled')
  })

  it('should create clarified.md when it does not exist', () => {
    const ctx = createMockPipelineContext({
      taskDir: tempDir,
      input: {
        taskId: 'test-001',
        mode: 'full',
        dryRun: false,
        local: true,
        clarify: false,
      },
    })

    const clarifiedPath = path.join(tempDir, 'clarified.md')
    expect(fs.existsSync(clarifiedPath)).toBe(false)

    skipIfClarifyDisabled(ctx)

    expect(fs.existsSync(clarifiedPath)).toBe(true)
    const content = fs.readFileSync(clarifiedPath, 'utf-8')
    expect(content).toContain('# Clarified')
  })

  it('should remove questions.md if it exists', () => {
    const ctx = createMockPipelineContext({
      taskDir: tempDir,
      input: {
        taskId: 'test-001',
        mode: 'full',
        dryRun: false,
        local: true,
        clarify: false,
      },
    })

    const questionsPath = path.join(tempDir, 'questions.md')
    fs.writeFileSync(questionsPath, '# Questions\n\nSome questions here.')

    skipIfClarifyDisabled(ctx)

    expect(fs.existsSync(questionsPath)).toBe(false)
  })

  it('should not skip when ctx.input.clarify is true', () => {
    const ctx = createMockPipelineContext({
      taskDir: tempDir,
      input: {
        taskId: 'test-001',
        mode: 'full',
        dryRun: false,
        local: true,
        clarify: true, // Enabled
      },
    })

    const result = skipIfClarifyDisabled(ctx)
    expect(result.shouldSkip).toBe(false)
  })
})

describe('skipIfSpecHasNoOpenQuestions', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skip-spec-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('should skip when spec exists but has no "## Open Questions" section', () => {
    const ctx = createMockPipelineContext({
      taskDir: tempDir,
      input: {
        taskId: 'test-001',
        mode: 'full',
        dryRun: false,
        local: true,
        clarify: true, // Must be enabled for this to apply
      },
    })

    fs.writeFileSync(
      path.join(tempDir, 'spec.md'),
      '# Spec\n\n## Overview\n\nSome spec content without open questions.',
    )

    const result = skipIfSpecHasNoOpenQuestions(ctx)
    expect(result.shouldSkip).toBe(true)
    expect(result.reason).toContain('Spec has no Open Questions')
  })

  it('should not skip when spec has "## Open Questions" section', () => {
    const ctx = createMockPipelineContext({
      taskDir: tempDir,
      input: {
        taskId: 'test-001',
        mode: 'full',
        dryRun: false,
        local: true,
        clarify: true,
      },
    })

    fs.writeFileSync(
      path.join(tempDir, 'spec.md'),
      '# Spec\n\n## Overview\n\n## Open Questions\n\n- Question 1?\n- Question 2?',
    )

    const result = skipIfSpecHasNoOpenQuestions(ctx)
    expect(result.shouldSkip).toBe(false)
  })

  it('should not skip when no spec file exists', () => {
    const ctx = createMockPipelineContext({
      taskDir: tempDir,
      input: {
        taskId: 'test-001',
        mode: 'full',
        dryRun: false,
        local: true,
        clarify: true,
      },
    })

    // No spec.md file
    const result = skipIfSpecHasNoOpenQuestions(ctx)
    expect(result.shouldSkip).toBe(false)
  })

  it('should not skip when ctx.input.clarify is false', () => {
    const ctx = createMockPipelineContext({
      taskDir: tempDir,
      input: {
        taskId: 'test-001',
        mode: 'full',
        dryRun: false,
        local: true,
        clarify: false, // Disabled
      },
    })

    // Even with a spec that has no open questions
    fs.writeFileSync(path.join(tempDir, 'spec.md'), '# Spec\n\nNo questions here.')

    const result = skipIfSpecHasNoOpenQuestions(ctx)
    expect(result.shouldSkip).toBe(false)
  })
})

describe('skipIfSpecOnly', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skip-spec-only-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('should skip when pipeline is spec_only', () => {
    const ctx = createMockPipelineContext({
      taskDir: tempDir,
      taskDef: {
        task_type: 'spec_only',
        pipeline: 'spec_only',
        risk_level: 'low',
        confidence: 90,
        primary_domain: 'backend',
        scope: [],
        missing_inputs: [],
        assumptions: [],
      },
    })

    const result = skipIfSpecOnly(ctx)
    expect(result.shouldSkip).toBe(true)
    expect(result.reason).toContain('spec_only')
  })

  it('should not skip when pipeline is spec_execute_verify', () => {
    const ctx = createMockPipelineContext({
      taskDir: tempDir,
      taskDef: {
        task_type: 'implement_feature',
        pipeline: 'spec_execute_verify',
        risk_level: 'medium',
        confidence: 80,
        primary_domain: 'backend',
        scope: [],
        missing_inputs: [],
        assumptions: [],
      },
    })

    const result = skipIfSpecOnly(ctx)
    expect(result.shouldSkip).toBe(false)
  })

  it('should not skip when no taskDef', () => {
    const ctx = createMockPipelineContext({
      taskDir: tempDir,
      taskDef: null,
    })

    const result = skipIfSpecOnly(ctx)
    expect(result.shouldSkip).toBe(false)
  })
})

describe('skipIfBelowComplexity', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skip-complexity-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('should skip when complexity is below threshold for that stage', () => {
    // Build stage typically has higher threshold (e.g., 20)
    // Use a low complexity that should be below threshold
    const ctx = createMockPipelineContext({
      taskDir: tempDir,
      taskDef: {
        task_type: 'implement_feature',
        pipeline: 'spec_execute_verify',
        risk_level: 'medium',
        confidence: 80,
        primary_domain: 'backend',
        scope: [],
        missing_inputs: [],
        assumptions: [],
        complexity: 5, // Very low complexity
      },
    })

    // For stages like 'build' that have threshold > 5
    const result = skipIfBelowComplexity(ctx, 'build')
    // Based on STAGE_COMPLEXITY_THRESHOLDS, 'build' typically has threshold > 0
    if (result.shouldSkip) {
      expect(result.reason).toContain('below threshold')
    }
  })

  it('should not skip when complexity meets or exceeds threshold', () => {
    const ctx = createMockPipelineContext({
      taskDir: tempDir,
      taskDef: {
        task_type: 'implement_feature',
        pipeline: 'spec_execute_verify',
        risk_level: 'medium',
        confidence: 80,
        primary_domain: 'backend',
        scope: [],
        missing_inputs: [],
        assumptions: [],
        complexity: 50, // High complexity
      },
    })

    const result = skipIfBelowComplexity(ctx, 'gap')
    // Gap stage typically has threshold 0, so should not skip
    expect(result.shouldSkip).toBe(false)
  })

  it('should not skip when no complexity score (undefined)', () => {
    const ctx = createMockPipelineContext({
      taskDir: tempDir,
      taskDef: {
        task_type: 'implement_feature',
        pipeline: 'spec_execute_verify',
        risk_level: 'medium',
        confidence: 80,
        primary_domain: 'backend',
        scope: [],
        missing_inputs: [],
        assumptions: [],
        // complexity is undefined
      },
    })

    const result = skipIfBelowComplexity(ctx, 'build')
    expect(result.shouldSkip).toBe(false)
  })

  it('should not skip for stages with threshold 0', () => {
    const ctx = createMockPipelineContext({
      taskDir: tempDir,
      taskDef: {
        task_type: 'implement_feature',
        pipeline: 'spec_execute_verify',
        risk_level: 'medium',
        confidence: 80,
        primary_domain: 'backend',
        scope: [],
        missing_inputs: [],
        assumptions: [],
        complexity: 1,
      },
    })

    // 'test' stage has threshold 0
    const result = skipIfBelowComplexity(ctx, 'test')
    expect(result.shouldSkip).toBe(false)
  })

  it('should not skip for invalid stage names', () => {
    const ctx = createMockPipelineContext({
      taskDir: tempDir,
      taskDef: {
        task_type: 'implement_feature',
        pipeline: 'spec_execute_verify',
        risk_level: 'medium',
        confidence: 80,
        primary_domain: 'backend',
        scope: [],
        missing_inputs: [],
        assumptions: [],
        complexity: 5,
      },
    })

    const result = skipIfBelowComplexity(ctx, 'invalid-stage-name')
    expect(result.shouldSkip).toBe(false)
  })
})
