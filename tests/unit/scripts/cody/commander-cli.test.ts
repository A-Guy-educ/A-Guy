import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { parseCliArgs } from '../../../../scripts/cody/cody-utils'

describe('commander-based CLI parsing', () => {
  // Save and clear Cody env vars to prevent CI environment pollution.
  // When tests run inside a Cody pipeline, TASK_ID and other env vars are set,
  // which causes parseCliArgs([]) to read them instead of auto-generating values.
  const CODY_ENV_KEYS = [
    'TASK_ID',
    'MODE',
    'DRY_RUN',
    'FEEDBACK',
    'FROM_STAGE',
    'CLARIFY',
    'ISSUE_NUMBER',
    'TRIGGER_TYPE',
    'RUN_ID',
    'RUN_URL',
    'VERSION',
    'FRESH',
    'COMPLEXITY',
    'COMMENT_BODY',
  ]
  const savedEnv: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const key of CODY_ENV_KEYS) {
      savedEnv[key] = process.env[key]
      delete process.env[key]
    }
  })

  afterEach(() => {
    for (const key of CODY_ENV_KEYS) {
      if (savedEnv[key] !== undefined) {
        process.env[key] = savedEnv[key]
      } else {
        delete process.env[key]
      }
    }
  })

  it('parses --task-id correctly', () => {
    const result = parseCliArgs(['--task-id', '260225-my-task'])
    expect(result.taskId).toBe('260225-my-task')
  })

  it('parses --mode correctly', () => {
    const result = parseCliArgs(['--mode', 'spec'])
    expect(result.mode).toBe('spec')
  })

  it('parses boolean flags', () => {
    const result = parseCliArgs(['--dry-run', '--local', '--fresh'])
    expect(result.dryRun).toBe(true)
    expect(result.local).toBe(true)
    expect(result.fresh).toBe(true)
  })

  it('parses --issue-number as number', () => {
    const result = parseCliArgs(['--issue-number', '42'])
    expect(result.issueNumber).toBe(42)
  })

  it('parses --auto control mode flag', () => {
    const autoResult = parseCliArgs(['--auto'])
    expect(autoResult.controlMode).toBe('auto')
  })

  it('parses --gate control mode flag', () => {
    const gateResult = parseCliArgs(['--gate'])
    expect(gateResult.controlMode).toBe('risk-gated')
  })

  it('parses --hard-stop control mode flag', () => {
    const hardResult = parseCliArgs(['--hard-stop'])
    expect(hardResult.controlMode).toBe('hard-stop')
  })

  it('handles --key=value format', () => {
    const result = parseCliArgs(['--task-id=260225-my-task', '--mode=impl'])
    expect(result.taskId).toBe('260225-my-task')
    expect(result.mode).toBe('impl')
  })

  it('handles empty args', () => {
    const result = parseCliArgs([])
    expect(result.mode).toBe('full')
    // Empty args triggers auto-generation of taskId
    expect(result.taskId).toMatch(/^\d{6}-auto-\d{3}$/)
  })

  it('parses --file correctly', () => {
    const result = parseCliArgs(['--file', 'path/to/task.md'])
    expect(result.file).toBe('path/to/task.md')
  })

  it('parses --feedback correctly', () => {
    const result = parseCliArgs(['--feedback', 'fix the tests'])
    expect(result.feedback).toBe('fix the tests')
  })

  it('parses --from stage correctly (alias resolves)', () => {
    const result = parseCliArgs(['--from', 'build'])
    expect(result.fromStage).toBe('gsd-execute')
  })

  it('parses --version correctly', () => {
    const result = parseCliArgs(['--version', 'v1.2.3'])
    expect(result.version).toBe('v1.2.3')
  })

  it('parses --run-id and --run-url correctly', () => {
    const result = parseCliArgs([
      '--run-id',
      '123456',
      '--run-url',
      'https://github.com/owner/repo/actions/runs/123456',
    ])
    expect(result.runId).toBe('123456')
    expect(result.runUrl).toBe('https://github.com/owner/repo/actions/runs/123456')
  })

  it('parses --trigger-type correctly', () => {
    const result = parseCliArgs(['--trigger-type', 'dispatch'])
    expect(result.triggerType).toBe('dispatch')
  })

  it('parses --clarify flag', () => {
    const result = parseCliArgs(['--clarify'])
    expect(result.clarify).toBe(true)
  })

  it('parses --complexity correctly', () => {
    const result = parseCliArgs(['--complexity', '75'])
    expect(result.complexityOverride).toBe(75)
  })

  it('parses --is-pull-request flag', () => {
    const result = parseCliArgs(['--is-pull-request'])
    expect(result.isPullRequest).toBe(true)
  })

  it('parses positional mode argument', () => {
    const result = parseCliArgs(['spec'])
    expect(result.mode).toBe('spec')
  })

  it('parses positional file argument', () => {
    const result = parseCliArgs(['path/to/feature.md'])
    expect(result.file).toBe('path/to/feature.md')
  })

  it('rejects invalid mode', () => {
    expect(() => parseCliArgs(['--mode', 'invalid'])).toThrow('Invalid mode')
  })

  it('rejects invalid stage', () => {
    expect(() => parseCliArgs(['--from', 'invalid-stage'])).toThrow('Invalid stage')
  })

  it('rejects invalid complexity value', () => {
    expect(() => parseCliArgs(['--complexity', '150'])).toThrow('Invalid --complexity value')
  })

  it('parses --github flag correctly', () => {
    const result = parseCliArgs(['--github'])
    expect(result.local).toBe(false)
  })

  it('parses --ci flag correctly', () => {
    const result = parseCliArgs(['--ci'])
    expect(result.local).toBe(false)
  })
})
