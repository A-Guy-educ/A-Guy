/**
 * @fileType test
 * @domain ci | cody
 * @pattern cody-pipeline | contract-test
 * @ai-summary Tests that the GitHub Actions workflow (cody.yml → run-cody.sh) produces
 *   CLI flags that parseCliArgs correctly interprets — verifying the pipeline↔CLI contract.
 *
 * Key contract being tested:
 *   1. run-cody.sh translates env vars into CLI flags for `pnpm cody:run`
 *   2. parseCliArgs correctly parses those flags
 *   3. When --comment-body is present, its parsed mode OVERRIDES --mode="full" (the default)
 *      BUT ONLY when --mode appears before --comment-body (current run-cody.sh order)
 *   4. All env vars from cody.yml parse job outputs map to valid CLI flags
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock child_process before importing the module
vi.mock('child_process', () => ({
  execSync: vi.fn().mockReturnValue(''),
}))

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  renameSync: vi.fn(),
}))

import { parseCliArgs } from '../../../../scripts/cody/cody-utils'

// ============================================================================
// Helpers
// ============================================================================

/**
 * Simulate what run-cody.sh produces given a set of environment variables.
 * This mirrors the exact flag-building logic in run-cody.sh lines 31-42.
 */
function buildRunCodyArgs(env: {
  TASK_ID?: string
  MODE?: string
  ISSUE_NUMBER?: string
  TRIGGER_TYPE?: string
  RUN_ID?: string
  RUN_URL?: string
  DRY_RUN?: string
  COMMENT_BODY?: string
  FEEDBACK?: string
  FROM_STAGE?: string
}): string[] {
  const args: string[] = []

  // Always present (run-cody.sh lines 33-36)
  args.push(`--task-id=${env.TASK_ID ?? ''}`)
  args.push(`--mode=${env.MODE ?? 'full'}`)
  args.push(`--issue-number=${env.ISSUE_NUMBER ?? ''}`)
  args.push(`--trigger-type=${env.TRIGGER_TYPE ?? ''}`)

  // Conditional flags (run-cody.sh lines 37-42)
  if (env.RUN_ID) args.push(`--run-id=${env.RUN_ID}`)
  if (env.RUN_URL) args.push(`--run-url=${env.RUN_URL}`)
  if (env.DRY_RUN === 'true') args.push('--dry-run')
  if (env.COMMENT_BODY && env.TRIGGER_TYPE === 'comment') {
    args.push(`--comment-body=${env.COMMENT_BODY}`)
  }
  if (env.FEEDBACK) args.push(`--feedback=${env.FEEDBACK}`)
  if (env.FROM_STAGE) args.push(`--from=${env.FROM_STAGE}`)

  return args
}

// ============================================================================
// Tests
// ============================================================================

describe('pipeline↔CLI contract: run-cody.sh flags → parseCliArgs', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv }
    // Simulate CI environment
    process.env.GITHUB_ACTIONS = 'true'
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  // --------------------------------------------------------------------------
  // Scenario 1: workflow_dispatch (the simple path)
  // --------------------------------------------------------------------------

  describe('workflow_dispatch trigger', () => {
    it('should parse a basic dispatch with task-id and mode', () => {
      const args = buildRunCodyArgs({
        TASK_ID: '260218-user-metrics',
        MODE: 'full',
        TRIGGER_TYPE: 'dispatch',
      })

      const result = parseCliArgs(args)

      expect(result.taskId).toBe('260218-user-metrics')
      expect(result.mode).toBe('full')
      // CLI args take precedence over env vars
      expect(result.triggerType).toBe('dispatch')
      expect(result.dryRun).toBe(false)
      expect(result.local).toBe(false)
    })

    it('should parse dispatch with all optional fields', () => {
      const args = buildRunCodyArgs({
        TASK_ID: '260218-api-v2',
        MODE: 'rerun',
        TRIGGER_TYPE: 'dispatch',
        DRY_RUN: 'true',
        FEEDBACK: 'TypeScript errors in src/api.ts',
        FROM_STAGE: 'build',
        RUN_ID: '9876543',
        RUN_URL: 'https://github.com/org/repo/actions/runs/9876543',
      })

      const result = parseCliArgs(args)

      expect(result.taskId).toBe('260218-api-v2')
      expect(result.mode).toBe('rerun')
      expect(result.dryRun).toBe(true)
      expect(result.feedback).toBe('TypeScript errors in src/api.ts')
      expect(result.fromStage).toBe('build')
      // CLI args take precedence over env vars
      expect(result.runId).toBe('9876543')
      expect(result.runUrl).toBe('https://github.com/org/repo/actions/runs/9876543')
    })

    it('should parse spec mode dispatch', () => {
      const args = buildRunCodyArgs({
        TASK_ID: '260218-new-feature',
        MODE: 'spec',
        TRIGGER_TYPE: 'dispatch',
      })

      const result = parseCliArgs(args)

      expect(result.mode).toBe('spec')
    })

    it('should parse impl mode dispatch', () => {
      const args = buildRunCodyArgs({
        TASK_ID: '260218-new-feature',
        MODE: 'impl',
        TRIGGER_TYPE: 'dispatch',
      })

      const result = parseCliArgs(args)

      expect(result.mode).toBe('impl')
    })

    it('should parse status mode dispatch', () => {
      const args = buildRunCodyArgs({
        TASK_ID: '260218-new-feature',
        MODE: 'status',
        TRIGGER_TYPE: 'dispatch',
      })

      const result = parseCliArgs(args)

      expect(result.mode).toBe('status')
    })
  })

  // --------------------------------------------------------------------------
  // Scenario 2: issue_comment trigger — the critical override path
  // --------------------------------------------------------------------------

  describe('issue_comment trigger — comment-body overrides mode', () => {
    it('should override --mode=full with mode from comment body "/cody impl"', () => {
      // This is the KEY contract test:
      // parse-inputs.sh defaults mode=full for comment triggers.
      // run-cody.sh passes --mode="full" BEFORE --comment-body="/cody impl 260218-task".
      // parseCliArgs processes flags left-to-right: --mode sets full, then
      // --comment-body parsing overwrites mode to impl.
      // This ordering is load-bearing — see "flag ordering" tests below.
      const args = buildRunCodyArgs({
        TASK_ID: '260218-task',
        MODE: 'full', // default from parse-inputs.sh
        ISSUE_NUMBER: '42',
        TRIGGER_TYPE: 'comment',
        COMMENT_BODY: '/cody impl 260218-task',
      })

      const result = parseCliArgs(args)

      expect(result.mode).toBe('impl') // comment-body wins over --mode=full
      expect(result.taskId).toBe('260218-task')
      expect(result.triggerType).toBe('comment')
    })

    it('should override --mode=full with mode from comment body "/cody spec"', () => {
      const args = buildRunCodyArgs({
        TASK_ID: '260218-task',
        MODE: 'full',
        ISSUE_NUMBER: '42',
        TRIGGER_TYPE: 'comment',
        COMMENT_BODY: '/cody spec 260218-task',
      })

      const result = parseCliArgs(args)

      expect(result.mode).toBe('spec')
    })

    it('should override --mode=full with mode from comment body "/cody rerun"', () => {
      const args = buildRunCodyArgs({
        TASK_ID: '260218-task',
        MODE: 'full',
        ISSUE_NUMBER: '42',
        TRIGGER_TYPE: 'comment',
        COMMENT_BODY: '/cody rerun 260218-task --feedback fix-this --from build',
      })

      const result = parseCliArgs(args)

      expect(result.mode).toBe('rerun')
      expect(result.feedback).toBe('fix-this')
      expect(result.fromStage).toBe('build')
    })

    it('should override --mode=full with "/cody status"', () => {
      const args = buildRunCodyArgs({
        TASK_ID: '260218-task',
        MODE: 'full',
        ISSUE_NUMBER: '42',
        TRIGGER_TYPE: 'comment',
        COMMENT_BODY: '/cody status 260218-task',
      })

      const result = parseCliArgs(args)

      expect(result.mode).toBe('status')
    })

    it('should keep mode=full when comment is just "/cody" (no subcommand)', () => {
      const args = buildRunCodyArgs({
        TASK_ID: '260218-task',
        MODE: 'full',
        ISSUE_NUMBER: '42',
        TRIGGER_TYPE: 'comment',
        COMMENT_BODY: '/cody',
      })

      const result = parseCliArgs(args)

      expect(result.mode).toBe('full')
    })

    it('should keep mode=full when comment is "/cody 260218-task" (task-id as subcommand)', () => {
      const args = buildRunCodyArgs({
        TASK_ID: '260218-task',
        MODE: 'full',
        ISSUE_NUMBER: '42',
        TRIGGER_TYPE: 'comment',
        COMMENT_BODY: '/cody 260218-task',
      })

      const result = parseCliArgs(args)

      expect(result.mode).toBe('full')
      expect(result.taskId).toBe('260218-task')
    })

    it('should use task-id from comment-body over --task-id from discovered value', () => {
      // parse-inputs.sh discovers a task-id from bot comments
      // but the user explicitly specifies a different one in the comment
      const args = buildRunCodyArgs({
        TASK_ID: '260218-discovered', // from parse-inputs.sh discovery
        MODE: 'full',
        ISSUE_NUMBER: '42',
        TRIGGER_TYPE: 'comment',
        COMMENT_BODY: '/cody impl 260218-explicit',
      })

      const result = parseCliArgs(args)

      // comment-body's task-id should win
      expect(result.taskId).toBe('260218-explicit')
      expect(result.mode).toBe('impl')
    })

    it('should preserve issue-number from --issue-number when parsing comment', () => {
      const args = buildRunCodyArgs({
        TASK_ID: '260218-task',
        MODE: 'full',
        ISSUE_NUMBER: '99',
        TRIGGER_TYPE: 'comment',
        COMMENT_BODY: '/cody spec 260218-task',
      })

      const result = parseCliArgs(args)

      // CLI args take precedence over env vars
      expect(result.issueNumber).toBe(99)
    })

    it('should store raw commentBody for answer extraction', () => {
      const commentBody = '/cody 260218-task'
      const args = buildRunCodyArgs({
        TASK_ID: '260218-task',
        MODE: 'full',
        ISSUE_NUMBER: '42',
        TRIGGER_TYPE: 'comment',
        COMMENT_BODY: commentBody,
      })

      const result = parseCliArgs(args)

      expect(result.commentBody).toBe(commentBody)
    })

    it('should handle JSON-encoded comment body from jq -Rs', () => {
      // parse-inputs.sh runs: ESCAPED_BODY=$(printf '%s' "$COMMENT_BODY" | jq -Rs .)
      // This wraps in quotes and escapes special chars
      const args = buildRunCodyArgs({
        TASK_ID: '260218-task',
        MODE: 'full',
        ISSUE_NUMBER: '42',
        TRIGGER_TYPE: 'comment',
        COMMENT_BODY: '"/cody spec 260218-task"',
      })

      const result = parseCliArgs(args)

      expect(result.mode).toBe('spec')
      expect(result.taskId).toBe('260218-task')
    })

    it('should handle comment body with literal \\n from shell escaping', () => {
      const args = buildRunCodyArgs({
        TASK_ID: '260218-task',
        MODE: 'full',
        ISSUE_NUMBER: '42',
        TRIGGER_TYPE: 'comment',
        COMMENT_BODY: '/cody impl 260218-task\\nsome extra text',
      })

      const result = parseCliArgs(args)

      // Only first line should be parsed
      expect(result.mode).toBe('impl')
      expect(result.taskId).toBe('260218-task')
    })
  })

  // --------------------------------------------------------------------------
  // Scenario 3: parse-inputs.sh output defaults
  // --------------------------------------------------------------------------

  describe('parse-inputs.sh default values contract', () => {
    it('should handle empty optional env vars gracefully', () => {
      // parse-inputs.sh writes empty defaults for optional fields:
      //   from_stage=, feedback=, comment_body=
      // run-cody.sh only passes flags when these are non-empty (${VAR:+...})
      // So parseCliArgs should work fine without them
      const args = buildRunCodyArgs({
        TASK_ID: '260218-task',
        MODE: 'full',
        TRIGGER_TYPE: 'dispatch',
        // No FEEDBACK, FROM_STAGE, COMMENT_BODY, RUN_ID, RUN_URL
      })

      const result = parseCliArgs(args)

      expect(result.feedback).toBeUndefined()
      expect(result.fromStage).toBeUndefined()
      expect(result.commentBody).toBeUndefined()
      // In CI, RUN_ID is set; locally it should be undefined
      expect(result.runId).toBe(process.env.RUN_ID || undefined)
      expect(result.runUrl).toBe(process.env.RUN_URL || undefined)
    })

    it('should handle DRY_RUN=false (not passing --dry-run flag)', () => {
      const args = buildRunCodyArgs({
        TASK_ID: '260218-task',
        MODE: 'full',
        TRIGGER_TYPE: 'dispatch',
        DRY_RUN: 'false', // parse-inputs.sh default
      })

      const result = parseCliArgs(args)

      expect(result.dryRun).toBe(false)
    })
  })

  // --------------------------------------------------------------------------
  // Scenario 4: Flag ordering — documents a load-bearing ordering dependency
  // --------------------------------------------------------------------------

  describe('flag ordering (load-bearing dependency)', () => {
    it('comment-body overrides mode when --mode comes FIRST (run-cody.sh order)', () => {
      // This is the actual order run-cody.sh uses: --mode before --comment-body
      // comment-body processing overwrites mode → correct behavior
      const args = [
        '--task-id=260218-task',
        '--mode=full', // processed first, sets mode=full
        '--issue-number=42',
        '--trigger-type=comment',
        '--comment-body=/cody impl 260218-task', // processed second, overwrites mode=impl ✅
      ]

      process.env.GITHUB_ACTIONS = 'true'
      const result = parseCliArgs(args)

      expect(result.mode).toBe('impl')
    })

    it('--mode AFTER --comment-body overwrites comment mode (known fragility)', () => {
      // If someone reorders run-cody.sh flags, --mode=full would overwrite
      // the mode parsed from comment-body. This documents the fragility.
      // run-cody.sh currently avoids this by placing --mode before --comment-body.
      const args = [
        '--task-id=260218-task',
        '--comment-body=/cody impl 260218-task', // processed first, sets mode=impl
        '--mode=full', // processed second, overwrites back to mode=full ❌
        '--issue-number=42',
        '--trigger-type=comment',
      ]

      process.env.GITHUB_ACTIONS = 'true'
      const result = parseCliArgs(args)

      // This documents the FRAGILE behavior: last --mode wins
      // If this assertion ever changes to 'impl', the fragility is fixed 🎉
      expect(result.mode).toBe('full')
    })

    it('should handle --comment-body before --issue-number', () => {
      // In run-cody.sh, --issue-number comes before --comment-body
      // issue-number is additive (not an override) so order doesn't matter
      const args = [
        '--task-id=260218-task',
        '--mode=full',
        '--comment-body=/cody spec 260218-task',
        '--issue-number=42',
        '--trigger-type=comment',
      ]

      process.env.GITHUB_ACTIONS = 'true'
      const result = parseCliArgs(args)

      // issue-number should still be captured regardless of order
      expect(result.issueNumber).toBe(42)
      // mode is 'spec' because --mode=full comes before --comment-body
      expect(result.mode).toBe('spec')
    })
  })

  // --------------------------------------------------------------------------
  // Scenario 5: cody.yml env vars → run-cody.sh completeness
  // --------------------------------------------------------------------------

  describe('cody.yml outputs completeness', () => {
    it('should map all cody.yml parse job outputs to CLI flags', () => {
      // These are the EXACT outputs from cody.yml parse job (lines 56-64):
      //   task_id, mode, dry_run, from_stage, feedback,
      //   issue_number, valid, trigger_type, comment_body
      //
      // "valid" is consumed by the `if: needs.parse.outputs.valid == 'true'`
      // gate and never reaches run-cody.sh.
      //
      // All others must have corresponding CLI flags.
      const args = buildRunCodyArgs({
        TASK_ID: '260218-complete-test',
        MODE: 'rerun',
        DRY_RUN: 'true',
        FROM_STAGE: 'verify',
        FEEDBACK: 'Tests are flaky',
        ISSUE_NUMBER: '123',
        TRIGGER_TYPE: 'dispatch',
        RUN_ID: '555',
        RUN_URL: 'https://github.com/org/repo/actions/runs/555',
        // COMMENT_BODY not passed because TRIGGER_TYPE is dispatch
      })

      const result = parseCliArgs(args)

      // Every parse job output should be reflected in the parsed result
      expect(result.taskId).toBe('260218-complete-test')
      expect(result.mode).toBe('rerun')
      expect(result.dryRun).toBe(true)
      expect(result.fromStage).toBe('verify')
      expect(result.feedback).toBe('Tests are flaky')
      expect(result.issueNumber).toBe(123)
      expect(result.triggerType).toBe('dispatch')
      expect(result.runId).toBe('555')
      expect(result.runUrl).toBe('https://github.com/org/repo/actions/runs/555')
    })
  })

  // --------------------------------------------------------------------------
  // Scenario 6: comment trigger with discovered task-id (second /cody call)
  // --------------------------------------------------------------------------

  describe('second /cody call with discovered task-id', () => {
    it('should use discovered task-id when comment has none', () => {
      // On second /cody call:
      //   parse-inputs.sh discovers task-id from bot comments → TASK_ID is set
      //   user just types "/cody" (no task-id in comment)
      //   run-cody.sh passes both --task-id=discovered AND --comment-body="/cody"
      const args = buildRunCodyArgs({
        TASK_ID: '260218-discovered',
        MODE: 'full',
        ISSUE_NUMBER: '42',
        TRIGGER_TYPE: 'comment',
        COMMENT_BODY: '/cody',
      })

      const result = parseCliArgs(args)

      // --task-id=260218-discovered is set first, then --comment-body="/cody" parses
      // with empty taskId. Since parsed.input.taskId is empty, it doesn't overwrite.
      expect(result.taskId).toBe('260218-discovered')
      expect(result.mode).toBe('full')
    })

    it('should use discovered task-id when comment specifies only mode', () => {
      // User types "/cody impl" — has mode but no task-id
      const args = buildRunCodyArgs({
        TASK_ID: '260218-discovered',
        MODE: 'full',
        ISSUE_NUMBER: '42',
        TRIGGER_TYPE: 'comment',
        COMMENT_BODY: '/cody impl',
      })

      const result = parseCliArgs(args)

      // mode from comment should override, but task-id from --task-id should persist
      expect(result.mode).toBe('impl')
      expect(result.taskId).toBe('260218-discovered')
    })

    it('should let explicit comment task-id override discovered one', () => {
      // User types "/cody impl 260218-new-task" — explicitly names a different task
      const args = buildRunCodyArgs({
        TASK_ID: '260218-old-discovered',
        MODE: 'full',
        ISSUE_NUMBER: '42',
        TRIGGER_TYPE: 'comment',
        COMMENT_BODY: '/cody impl 260218-new-task',
      })

      const result = parseCliArgs(args)

      expect(result.taskId).toBe('260218-new-task')
      expect(result.mode).toBe('impl')
    })
  })

  // --------------------------------------------------------------------------
  // Scenario 7: run-cody.sh conditional flag emission
  // --------------------------------------------------------------------------

  describe('run-cody.sh conditional flag emission', () => {
    it('should NOT pass --comment-body when trigger is dispatch', () => {
      // run-cody.sh: only passes comment-body when TRIGGER_TYPE == "comment"
      const args = buildRunCodyArgs({
        TASK_ID: '260218-task',
        MODE: 'full',
        TRIGGER_TYPE: 'dispatch',
        COMMENT_BODY: 'this should be ignored', // would be ignored by run-cody.sh
      })

      const result = parseCliArgs(args)

      // commentBody should NOT be set because buildRunCodyArgs
      // correctly doesn't pass it for non-comment triggers
      expect(result.commentBody).toBeUndefined()
    })

    it('should NOT pass --dry-run when DRY_RUN is false', () => {
      const args = buildRunCodyArgs({
        TASK_ID: '260218-task',
        MODE: 'full',
        TRIGGER_TYPE: 'dispatch',
        DRY_RUN: 'false',
      })

      const result = parseCliArgs(args)

      expect(result.dryRun).toBe(false)
    })

    it('should NOT pass --feedback when FEEDBACK is empty', () => {
      const args = buildRunCodyArgs({
        TASK_ID: '260218-task',
        MODE: 'full',
        TRIGGER_TYPE: 'dispatch',
        // FEEDBACK not set
      })

      const result = parseCliArgs(args)

      expect(result.feedback).toBeUndefined()
    })

    it('should NOT pass --from when FROM_STAGE is empty', () => {
      const args = buildRunCodyArgs({
        TASK_ID: '260218-task',
        MODE: 'full',
        TRIGGER_TYPE: 'dispatch',
        // FROM_STAGE not set
      })

      const result = parseCliArgs(args)

      expect(result.fromStage).toBeUndefined()
    })
  })
})
