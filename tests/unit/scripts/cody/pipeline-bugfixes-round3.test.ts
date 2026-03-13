/**
 * @fileType test
 * @domain cody | pipeline
 * @pattern bugfix-tests
 * @ai-summary Tests for third round of bug fixes applied to the Cody pipeline
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

// ============================================================================
// CRITICAL 1: scripted-stages runGate uses execFileSync (not execSync)
// ============================================================================

describe('CRITICAL 1: runGate uses execFileSync with args array', () => {
  it('should use program+args format in gateDefinitions', async () => {
    // Verify the source code has the correct pattern
    const source = fs.readFileSync(
      path.join(process.cwd(), 'scripts/cody/scripted-stages.ts'),
      'utf-8',
    )
    // Should NOT contain execSync( (only execFileSync)
    expect(source).not.toMatch(/\bexecSync\(/)
    // Should have program/args pattern in gateDefinitions
    expect(source).toContain("program: 'pnpm'")
    expect(source).toContain("args: ['-s', 'tsc', '--noEmit']")
    expect(source).toContain("args: ['-s', 'lint']")
    expect(source).toContain("args: ['-s', 'format:check']")
    expect(source).toContain("args: ['-s', 'test:unit']")
  })

  it('should import execFileSync not execSync', async () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'scripts/cody/scripted-stages.ts'),
      'utf-8',
    )
    expect(source).toContain('import { execFileSync }')
    expect(source).not.toMatch(/import\s*{[^}]*execSync[^}]*}/)
  })
})

// ============================================================================
// CRITICAL 2: post-actions validate-src-changes uses execFileSync
// ============================================================================

describe('CRITICAL 2: post-actions uses execFileSync for all commands', () => {
  it('should not use execSync anywhere in post-actions.ts', async () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'scripts/cody/pipeline/post-actions.ts'),
      'utf-8',
    )
    // Should import execFileSync, not execSync
    expect(source).toContain('execFileSync')
    // No raw execSync calls (but check it's not just in the import or a comment)
    const lines = source.split('\n')
    for (const line of lines) {
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue
      if (line.includes('import')) continue
      expect(line).not.toMatch(/\bexecSync\b/)
    }
  })

  it('should use git args array for diff and ls-files', async () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'scripts/cody/pipeline/post-actions.ts'),
      'utf-8',
    )
    expect(source).toContain("execFileSync('git', ['diff', '--name-only']")
    expect(source).toContain("execFileSync('git', ['ls-files', '--others', '--exclude-standard']")
  })

  it('should use pnpm args array for tsc and test', async () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'scripts/cody/pipeline/post-actions.ts'),
      'utf-8',
    )
    expect(source).toContain("execFileSync('pnpm', ['-s', 'tsc', '--noEmit']")
    expect(source).toContain("execFileSync('pnpm', ['-s', 'test:unit']")
  })

  it('should have parseCommand helper for quality gate commands', async () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'scripts/cody/pipeline/post-actions.ts'),
      'utf-8',
    )
    expect(source).toContain('const parseCommand')
    expect(source).toContain('cmd.split(/\\s+/).filter(Boolean)')
  })

  it('should log warnings when git commands fail in validate-src-changes', async () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'scripts/cody/pipeline/post-actions.ts'),
      'utf-8',
    )
    expect(source).toContain('git diff failed during src validation')
    expect(source).toContain('git ls-files failed during src validation')
  })
})

// ============================================================================
// CRITICAL 5: chat-history uses execFileSync for session export
// ============================================================================

describe('CRITICAL 5: chat-history uses execFileSync', () => {
  it('should use execFileSync with args array for opencode export', async () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'scripts/cody/chat-history.ts'),
      'utf-8',
    )
    // Two branches: server mode uses resolved opencode binary, non-server uses pnpm exec
    // Both use execFileSync with args array (no shell injection)
    expect(source).toContain("execFileSync('pnpm', args,")
    expect(source).toContain('execFileSync(resolveOpenCodeBinary(), args,')
    expect(source).toContain("['exec', 'opencode', 'export', sessionId]")
    // Server mode: opencode export does NOT support --attach, just reads from DB via XDG_DATA_HOME
    expect(source).toContain("['export', sessionId]")
    expect(source).toContain('XDG_DATA_HOME')
    expect(source).not.toMatch(/\bexecSync\(/)
  })

  it('should import execFileSync not execSync', async () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'scripts/cody/chat-history.ts'),
      'utf-8',
    )
    expect(source).toContain('import { execFileSync }')
    expect(source).not.toMatch(/import\s*{[^}]*\bexecSync\b/)
  })
})

// ============================================================================
// CRITICAL 6: tag-version uses execFileSync
// ============================================================================

describe('CRITICAL 6: tag-version uses execFileSync', () => {
  it('should use runCmd with program+args pattern', async () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'scripts/cody/tag-version.ts'), 'utf-8')
    expect(source).toContain('function runCmd(')
    expect(source).toContain('program: string,')
    expect(source).toContain('args: string[]')
    expect(source).toContain('execFileSync(program, args')
    expect(source).not.toMatch(/\bexecSync\(/)
  })

  it('should not use shell pipeline (| head -1)', async () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'scripts/cody/tag-version.ts'), 'utf-8')
    expect(source).not.toContain('| head')
    expect(source).not.toContain('2>/dev/null')
  })

  it('should use array args for git tag commands', async () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'scripts/cody/tag-version.ts'), 'utf-8')
    expect(source).toContain("runCmd('git', ['tag'")
    expect(source).toContain("runCmd('git', ['branch', '--show-current']")
  })
})

// ============================================================================
// CRITICAL 7: preflight uses execFileSync
// ============================================================================

describe('CRITICAL 7: preflight uses execFileSync', () => {
  it('should use execFileSync for all preflight checks', async () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'scripts/cody/preflight.ts'), 'utf-8')
    expect(source).toContain("execFileSync('pnpm', ['ocode', '--version']")
    expect(source).toContain("execFileSync('git', ['rev-parse', '--git-dir']")
    expect(source).toContain("execFileSync('which', ['pnpm']")
    expect(source).toContain("execFileSync('node', ['--version']")
    expect(source).not.toMatch(/\bexecSync\(/)
  })

  it('should import execFileSync not execSync', async () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'scripts/cody/preflight.ts'), 'utf-8')
    expect(source).toContain('import { execFileSync }')
    expect(source).not.toMatch(/import\s*{[^}]*\bexecSync\b/)
  })
})

// ============================================================================
// HIGH 1: entry.ts try-catch on file writes
// ============================================================================

describe('HIGH 1: entry.ts try-catch on file writes in rerun mode', () => {
  // BUG-Fix: Removed redundant gate-approved file write from entry.ts
  // handleGateApproval already writes gate-{stage}-approved.md - no need to overwrite
  it('should have try-catch around rerun feedback file write', async () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'scripts/cody/entry.ts'), 'utf-8')
    expect(source).toContain('Failed to write rerun feedback file')
  })
})

// ============================================================================
// HIGH 3: getBranchName handles detached HEAD
// ============================================================================

describe('HIGH 3: getBranchName handles detached HEAD', () => {
  it('should use execFileSync and have detached HEAD fallback', async () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'scripts/cody/scripted-stages.ts'),
      'utf-8',
    )
    // Should use execFileSync for branch name
    expect(source).toContain("execFileSync('git', ['branch', '--show-current']")
    // Should have detached HEAD handling
    expect(source).toContain("execFileSync('git', ['rev-parse', '--short', 'HEAD']")
    expect(source).toContain("|| 'detached'")
  })
})

// ============================================================================
// HIGH 6: TOCTOU fix in runSpecMode questionsPath read
// ============================================================================

describe('HIGH 6: TOCTOU fix in questionsPath read', () => {
  it('should check file existence before reading questions.md', async () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'scripts/cody/entry.ts'), 'utf-8')
    // Should have existence check and try-catch around the readFileSync
    expect(source).toContain("let preview = '(questions file not found)'")
    expect(source).toContain('fs.existsSync(questionsPath)')
    expect(source).toContain('Failed to read questions.md for preview')
  })
})

// ============================================================================
// HIGH 7: writeState with fsync
// ============================================================================

describe('HIGH 7: writeState with fsync before rename', () => {
  it('should use openSync + writeSync + fdatasyncSync + closeSync pattern', async () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'scripts/cody/engine/status.ts'),
      'utf-8',
    )
    // Should have the fsync pattern
    expect(source).toContain('fs.openSync(tmpFile')
    expect(source).toContain('fs.writeSync(fd')
    expect(source).toContain('fs.fdatasyncSync(fd)')
    expect(source).toContain('fs.closeSync(fd)')
    // Should still have atomic rename
    expect(source).toContain('fs.renameSync(tmpFile, statusFile)')
  })

  it('should have finally block to ensure fd is closed', async () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'scripts/cody/engine/status.ts'),
      'utf-8',
    )
    // The try/finally pattern should exist
    expect(source).toContain('} finally {')
    expect(source).toContain('fs.closeSync(fd)')
  })

  it('writeState should work correctly with real filesystem', async () => {
    const { writeState, loadState } = await import('../../../../scripts/cody/engine/status')

    const taskId = 'test-fsync-' + Date.now()
    const taskDir = path.join(process.cwd(), '.tasks', taskId)
    fs.mkdirSync(taskDir, { recursive: true })

    try {
      const state = {
        version: 2 as const,
        taskId,
        mode: 'full',
        pipeline: 'spec_execute_verify' as const,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        state: 'running' as const,
        cursor: null,
        stages: {},
      }

      writeState(taskId, state)

      // Verify the file was written correctly
      const loaded = loadState(taskId)
      expect(loaded).not.toBeNull()
      expect(loaded!.taskId).toBe(taskId)
      expect(loaded!.state).toBe('running')
    } finally {
      // Cleanup
      fs.rmSync(taskDir, { recursive: true, force: true })
    }
  })
})

// ============================================================================
// HIGH 8: Output truncation limits increased
// ============================================================================

describe('HIGH 8: Output truncation limits increased', () => {
  it('should have increased success output limit to 1000', async () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'scripts/cody/scripted-stages.ts'),
      'utf-8',
    )
    expect(source).toContain('output.slice(0, 1000)')
  })

  it('should have increased error output limit to 5000', async () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'scripts/cody/scripted-stages.ts'),
      'utf-8',
    )
    expect(source).toContain('output.slice(0, 5000)')
  })
})

// ============================================================================
// COMPREHENSIVE: No execSync remaining in critical pipeline files
// ============================================================================

describe('COMPREHENSIVE: No execSync remaining in critical pipeline files', () => {
  const criticalFiles = [
    'scripts/cody/scripted-stages.ts',
    'scripts/cody/pipeline/post-actions.ts',
    'scripts/cody/chat-history.ts',
    'scripts/cody/preflight.ts',
    // Note: tag-version.ts is also fixed
    'scripts/cody/tag-version.ts',
    // Files already fixed in Round 2:
    'scripts/cody/checkout-task-branch.ts',
    // Core files that already used execFileSync:
    'scripts/cody/git-utils.ts',
  ]

  for (const file of criticalFiles) {
    it(`${file} should not use raw execSync`, () => {
      const source = fs.readFileSync(path.join(process.cwd(), file), 'utf-8')
      const lines = source.split('\n')
      for (const line of lines) {
        // Skip comments and imports
        if (
          line.trim().startsWith('//') ||
          line.trim().startsWith('*') ||
          line.trim().startsWith('/*')
        )
          continue
        if (line.includes('import ')) continue
        // Check no execSync( calls
        if (line.includes('execSync(')) {
          throw new Error(`Found execSync() call in ${file}: ${line.trim()}`)
        }
      }
    })
  }
})

// ============================================================================
// HIGH 4: validate-src-changes logs warnings on git failures
// ============================================================================

describe('HIGH 4: validate-src-changes logs warnings on git failures', () => {
  it('should have logger.warn calls for both git command failures', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'scripts/cody/pipeline/post-actions.ts'),
      'utf-8',
    )
    // Should log warning when git diff fails
    expect(source).toContain("logger.warn({ err: error }, 'git diff failed during src validation')")
    // Should log warning when git ls-files fails
    expect(source).toContain(
      "logger.warn({ err: error }, 'git ls-files failed during src validation')",
    )
  })
})
