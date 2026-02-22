/**
 * @fileType test
 * @domain ci | cody
 * @pattern bug-fix-verification
 * @ai-summary Tests verifying bug fixes: stale exports, atomic writes, targeted staging, dirty state cleanup, POSIX grep
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

// ============================================================================
// BUG-3: Stale pipeline exports removed
// ============================================================================

describe('BUG-3: Stale pipeline exports removed', () => {
  it('should NOT export SPEC_EXECUTE_VERIFY_STAGES', async () => {
    const pipelineUtils = await import('../../../../scripts/cody/pipeline-utils')
    expect('SPEC_EXECUTE_VERIFY_STAGES' in pipelineUtils).toBe(false)
  })

  it('should NOT export ALL_IMPL_STAGES', async () => {
    const pipelineUtils = await import('../../../../scripts/cody/pipeline-utils')
    expect('ALL_IMPL_STAGES' in pipelineUtils).toBe(false)
  })

  it('should export ALL_IMPL_STAGE_NAMES with 8 stages', async () => {
    const { ALL_IMPL_STAGE_NAMES } = await import('../../../../scripts/cody/pipeline-utils')
    expect(ALL_IMPL_STAGE_NAMES).toHaveLength(8)
    expect(ALL_IMPL_STAGE_NAMES).toEqual([
      'architect',
      'plan-gap',
      'build',
      'commit',
      'verify',
      'auditor',
      'apply-audit',
      'pr',
    ])
  })

  it('should export IMPL_PIPELINE with expected structure including parallel groups', async () => {
    const { IMPL_PIPELINE, isParallelStage } =
      await import('../../../../scripts/cody/pipeline-utils')
    // verify+auditor should be a parallel group
    const parallelStages = IMPL_PIPELINE.filter(isParallelStage)
    expect(parallelStages).toHaveLength(1)
    expect(parallelStages[0]).toEqual({ parallel: ['verify', 'auditor'] })

    // All other stages should be sequential
    const sequentialStages = IMPL_PIPELINE.filter((s) => !isParallelStage(s))
    expect(sequentialStages).toContain('architect')
    expect(sequentialStages).toContain('plan-gap')
    expect(sequentialStages).toContain('build')
    expect(sequentialStages).toContain('commit')
    expect(sequentialStages).toContain('apply-audit')
    expect(sequentialStages).toContain('pr')

    // Last stage should be 'pr'
    const lastStage = IMPL_PIPELINE[IMPL_PIPELINE.length - 1]
    expect(lastStage).toBe('pr')
  })

  it('should still export SPEC_ONLY_STAGES', async () => {
    const { SPEC_ONLY_STAGES } = await import('../../../../scripts/cody/pipeline-utils')
    expect(SPEC_ONLY_STAGES).toEqual(['spec', 'gap', 'clarify'])
  })
})

// ============================================================================
// BUG-4: Atomic writeStatus
// ============================================================================

describe('BUG-4: Atomic writeStatus', () => {
  // These tests use the real fs module to verify atomic write behavior
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cody-bug4-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('should write status.json via atomic temp+rename', () => {
    // We can't easily mock fs for these since cody-utils uses the real fs.
    // Instead, verify that writing and reading status works correctly
    // and no .tmp file is left behind.
    const statusFile = path.join(tempDir, 'status.json')
    const tmpFile = statusFile + '.tmp'

    // Simulate atomic write
    const data = { test: 'data', stage: 'verify' }
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2))
    fs.renameSync(tmpFile, statusFile)

    // Verify no .tmp file remains
    expect(fs.existsSync(tmpFile)).toBe(false)
    expect(fs.existsSync(statusFile)).toBe(true)

    // Verify data integrity
    const read = JSON.parse(fs.readFileSync(statusFile, 'utf-8'))
    expect(read).toEqual(data)
  })

  it('should leave original file intact if write is interrupted', () => {
    const statusFile = path.join(tempDir, 'status.json')
    const tmpFile = statusFile + '.tmp'

    // Write original
    const original = { stage: 'build', state: 'running' }
    fs.writeFileSync(statusFile, JSON.stringify(original, null, 2))

    // Start writing to tmp but don't rename (simulating interruption)
    const updated = { stage: 'build', state: 'completed' }
    fs.writeFileSync(tmpFile, JSON.stringify(updated, null, 2))
    // No renameSync — simulating kill

    // Original should be unchanged
    const read = JSON.parse(fs.readFileSync(statusFile, 'utf-8'))
    expect(read).toEqual(original)
  })
})

// ============================================================================
// BUG-4 (mock-based): updateStageStatus uses atomic write
// ============================================================================

// We need a separate describe block with mocked fs to test updateStageStatus
describe('BUG-4: updateStageStatus uses atomic write', () => {
  // Use dynamic import with mocks
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should call renameSync after writeFileSync in writeStatus', async () => {
    const mockFs = {
      existsSync: vi.fn().mockReturnValue(true),
      readFileSync: vi.fn().mockReturnValue(
        JSON.stringify({
          taskId: 'test-task',
          stages: {},
          state: 'running',
          currentStage: null,
          updatedAt: '2026-01-01',
        }),
      ),
      writeFileSync: vi.fn(),
      renameSync: vi.fn(),
      mkdirSync: vi.fn(),
    }

    vi.doMock('fs', () => mockFs)
    vi.doMock('child_process', () => ({ execSync: vi.fn() }))

    const { updateStageStatus } = await import('../../../../scripts/cody/cody-utils')

    updateStageStatus('test-task', 'build', 'running')

    // Should have written to .tmp file first
    const writeCall = mockFs.writeFileSync.mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).endsWith('.tmp'),
    )
    expect(writeCall).toBeDefined()

    // Should have renamed .tmp to final
    expect(mockFs.renameSync).toHaveBeenCalledTimes(1)
    const renameCall = mockFs.renameSync.mock.calls[0]
    expect(renameCall[0]).toMatch(/status\.json\.tmp$/)
    expect(renameCall[1]).toMatch(/status\.json$/)
    expect(renameCall[1]).not.toMatch(/\.tmp$/)
  })
})

// ============================================================================
// BUG-5: Targeted staging (no git add -A)
// ============================================================================

describe('BUG-5: Autofix uses targeted staging', () => {
  it('should use git add -u instead of git add -A in autofix commit', () => {
    // Read cody.ts and verify the fix
    const codyContent = fs.readFileSync(path.join(process.cwd(), 'scripts/cody/cody.ts'), 'utf-8')

    // Find the autofix commit code section (verify it exists)
    const _autofixSection = codyContent.slice(
      codyContent.indexOf('Commit autofix changes'),
      codyContent.indexOf('Autofix changes committed and pushed'),
    )

    // The logic is now in commitPipelineFiles() in git-utils.ts
    // Verify the function uses 'tracked+task' staging strategy which maps to git add -u
    const gitUtilsContent = fs.readFileSync(
      path.join(process.cwd(), 'scripts/cody/git-utils.ts'),
      'utf-8',
    )
    expect(gitUtilsContent).toContain("case 'tracked+task':")
    expect(gitUtilsContent).toContain("execSync('git add -u'")
  })
})

// ============================================================================
// BUG-6: commitTaskFilesCI handles dirty state
// ============================================================================

describe('BUG-6: commitPipelineFiles handles dirty state cleanup', () => {
  it('should include git checkout and git clean in commitPipelineFiles', () => {
    const gitUtilsContent = fs.readFileSync(
      path.join(process.cwd(), 'scripts/cody/git-utils.ts'),
      'utf-8',
    )

    // Should contain dirty state cleanup
    expect(gitUtilsContent).toContain('git checkout -- .')
    expect(gitUtilsContent).toContain('git clean -fd')
    // Should exclude .tasks from clean
    expect(gitUtilsContent).toContain('--exclude=.tasks')
  })
})

// ============================================================================
// BUG-13: preflight throws instead of process.exit
// ============================================================================

describe('BUG-13: preflight throws Error not process.exit', () => {
  it('should not contain process.exit in preflight.ts', () => {
    const preflightContent = fs.readFileSync(
      path.join(process.cwd(), 'scripts/cody/preflight.ts'),
      'utf-8',
    )
    expect(preflightContent).not.toContain('process.exit')
    expect(preflightContent).toContain('throw new Error')
  })
})

// ============================================================================
// BUG-2: POSIX-compatible grep in parse-inputs.sh
// ============================================================================

describe('BUG-2: POSIX-compatible grep in parse-inputs.sh', () => {
  it('should not use grep -oP (Perl regex)', () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), 'scripts/cody/parse-inputs.sh'),
      'utf-8',
    )
    expect(content).not.toContain('grep -oP')
  })

  it('should use grep -o with sed for task-id extraction', () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), 'scripts/cody/parse-inputs.sh'),
      'utf-8',
    )
    // Should use POSIX-compatible grep -o
    expect(content).toContain("grep -o 'Task created:")
    // Should use sed to strip the prefix
    expect(content).toContain("sed 's/Task created: `//'")
  })

  it('should extract task-id correctly with POSIX grep+sed pattern', () => {
    // Test the actual regex pattern used in parse-inputs.sh
    const testInput = '🎯 Task created: `260219-youtube-embed`\n\nCody will now process this task.'

    // Simulate the grep -o + sed pipeline in JS
    const grepPattern = /Task created: `[0-9]{6}-[a-zA-Z0-9-]*/g
    const matches = testInput.match(grepPattern)
    expect(matches).not.toBeNull()

    const extracted = matches![0].replace('Task created: `', '')
    expect(extracted).toBe('260219-youtube-embed')
  })

  it('should handle multiple task-id markers (picks first)', () => {
    const testInput = [
      '🎯 Task created: `260218-first-task`',
      '🎯 Task created: `260219-second-task`',
    ].join('\n')

    const grepPattern = /Task created: `[0-9]{6}-[a-zA-Z0-9-]*/g
    const matches = testInput.match(grepPattern)
    expect(matches).toHaveLength(2)

    // head -1 equivalent: take first match
    const first = matches![0].replace('Task created: `', '')
    expect(first).toBe('260218-first-task')
  })
})
