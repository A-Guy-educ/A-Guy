/**
 * @fileType test
 * @domain cody | pipeline
 * @pattern bugfix-tests
 * @ai-summary Tests for second round of bug fixes applied to the Cody pipeline
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// CRITICAL 1: stdoutBuffer memory cap
// ============================================================================

describe('CRITICAL 1: stdoutBuffer memory cap', () => {
  it('should export MAX_STDOUT_BUFFER_SIZE constant', async () => {
    const { MAX_STDOUT_BUFFER_SIZE } = await import('../../../../scripts/cody/agent-runner')
    expect(MAX_STDOUT_BUFFER_SIZE).toBe(1_048_576)
  })

  it('should be 1 MB', async () => {
    const { MAX_STDOUT_BUFFER_SIZE } = await import('../../../../scripts/cody/agent-runner')
    // 1 MB = 1024 * 1024
    expect(MAX_STDOUT_BUFFER_SIZE).toBe(1024 * 1024)
  })
})

// ============================================================================
// CRITICAL 2: JSON log FD leak protection
// ============================================================================

describe('CRITICAL 2: JSON log FD leak protection', () => {
  it('should register and deregister process exit handler', async () => {
    // We verify the pattern exists by checking that the agent-runner module
    // uses process.on('exit', ...) and process.removeListener('exit', ...)
    // Since runAgentWithFileWatch spawns child processes, we verify the
    // pattern structurally by reading the source code
    const fs = await import('fs')
    const source = fs.readFileSync('scripts/cody/agent-runner.ts', 'utf-8')

    // Verify cleanup handler registration
    expect(source).toContain("process.on('exit', cleanupFd)")
    // Verify cleanup handler removal in finish()
    expect(source).toContain("process.removeListener('exit', cleanupFd)")
    // Verify cleanup function closes the FD
    expect(source).toContain('fs.closeSync(jsonLogFd)')
  })
})

// ============================================================================
// CRITICAL 3: Missing stage definition throws instead of silent return
// ============================================================================

describe('CRITICAL 3: Missing stage definition throws', () => {
  it('should have error + throw pattern (not warn + return) for missing stage', async () => {
    const fs = await import('fs')
    const source = fs.readFileSync('scripts/cody/engine/state-machine.ts', 'utf-8')

    // The old pattern was: logger.warn(...) + return state
    // The new pattern is: logger.error(...) + throw new Error(...)
    expect(source).toContain('logger.error(msg)')
    expect(source).toContain('throw new Error(msg)')
    // Should NOT have the old silent return pattern for missing stage
    expect(source).not.toContain(
      'logger.warn(`Stage ${stageName} not found in pipeline definitions`)',
    )
  })
})

// ============================================================================
// HIGH 4: Busy-wait replaced with syncSleep
// ============================================================================

describe('HIGH 4: syncSleep replaces busy-wait', () => {
  it('should export syncSleep function', async () => {
    const { syncSleep } = await import('../../../../scripts/cody/github-api')
    expect(syncSleep).toBeDefined()
    expect(typeof syncSleep).toBe('function')
  })

  it('syncSleep should use Atomics.wait', async () => {
    const fs = await import('fs')
    const source = fs.readFileSync('scripts/cody/github-api.ts', 'utf-8')
    expect(source).toContain('Atomics.wait')
    expect(source).toContain('SharedArrayBuffer')
  })

  it('should not have busy-wait loops', async () => {
    const fs = await import('fs')
    const source = fs.readFileSync('scripts/cody/github-api.ts', 'utf-8')
    // Old pattern: while (Date.now() < waitUntil) { /* busy wait */ }
    expect(source).not.toContain('/* busy wait */')
    expect(source).not.toContain('while (Date.now() < waitUntil)')
  })

  it('should use syncSleep in postComment and setLifecycleLabel', async () => {
    const fs = await import('fs')
    const source = fs.readFileSync('scripts/cody/github-api.ts', 'utf-8')
    // Should reference syncSleep(2000) in retry sections
    expect(source).toContain('syncSleep(2000)')
  })

  it('syncSleep should block for approximately the requested time', async () => {
    const { syncSleep } = await import('../../../../scripts/cody/github-api')
    const start = Date.now()
    syncSleep(50) // 50ms
    const elapsed = Date.now() - start
    // Should have waited at least ~40ms (allowing for timer imprecision)
    expect(elapsed).toBeGreaterThanOrEqual(40)
    // Should not have waited way too long
    expect(elapsed).toBeLessThan(500)
  })
})

// ============================================================================
// HIGH 5: fs import hoisted outside loop
// ============================================================================

describe('HIGH 5: fs import hoisted outside loop', () => {
  it('should have static import of existsSync and unlinkSync', async () => {
    const fs = await import('fs')
    const source = fs.readFileSync('scripts/cody/handlers/scripted-handler.ts', 'utf-8')
    // Should have top-level import
    expect(source).toContain("import { existsSync, unlinkSync } from 'fs'")
    // Should NOT have dynamic import inside loop
    expect(source).not.toContain("await import('fs')")
  })
})

// ============================================================================
// HIGH 6: Profile used in full/rerun buildPipeline
// ============================================================================

describe('HIGH 6: Profile used in full/rerun buildPipeline', () => {
  it('should use profile parameter for specOrder in full/rerun mode', async () => {
    const { buildPipeline, SPEC_ORDER_STANDARD, SPEC_ORDER_LIGHTWEIGHT } =
      await import('../../../../scripts/cody/pipeline/definitions')

    // Create minimal mock context
    const mockBackend = {
      spawn: vi.fn(),
      name: 'mock' as const,
    }
    const ctx = {
      taskId: 'test-123',
      taskDir: '/tmp/test',
      input: {
        taskId: 'test-123',
        mode: 'full' as const,
        issueNumber: 0,
        commentBody: '',
        triggerType: 'manual' as const,
        specType: 'ticket' as const,
        dryRun: false,
        controlMode: undefined,
        clarify: true,
      },
      taskDef: null,
      profile: 'lightweight' as const,
      backend: mockBackend,
    }

    // Build pipeline with lightweight profile
    const pipeline = buildPipeline('full', 'lightweight', true, ctx as any)
    const orderNames = pipeline.order.flatMap((step) =>
      typeof step === 'string' ? [step] : (step as { parallel: string[] }).parallel,
    )

    // With lightweight profile, spec order should NOT include 'spec' or 'gap'
    // SPEC_ORDER_LIGHTWEIGHT is ['taskify', 'clarify']
    expect(orderNames).toContain('taskify')
    expect(orderNames).toContain('clarify')
    // The lightweight spec order should not include 'spec' and 'gap' stages
    // (those are only in SPEC_ORDER_STANDARD)
    const specStages = orderNames.filter(
      (s) => SPEC_ORDER_STANDARD.includes(s) && !SPEC_ORDER_LIGHTWEIGHT.includes(s),
    )
    expect(specStages).toHaveLength(0)
  })

  it('should use SPEC_ORDER_STANDARD for standard profile in full mode', async () => {
    const { buildPipeline, SPEC_ORDER_STANDARD } =
      await import('../../../../scripts/cody/pipeline/definitions')

    const mockBackend = {
      spawn: vi.fn(),
      name: 'mock' as const,
    }
    const ctx = {
      taskId: 'test-123',
      taskDir: '/tmp/test',
      input: {
        taskId: 'test-123',
        mode: 'full' as const,
        issueNumber: 0,
        commentBody: '',
        triggerType: 'manual' as const,
        specType: 'ticket' as const,
        dryRun: false,
        controlMode: undefined,
        clarify: true,
      },
      taskDef: null,
      profile: 'standard' as const,
      backend: mockBackend,
    }

    const pipeline = buildPipeline('full', 'standard', true, ctx as any)
    const orderNames = pipeline.order.flatMap((step) =>
      typeof step === 'string' ? [step] : (step as { parallel: string[] }).parallel,
    )

    // With standard profile, should include all standard spec stages
    for (const stage of SPEC_ORDER_STANDARD) {
      expect(orderNames).toContain(stage)
    }
  })
})

// ============================================================================
// HIGH 7: Command injection fix in checkout-task-branch.ts
// ============================================================================

describe('HIGH 7: Command injection fix', () => {
  it('should use execFileSync instead of execSync', async () => {
    const fs = await import('fs')
    const source = fs.readFileSync('scripts/cody/checkout-task-branch.ts', 'utf-8')
    // Should import execFileSync
    expect(source).toContain("import { execFileSync } from 'child_process'")
    // Should NOT import execSync (which was vulnerable)
    expect(source).not.toContain('import { execSync }')
    // Should NOT use string interpolation with git
    expect(source).not.toContain('execSync(`git ${args.join')
    // Should use execFileSync with array args
    expect(source).toContain("execFileSync('git', args")
  })

  it('configureGitIdentity should use array args', async () => {
    const fs = await import('fs')
    const source = fs.readFileSync('scripts/cody/checkout-task-branch.ts', 'utf-8')
    // Old pattern: execSync(`git config --global user.email "${GIT_EMAIL}"`)
    expect(source).not.toContain('`git config --global')
    // New pattern: execFileSync('git', ['config', '--global', 'user.email', GIT_EMAIL])
    expect(source).toContain("'config', '--global', 'user.email'")
    expect(source).toContain("'config', '--global', 'user.name'")
  })
})

// ============================================================================
// HIGH 9: clarify-workflow.ts error handling
// ============================================================================

describe('HIGH 9: clarify-workflow.ts error handling', () => {
  it('should use safeWriteFile wrapper instead of raw fs.writeFileSync', async () => {
    const fs = await import('fs')
    const source = fs.readFileSync('scripts/cody/clarify-workflow.ts', 'utf-8')
    // Should have safeWriteFile function
    expect(source).toContain('function safeWriteFile')
    // Should import logger
    expect(source).toContain("import { logger } from './logger'")
    // Should NOT have bare fs.writeFileSync calls (outside safeWriteFile itself)
    // Count occurrences of fs.writeFileSync - should only appear inside safeWriteFile definition
    const matches = source.match(/fs\.writeFileSync/g) || []
    expect(matches.length).toBe(1) // Only the one inside safeWriteFile
  })

  it('safeWriteFile should log error and re-throw', async () => {
    const fs = await import('fs')
    const source = fs.readFileSync('scripts/cody/clarify-workflow.ts', 'utf-8')
    // safeWriteFile should have logger.error and throw error
    const funcBlock = source.slice(
      source.indexOf('function safeWriteFile'),
      source.indexOf('function safeWriteFile') + 300,
    )
    expect(funcBlock).toContain('logger.error')
    expect(funcBlock).toContain('throw error')
  })
})

// ============================================================================
// HIGH 10: null cast fix in parallel stage
// ============================================================================

describe('HIGH 10: Parallel stage missing definition throws instead of null cast', () => {
  it('should not have null cast pattern for missing stage definition', async () => {
    const fs = await import('fs')
    const source = fs.readFileSync('scripts/cody/engine/state-machine.ts', 'utf-8')
    // Old pattern: null as unknown as StageResult
    expect(source).not.toContain('null as unknown as StageResult')
    // New pattern: throw StageError
    expect(source).toContain('throw new StageError')
  })
})

// ============================================================================
// MEDIUM 11: Duplicate condition removed
// ============================================================================

describe('MEDIUM 11: Duplicate condition removed', () => {
  it('should not have duplicate Cannot find module condition', async () => {
    const fs = await import('fs')
    const source = fs.readFileSync('scripts/cody/pipeline/error-classifier.ts', 'utf-8')
    // Count occurrences of the condition
    const matches = source.match(/rawOutput\.includes\('Cannot find module'\)/g) || []
    // Should appear exactly once (not twice)
    expect(matches.length).toBe(1)
  })
})

// ============================================================================
// MEDIUM 12: StageError class
// ============================================================================

describe('MEDIUM 12: StageError class', () => {
  it('should have StageError class with stageName property', async () => {
    const fs = await import('fs')
    const source = fs.readFileSync('scripts/cody/engine/state-machine.ts', 'utf-8')
    expect(source).toContain('class StageError extends Error')
    expect(source).toContain('public readonly stageName: string')
  })

  it('should use StageError for preExecute errors', async () => {
    const fs = await import('fs')
    const source = fs.readFileSync('scripts/cody/engine/state-machine.ts', 'utf-8')
    // Should not have old pattern: (preError as any).stageName = stageName
    expect(source).not.toContain('(preError as any).stageName')
    // Should not have old pattern: (error as any).stageName = stageName
    // (for the execute catch block)
    expect(source).not.toContain('(error as any).stageName')
  })

  it('should detect PipelinePausedError wrapped in StageError', async () => {
    const fs = await import('fs')
    const source = fs.readFileSync('scripts/cody/engine/state-machine.ts', 'utf-8')
    // Should check for PipelinePausedError in StageError.cause
    expect(source).toContain('rejectedErr.cause instanceof PipelinePausedError')
  })
})
