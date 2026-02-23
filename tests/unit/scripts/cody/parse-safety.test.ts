/**
 * @fileType test
 * @domain ci | cody
 * @pattern bug-fix-verification
 * @ai-summary Tests for parse-safety.sh and YAML condition fixes
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { execSync } from 'child_process'

// ============================================================================
// parse-safety.sh Tests
// ============================================================================

describe('parse-safety.sh', () => {
  const scriptPath = path.join(process.cwd(), 'scripts/cody/parse-safety.sh')

  it('should exist and be executable', () => {
    expect(fs.existsSync(scriptPath)).toBe(true)
    const stats = fs.statSync(scriptPath)
    expect(stats.mode & 0o111).not.toBe(0) // at least one execute bit
  })

  it('should reject bot comments (github-actions[bot])', () => {
    const output = runScript({
      COMMENT_BODY: '/cody impl',
      AUTHOR: 'github-actions[bot]',
      ASSOCIATION: 'NONE',
    })
    expect(output.valid).toBe('false')
    expect(output.reason).toBe('bot')
  })

  it('should reject bot comments ([bot] suffix pattern)', () => {
    const output = runScript({
      COMMENT_BODY: '/cody spec',
      AUTHOR: 'dependabot[bot]',
      ASSOCIATION: 'NONE',
    })
    expect(output.valid).toBe('false')
    expect(output.reason).toBe('bot')
  })

  it('should reject unauthorized author associations', () => {
    const output = runScript({
      COMMENT_BODY: '/cody',
      AUTHOR: 'someuser',
      ASSOCIATION: 'CONTRIBUTOR', // Not OWNER, MEMBER, or COLLABORATOR
    })
    expect(output.valid).toBe('false')
    expect(output.reason).toBe('unauthorized')
  })

  it('should accept valid owner association', () => {
    const output = runScript({
      COMMENT_BODY: '/cody',
      AUTHOR: 'owner',
      ASSOCIATION: 'OWNER',
    })
    expect(output.valid).toBe('true')
    expect(output.reason).toBeUndefined()
  })

  it('should accept valid member association', () => {
    const output = runScript({
      COMMENT_BODY: '/cody',
      AUTHOR: 'someuser',
      ASSOCIATION: 'MEMBER',
    })
    expect(output.valid).toBe('true')
  })

  it('should accept valid collaborator association', () => {
    const output = runScript({
      COMMENT_BODY: '/cody',
      AUTHOR: 'someuser',
      ASSOCIATION: 'COLLABORATOR',
    })
    expect(output.valid).toBe('true')
  })

  it('should reject invalid command pattern', () => {
    const output = runScript({
      COMMENT_BODY: 'not a command',
      AUTHOR: 'someuser',
      ASSOCIATION: 'OWNER',
    })
    expect(output.valid).toBe('false')
    expect(output.reason).toBe('pattern')
  })

  it('should accept /cody with trailing space', () => {
    const output = runScript({
      COMMENT_BODY: '/cody ',
      AUTHOR: 'someuser',
      ASSOCIATION: 'OWNER',
    })
    expect(output.valid).toBe('true')
  })

  it('should accept /cody with subcommand', () => {
    const output = runScript({
      COMMENT_BODY: '/cody impl',
      AUTHOR: 'someuser',
      ASSOCIATION: 'OWNER',
    })
    expect(output.valid).toBe('true')
  })

  it('should reject /cody as substring (not prefix)', () => {
    const output = runScript({
      COMMENT_BODY: 'hello /cody world',
      AUTHOR: 'someuser',
      ASSOCIATION: 'OWNER',
    })
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

    // The fix: use truthy check instead of string comparison
    // BAD (before fix):  steps.safety.outputs.valid == 'true'
    // GOOD (after fix): steps.safety.outputs.valid

    // Check that the reaction step uses truthy check
    const reactionStepMatch = content.match(
      /name: Acknowledge command with reaction[\s\S]*?if: (.+)/,
    )
    expect(reactionStepMatch).toBeTruthy()

    const condition = reactionStepMatch![1]
    // Should NOT contain string comparison with 'true'
    expect(condition).not.toContain("== 'true'")
    expect(condition).not.toContain('== "true"')
    // Should use truthy evaluation
    expect(condition).toContain('steps.safety.outputs.valid')
  })

  it('should use truthy check for orchestrate job condition', () => {
    const workflowPath = path.join(process.cwd(), '.github/workflows/cody.yml')
    const content = fs.readFileSync(workflowPath, 'utf-8')

    // Check orchestrate job condition - find the orchestrate job and its if clause
    // The pattern is: "orchestrate:\n    needs: parse\n    if: ..."
    const orchestrateMatch = content.match(/orchestrate:\s+needs: parse\s+if: (.+)/)
    expect(orchestrateMatch).toBeTruthy()

    const condition = orchestrateMatch![1]
    // Should NOT contain string comparison
    expect(condition).not.toContain("== 'true'")
    expect(condition).not.toContain('== "true"')
    // Should use truthy evaluation
    expect(condition).toContain('needs.parse.outputs.valid')
  })
})

// ============================================================================
// Helper Functions
// ============================================================================

function runScript(envVars: Record<string, string>): Record<string, string> {
  // Create a temp file for output
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parse-safety-test-'))
  const outputPath = path.join(tempDir, 'output')

  // Set up environment and run script
  const env = {
    ...process.env,
    ...envVars,
    GITHUB_OUTPUT: outputPath,
  }

  try {
    execSync(`bash ${path.join(process.cwd(), 'scripts/cody/parse-safety.sh')}`, {
      env,
      encoding: 'utf-8',
    })
  } catch {
    // Script may exit non-zero, but we still want to read output
  }

  // Read output
  const output = fs.readFileSync(outputPath, 'utf-8')
  const result: Record<string, string> = {}

  for (const line of output.trim().split('\n')) {
    const [key, value] = line.split('=')
    if (key && value !== undefined) {
      result[key] = value
    }
  }

  // Cleanup
  fs.rmSync(tempDir, { recursive: true })

  return result
}
