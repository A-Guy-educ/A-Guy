/**
 * @fileType test
 * @domain ci | cody
 * @pattern security-fix-verification
 * @ai-summary Tests verifying shell injection fixes in editComment and getLatestIssueComment
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

// Read from github-api.ts where the implementations now live
const githubApiSource = fs.readFileSync(
  path.resolve(__dirname, '../../../../scripts/cody/github-api.ts'),
  'utf-8',
)

// ============================================================================
// Step 5: editComment shell injection fix
// ============================================================================

describe('Bug 6: editComment should not use execSync with string interpolation', () => {
  // Extract the editComment function body
  const fnStart = githubApiSource.indexOf('export function editComment(')
  const fnEnd = githubApiSource.indexOf('\nexport ', fnStart + 1)
  const fnBody = githubApiSource.slice(fnStart, fnEnd > -1 ? fnEnd : fnStart + 2000)

  it('should NOT use execSync with template literal containing commentId or repo', () => {
    // execSync with interpolated variables is a shell injection vector
    const hasExecSyncInterpolation = /execSync\s*\(\s*`[^`]*\$\{(commentId|repo)\}/.test(fnBody)
    expect(hasExecSyncInterpolation).toBe(false)
  })

  it('should use execFileSync with argument array', () => {
    expect(fnBody).toContain('execFileSync')
  })

  it('should pass gh as first argument to execFileSync', () => {
    expect(fnBody).toMatch(/execFileSync\s*\(\s*'gh'/)
  })
})

// ============================================================================
// Step 6: getLatestIssueComment shell injection fix
// ============================================================================

describe('Bug 7: getLatestIssueComment should not use execSync with string interpolation', () => {
  const fnStart = githubApiSource.indexOf('export function getLatestIssueComment(')
  const fnEnd = githubApiSource.indexOf('\nexport ', fnStart + 1)
  const fnBody = githubApiSource.slice(fnStart, fnEnd > -1 ? fnEnd : fnStart + 2000)

  it('should NOT use execSync with template literal containing issueNumber or exclude', () => {
    const hasExecSyncInterpolation = /execSync\s*\(\s*`[^`]*\$\{(issueNumber|exclude)\}/.test(
      fnBody,
    )
    expect(hasExecSyncInterpolation).toBe(false)
  })

  it('should use execFileSync with argument array', () => {
    expect(fnBody).toContain('execFileSync')
  })

  it('should sanitize the excludeAuthor parameter', () => {
    // Defense-in-depth: excludeAuthor should be sanitized
    expect(fnBody).toMatch(/replace\s*\(\s*\/\[/)
  })
})

// ============================================================================
// General: execFileSync import
// ============================================================================

describe('github-api should import execFileSync', () => {
  it('should import execFileSync from child_process', () => {
    const importBlock = githubApiSource.slice(0, 500)
    expect(importBlock).toContain('execFileSync')
  })
})
