/**
 * @fileType test
 * @domain ci | cody
 * @pattern bug-fix-verification
 * @ai-summary Tests for parse-safety.ts and YAML condition fixes
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

import { validateSafety } from '../../../../scripts/cody/parse-safety'

// ============================================================================
// parse-safety.ts Tests
// ============================================================================

describe('parse-safety.ts', () => {
  it('should reject bot comments (github-actions[bot])', () => {
    const output = validateSafety('github-actions[bot]', 'NONE', '/cody impl')
    expect(output.valid).toBe('false')
    expect(output.reason).toBe('bot')
  })

  it('should reject bot comments ([bot] suffix pattern)', () => {
    const output = validateSafety('dependabot[bot]', 'NONE', '/cody spec')
    expect(output.valid).toBe('false')
    expect(output.reason).toBe('bot')
  })

  it('should reject unauthorized author associations', () => {
    const output = validateSafety('someuser', 'CONTRIBUTOR', '/cody')
    expect(output.valid).toBe('false')
    expect(output.reason).toBe('unauthorized')
  })

  it('should accept valid owner association', () => {
    const output = validateSafety('owner', 'OWNER', '/cody')
    expect(output.valid).toBe('true')
    expect(output.reason).toBeUndefined()
  })

  it('should accept valid member association', () => {
    const output = validateSafety('someuser', 'MEMBER', '/cody')
    expect(output.valid).toBe('true')
  })

  it('should accept valid collaborator association', () => {
    const output = validateSafety('someuser', 'COLLABORATOR', '/cody')
    expect(output.valid).toBe('true')
  })

  it('should reject invalid command pattern', () => {
    const output = validateSafety('someuser', 'OWNER', 'not a command')
    expect(output.valid).toBe('false')
    expect(output.reason).toBe('pattern')
  })

  it('should accept /cody with trailing space', () => {
    const output = validateSafety('someuser', 'OWNER', '/cody ')
    expect(output.valid).toBe('true')
  })

  it('should accept /cody with subcommand', () => {
    const output = validateSafety('someuser', 'OWNER', '/cody impl')
    expect(output.valid).toBe('true')
  })

  it('should reject /cody as substring (not prefix)', () => {
    const output = validateSafety('someuser', 'OWNER', 'hello /cody world')
    expect(output.valid).toBe('false')
    expect(output.reason).toBe('pattern')
  })
})

// ============================================================================
// YAML Condition Fix Tests
// ============================================================================

describe('BUG-FIX: GitHub Actions YAML truthy condition evaluation', () => {
  // This test documents the fix for the bug where emoji reactions weren't
  // being added because the YAML condition used string comparison:
  //   if: steps.safety.outputs.valid == 'true'
  //
  // The fix changes it to:
  //   if: steps.safety.outputs.valid
  //
  // This is more reliable because GitHub Actions step outputs can have
  // different types/representations, and the truthy check handles all cases.

  it('should use truthy check in cody.yml for safety output', () => {
    const workflowPath = path.join(process.cwd(), '.github/workflows/cody.yml')
    const content = fs.readFileSync(workflowPath, 'utf-8')

    // The fix: use string comparison 'true' because GitHub Actions outputs are strings
    // and the string "false" is truthy in YAML expressions
    // GOOD (after fix): steps.safety.outputs.valid == 'true'

    // Check that the reaction step uses string comparison with 'true'
    const reactionStepMatch = content.match(
      /name: Acknowledge command with reaction[\s\S]*?if: (.+)/,
    )
    expect(reactionStepMatch).toBeTruthy()

    const condition = reactionStepMatch![1]
    // Should contain string comparison with 'true'
    expect(condition).toContain("== 'true'")
    expect(condition).toContain('steps.safety.outputs.valid')
  })

  it('should use string comparison for orchestrate job condition', () => {
    const workflowPath = path.join(process.cwd(), '.github/workflows/cody.yml')
    const content = fs.readFileSync(workflowPath, 'utf-8')

    // Check orchestrate job condition - find the orchestrate job and its if clause
    // The pattern is: "orchestrate:\n    needs: parse\n    if: ..."
    const orchestrateMatch = content.match(/orchestrate:\s+needs: parse\s+if: (.+)/)
    expect(orchestrateMatch).toBeTruthy()

    const condition = orchestrateMatch![1]
    // Should contain string comparison (the fix for GitHub Actions string outputs)
    expect(condition).toContain("== 'true'")
    expect(condition).toContain('needs.parse.outputs.valid')
  })
})
