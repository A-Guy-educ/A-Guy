/**
 * @fileType utility
 * @domain ci | cody
 * @pattern content-validation
 * @ai-summary Pure validation functions for pipeline stage outputs — extracted from cody.ts for testability
 */

import * as fs from 'fs'

// ============================================================================
// Question Detection
// ============================================================================

/**
 * Check if questions.md contains actual questions that need answering
 */
export function checkForQuestions(questionsPath: string): boolean {
  const content = fs.readFileSync(questionsPath, 'utf-8').trim()

  // If file is empty or just placeholder text, no questions
  if (!content || content.length < 10) {
    return false
  }

  // Check for question patterns:
  // - Lines starting with numbers followed by period or parenthesis (1. 2. 1) 2))
  // - Lines containing "?" character
  // - Sections like "## Questions" or "### Clarifications Needed"
  const hasNumberedQuestions = /^\d+[.)]\s+/m.test(content)
  // Match ? at end of a sentence (after a word char), not in URLs or code
  const hasQuestionMarks = /\w\?\s*$/m.test(content)
  const hasQuestionHeader = /^#{1,3}\s*(Questions|Clarifications|Needs Clarification)/m.test(
    content,
  )

  // Also check for "APPROVED" or "No clarifications needed" as indicators of no questions
  const isApproved = /^#{1,3}\s*APPROVED/im.test(content)
  const noClarifications = /no clarifications needed/i.test(content)

  // Has questions if there's question content AND not explicitly approved
  const hasQuestionContent = hasNumberedQuestions || hasQuestionMarks || hasQuestionHeader

  return hasQuestionContent && !isApproved && !noClarifications
}

// ============================================================================
// Spec Content Validation
// ============================================================================

/**
 * Validate that spec content contains required sections.
 * Returns true if valid, false otherwise.
 */
export function validateSpecContent(specContent: string): boolean {
  const hasRequirements = /##\s*(Requirements|Functional|FR-|NFR-)/i.test(specContent)
  const hasAcceptance = /##\s*Acceptance/i.test(specContent)
  return hasRequirements || hasAcceptance
}

/**
 * Validate spec file and return validation result.
 * Throws if spec is invalid.
 */
export function validateSpecFile(specFilePath: string): void {
  if (!fs.existsSync(specFilePath)) {
    throw new Error(`Spec file not found: ${specFilePath}`)
  }

  const specContent = fs.readFileSync(specFilePath, 'utf-8')
  if (!validateSpecContent(specContent)) {
    throw new Error('Spec missing ## Requirements or ## Acceptance Criteria sections')
  }
}

// ============================================================================
// Build Report Validation
// ============================================================================

/**
 * Validate that build report contains a changes section.
 * Returns true if valid, false otherwise.
 */
export function validateBuildReport(buildContent: string): boolean {
  return /##\s*(Changes|Files)/i.test(buildContent)
}

/**
 * Validate build file and return validation result.
 * Returns warning string if missing Changes section, empty string if valid.
 */
export function validateBuildFile(buildFilePath: string): string {
  if (!fs.existsSync(buildFilePath)) {
    return ''
  }

  const buildContent = fs.readFileSync(buildFilePath, 'utf-8')
  if (!validateBuildReport(buildContent)) {
    return 'Build report missing Changes section — agent may not have implemented anything'
  }
  return ''
}

// ============================================================================
// Plan Gap Report Validation
// ============================================================================

/**
 * Validate plan-gap report content.
 * Reuses same logic as validateGapReport - both follow same format.
 * Returns true if valid, false otherwise.
 */
export function validatePlanGapReport(gapContent: string): boolean {
  const trimmed = gapContent.trim()

  // Empty content is invalid
  if (!trimmed || trimmed.length < 10) {
    return false
  }

  // Check for required sections
  const hasGapsFound = /##\s*Gaps?\s*(Found|Identified)/i.test(gapContent)
  const hasChangesMade = /##\s*Changes Made/i.test(gapContent)
  const hasNoGaps = /no gaps identified/i.test(gapContent.toLowerCase())

  return hasGapsFound || hasChangesMade || hasNoGaps
}

// ============================================================================
// Verify Summary Extraction
// ============================================================================

/**
 * Extract verification summary from verify output content
 */
export interface VerifySummary {
  typeScriptErrors: number
  testFailures: number
  lintErrors: number
  errorSamples: string[]
}

export function extractVerifySummary(content: string): VerifySummary {
  const summary: VerifySummary = {
    typeScriptErrors: 0,
    testFailures: 0,
    lintErrors: 0,
    errorSamples: [],
  }

  const tsMatch = content.match(/TypeScript.*?(\d+)\s+error/i)
  if (tsMatch) summary.typeScriptErrors = parseInt(tsMatch[1])

  const testMatch = content.match(/Tests?.*?(\d+)\s+fail/i)
  if (testMatch) summary.testFailures = parseInt(testMatch[1])

  const lintMatch = content.match(/Lint.*?(\d+)\s+error/i)
  if (lintMatch) summary.lintErrors = parseInt(lintMatch[1])

  const lines = content.split('\n')
  for (const line of lines) {
    if (
      (line.trim().startsWith('-') || line.trim().startsWith('•')) &&
      (line.includes('error') || line.includes('Error') || line.includes('✗'))
    ) {
      const cleaned = line.trim().replace(/^[-•]\s*/, '')
      if (cleaned.length > 10 && summary.errorSamples.length < 5) {
        summary.errorSamples.push(cleaned)
      }
    }
  }
  return summary
}

/**
 * Check if verify content indicates failure.
 * Matches "Result: FAIL" anywhere in content, not per-gate failures like "TypeScript: FAIL".
 */
export function isVerifyFailed(verifyContent: string): boolean {
  return /\bResult:\s*FAIL\b/i.test(verifyContent)
}

// ============================================================================
// Build Tests Validation
// ============================================================================

/**
 * Validate that build report has tests written.
 * For implement_feature and fix_bug task types, tests are required.
 * For other types (refactor, docs, ops), tests are optional (warning only).
 */
export function validateBuildTests(buildContent: string): { hasTests: boolean; warning: string } {
  // Look for "Tests Written" section (case insensitive)
  // Split content by ## to find the section
  const sections = buildContent.split(/\n## /i)

  // Find the Tests Written section
  const testsSection = sections.find((section) => /^Tests?\s*Written/i.test(section))

  // If no Tests Written section at all
  if (!testsSection) {
    return {
      hasTests: false,
      warning: 'Build report missing ## Tests Written section',
    }
  }

  // Get content after the header (first line is "Tests Written\n")
  const lines = testsSection.split('\n')
  // Skip the first line (header) and get remaining content
  const contentAfterHeader = lines.slice(1).join('\n').trim()

  // Check for empty content (just whitespace or empty string)
  if (!contentAfterHeader) {
    return {
      hasTests: false,
      warning: 'Build report indicates no tests were written',
    }
  }

  const testsContent = contentAfterHeader.toLowerCase()

  // Check for indicators that no tests were written
  const noTestsIndicators = ['no tests', 'none', 'n/a', 'not applicable', 'skipped', 'skip']
  const hasNoTestsIndicator = noTestsIndicators.some((indicator) =>
    testsContent.includes(indicator),
  )

  if (hasNoTestsIndicator) {
    return {
      hasTests: false,
      warning: 'Build report indicates no tests were written',
    }
  }

  // Tests were written (section exists and has content)
  return { hasTests: true, warning: '' }
}

// ============================================================================
// Gap Report Validation
// ============================================================================

/**
 * Validate that gap report contains required sections.
 * Returns true if valid, false otherwise.
 */
export function validateGapReport(gapContent: string): boolean {
  const trimmed = gapContent.trim()

  // Empty content is invalid
  if (!trimmed || trimmed.length < 10) {
    return false
  }

  // Check for required sections
  const hasGapsFound = /##\s*Gaps?\s*(Found|Identified)/i.test(gapContent)
  const hasChangesMade = /##\s*Changes Made/i.test(gapContent)
  const hasNoGaps = /no gaps identified/i.test(gapContent.toLowerCase())

  return hasGapsFound || hasChangesMade || hasNoGaps
}

// ============================================================================
// Test Report Validation
// ============================================================================

/**
 * Validate that test.md contains required sections indicating tests were written.
 */
export function validateTestReport(content: string): boolean {
  const hasTestsWritten = /##\s*Tests?\s*Written/i.test(content)
  const hasTestCases = /##\s*Test\s*Cases/i.test(content)
  const hasTestFiles = /##\s*Test\s*Files/i.test(content)

  return hasTestsWritten || hasTestCases || hasTestFiles
}
