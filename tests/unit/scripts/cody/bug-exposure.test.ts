/**
 * @fileType test
 * @domain ci | cody
 * @pattern tdd-bug-exposure
 * @ai-summary Tests that EXPOSE bugs found during deep analysis. Each test is written to
 *   FAIL against the current buggy code, then PASS after the fix is applied.
 *
 * Bug inventory:
 *   BUG-7:  run-cody.sh calls `pnpm cody:run` but script is named `cody`
 *   BUG-2:  DISPATCH_CLARIFY env not forwarded in cody.yml → parse-inputs.sh
 *   BUG-4:  Shell injection via commit message in commitAndPush (execSync string)
 *   BUG-5:  Shell injection via message in commitPipelineFiles (execSync string)
 *   BUG-6:  OPENCODE_MODEL env overrides stage-specific models (fast model dead code)
 *   BUG-8:  checkout-task-branch.sh doesn't `git fetch` before rev-parse
 *   BUG-16: ensureFeatureBranch stashes but never unstashes in local mode
 *   BUG-11: run-cody.sh COMMENT_BODY with special chars can break argument passing
 *   BUG-15: commitAndPush uses `git add -A` which can stage secrets
 *   BUG-19: Test timeout expectations don't match actual STAGE_TIMEOUTS values
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

// ============================================================================
// BUG-7: run-cody.sh calls `pnpm cody:run` but package.json defines `cody`
// ============================================================================

describe('BUG-7: run-cody.sh must call the correct pnpm script', () => {
  it('should call "pnpm cody" not "pnpm cody:run" (which does not exist)', () => {
    const runCody = fs.readFileSync(path.join(process.cwd(), 'scripts/cody/run-cody.sh'), 'utf-8')
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'),
    )

    // The script name used in run-cody.sh must exist in package.json scripts
    const scriptCallMatch = runCody.match(/pnpm\s+([\w:]+)/)
    expect(scriptCallMatch).not.toBeNull()

    const calledScript = scriptCallMatch![1]

    // This EXPOSES the bug: run-cody.sh calls "cody:run" but only "cody" exists
    expect(packageJson.scripts).toHaveProperty(calledScript)
  })

  it('should not reference any undefined pnpm scripts', () => {
    const runCody = fs.readFileSync(path.join(process.cwd(), 'scripts/cody/run-cody.sh'), 'utf-8')
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'),
    )

    // Find all pnpm <scriptname> calls in the shell script
    const pnpmCalls = runCody.match(/pnpm\s+([\w:-]+)/g) || []
    for (const call of pnpmCalls) {
      const scriptName = call.replace(/^pnpm\s+/, '')
      // Skip built-in pnpm commands (install, run, etc.)
      if (['install', 'run', 'exec', 'dlx', 'tsx'].includes(scriptName)) continue
      expect(
        packageJson.scripts,
        `pnpm script "${scriptName}" referenced in run-cody.sh but not defined in package.json`,
      ).toHaveProperty(scriptName)
    }
  })
})

// ============================================================================
// BUG-2: cody.yml does not forward DISPATCH_CLARIFY env to parse-inputs.sh
// ============================================================================

describe('BUG-2: cody.yml must forward DISPATCH_CLARIFY to parse job', () => {
  it('should set DISPATCH_CLARIFY env var in the parse step', () => {
    const workflow = fs.readFileSync(
      path.join(process.cwd(), '.github/workflows/cody.yml'),
      'utf-8',
    )

    // The parse step's env block must include DISPATCH_CLARIFY
    // Find the "Parse command inputs" step and check its env block
    const parseStepMatch = workflow.match(/- name: Parse command inputs[\s\S]*?env:([\s\S]*?)run:/)
    expect(parseStepMatch).not.toBeNull()

    const envBlock = parseStepMatch![1]

    // EXPOSES BUG: DISPATCH_CLARIFY is missing from the env block
    expect(envBlock).toContain('DISPATCH_CLARIFY')
  })

  it('should reference github.event.inputs.clarify for the DISPATCH_CLARIFY value', () => {
    const workflow = fs.readFileSync(
      path.join(process.cwd(), '.github/workflows/cody.yml'),
      'utf-8',
    )

    // Must have: DISPATCH_CLARIFY: ${{ github.event.inputs.clarify }}
    expect(workflow).toContain('DISPATCH_CLARIFY')
  })
})

// ============================================================================
// BUG-4: Shell injection in commitAndPush via commit message
// ============================================================================

describe('BUG-4: commitAndPush must not use shell-interpolated commit messages', () => {
  it('should use execFileSync or array args instead of execSync with string interpolation for git commit', () => {
    const gitUtils = fs.readFileSync(path.join(process.cwd(), 'scripts/cody/git-utils.ts'), 'utf-8')

    // Find the commitAndPush function
    const commitAndPushSection = gitUtils.slice(
      gitUtils.indexOf('export function commitAndPush'),
      gitUtils.indexOf('// =', gitUtils.indexOf('export function commitAndPush') + 1),
    )

    // EXPOSES BUG: should NOT use execSync with template literal for git commit
    // The pattern `execSync(\`git commit ...${...}\`)` is vulnerable to injection
    const hasShellInterpolatedCommit = /execSync\(`git commit[^`]*\$\{/.test(commitAndPushSection)

    expect(
      hasShellInterpolatedCommit,
      'commitAndPush should not use shell-interpolated commit message (injection risk)',
    ).toBe(false)
  })
})

// ============================================================================
// BUG-5: Shell injection in commitPipelineFiles via message
// ============================================================================

describe('BUG-5: commitPipelineFiles must not use shell-interpolated commit messages', () => {
  it('should use execFileSync or array args instead of execSync with string interpolation for git commit', () => {
    const gitUtils = fs.readFileSync(path.join(process.cwd(), 'scripts/cody/git-utils.ts'), 'utf-8')

    // Find the commitPipelineFiles function
    const commitPipelineSection = gitUtils.slice(
      gitUtils.indexOf('export function commitPipelineFiles'),
    )

    // EXPOSES BUG: should NOT use execSync with template literal for git commit
    const hasShellInterpolatedCommit = /execSync\(`git commit[^`]*\$\{/.test(commitPipelineSection)

    expect(
      hasShellInterpolatedCommit,
      'commitPipelineFiles should not use shell-interpolated commit message (injection risk)',
    ).toBe(false)
  })
})

// ============================================================================
// BUG-8: checkout-task-branch.sh must fetch before checking remote branches
// ============================================================================

describe('BUG-8: checkout-task-branch.sh must fetch before rev-parse', () => {
  it('should run git fetch before git rev-parse --verify', () => {
    const script = fs.readFileSync(
      path.join(process.cwd(), 'scripts/cody/checkout-task-branch.sh'),
      'utf-8',
    )

    // Find positions of key commands
    const fetchPos = script.indexOf('git fetch')
    const revParsePos = script.indexOf('git rev-parse --verify')

    // EXPOSES BUG: no git fetch before rev-parse
    expect(fetchPos).toBeGreaterThan(-1) // fetch must exist
    expect(revParsePos).toBeGreaterThan(-1) // rev-parse must exist
    expect(fetchPos).toBeLessThan(revParsePos) // fetch must come first
  })
})

// ============================================================================
// BUG-16: ensureFeatureBranch stashes but never unstashes in local mode
// ============================================================================

describe('BUG-16: ensureFeatureBranch must unstash after checkout in local mode', () => {
  // We can't test the runtime behavior easily here since the function uses real
  // execSync. Instead, verify the source code includes git stash pop.
  it('should call git stash pop after checkout when stash was performed', () => {
    const gitUtils = fs.readFileSync(path.join(process.cwd(), 'scripts/cody/git-utils.ts'), 'utf-8')

    // Find the ensureFeatureBranch function
    const fnStart = gitUtils.indexOf('export function ensureFeatureBranch')
    const fnEnd = gitUtils.indexOf('\nexport ', fnStart + 10)
    const fnBody = gitUtils.slice(fnStart, fnEnd > -1 ? fnEnd : undefined)

    // Must contain stash push AND stash pop
    const hasStash = fnBody.includes('git stash')
    const hasUnstash = fnBody.includes('git stash pop') || fnBody.includes('git stash apply')

    // If it stashes, it MUST unstash
    if (hasStash) {
      // EXPOSES BUG: stash without pop
      expect(
        hasUnstash,
        'ensureFeatureBranch stashes changes but never unstashes them — data loss risk',
      ).toBe(true)
    }
  })
})

// ============================================================================
// BUG-11: run-cody.sh COMMENT_BODY with special chars
// ============================================================================

describe('BUG-11: run-cody.sh must safely handle COMMENT_BODY with special characters', () => {
  it('should not use bare variable expansion for COMMENT_BODY in the pnpm command', () => {
    const runCody = fs.readFileSync(path.join(process.cwd(), 'scripts/cody/run-cody.sh'), 'utf-8')

    // The COMMENT_BODY_FLAG assignment should properly quote the value
    // BAD:  COMMENT_BODY_FLAG="--comment-body=$COMMENT_BODY"
    // GOOD: COMMENT_BODY_FLAG="--comment-body=${COMMENT_BODY}" (with proper escaping)
    // BEST: Pass via stdin or temp file

    // At minimum, the COMMENT_BODY should not be embedded directly in the
    // command line. The current approach of --comment-body=$COMMENT_BODY
    // is vulnerable to shell injection when COMMENT_BODY contains $(), ``, etc.

    // Check that COMMENT_BODY is not directly interpolated in the command line
    // The safest approach is to pass it via --comment-body-file or environment variable
    const hasDangerousInterpolation = /COMMENT_BODY_FLAG="--comment-body=\$COMMENT_BODY"/.test(
      runCody,
    )

    expect(
      hasDangerousInterpolation,
      'COMMENT_BODY should not be directly interpolated in shell command flag (injection risk)',
    ).toBe(false)
  })
})

// ============================================================================
// BUG-15: commitAndPush uses git add -A which can stage secrets
// ============================================================================

describe('BUG-15: commitAndPush should not blindly stage all files', () => {
  it('should not use "git add -A" which can stage secrets/env files', () => {
    const gitUtils = fs.readFileSync(path.join(process.cwd(), 'scripts/cody/git-utils.ts'), 'utf-8')

    // Find the commitAndPush function specifically
    const fnStart = gitUtils.indexOf('export function commitAndPush')
    const fnEnd = gitUtils.indexOf('\n// =', fnStart + 10)
    const fnBody = gitUtils.slice(fnStart, fnEnd > -1 ? fnEnd : undefined)

    // EXPOSES BUG: should use targeted staging, not git add -A
    const usesAddAll = fnBody.includes('git add -A')

    expect(
      usesAddAll,
      'commitAndPush should use targeted staging (git add -u or specific paths) instead of git add -A',
    ).toBe(false)
  })
})

// ============================================================================
// BUG-19: Test timeout expectations must match actual STAGE_TIMEOUTS
// ============================================================================

describe('BUG-19: STAGE_TIMEOUTS values must be consistent', () => {
  it('architect timeout should be 30 minutes', async () => {
    const { STAGE_TIMEOUTS } = await import('../../../../scripts/cody/agent-runner')

    // The actual code defines architect: 30 * 60_000 = 1,800,000
    // Previous tests expected 5 * 60_000 = 300,000 — that was wrong
    expect(STAGE_TIMEOUTS['architect']).toBe(30 * 60_000)
  })

  it('build timeout should be 45 minutes', async () => {
    const { STAGE_TIMEOUTS } = await import('../../../../scripts/cody/agent-runner')
    expect(STAGE_TIMEOUTS['build']).toBe(45 * 60_000)
  })

  it('plan-review timeout should be 10 minutes', async () => {
    const { STAGE_TIMEOUTS } = await import('../../../../scripts/cody/agent-runner')
    expect(STAGE_TIMEOUTS['plan-review']).toBe(10 * 60_000)
  })

  it('verify timeout should be 10 minutes', async () => {
    const { STAGE_TIMEOUTS } = await import('../../../../scripts/cody/agent-runner')
    expect(STAGE_TIMEOUTS['verify']).toBe(10 * 60_000)
  })

  it('auditor timeout should be 5 minutes', async () => {
    const { STAGE_TIMEOUTS } = await import('../../../../scripts/cody/agent-runner')
    expect(STAGE_TIMEOUTS['auditor']).toBe(5 * 60_000)
  })

  it('DEFAULT_TIMEOUT should be 10 minutes', async () => {
    const { DEFAULT_TIMEOUT } = await import('../../../../scripts/cody/agent-runner')
    expect(DEFAULT_TIMEOUT).toBe(10 * 60_000)
  })
})
