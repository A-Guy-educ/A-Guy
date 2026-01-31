/**
 * Guardrail Test: No Direct Analytics.track() Calls in UI Code
 *
 * This integration test ensures that all analytics calls go through the
 * system event bus pattern. Direct analytics.track() calls in UI code
 * (React components, hooks) should be flagged.
 *
 * Run with: pnpm vitest run tests/int/guardrails/
 */

import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

describe('no-direct-analytics-in-ui', () => {
  /**
   * Files that are allowed to use analytics.track() directly.
   * These are the analytics infrastructure files.
   */
  const ALLOWED_PATHS = [
    // Analytics core infrastructure
    /src\/infra\/analytics\/core\//,
    /src\/infra\/analytics\/system-events-subscriber\.ts$/,
    // Adapters transform analytics calls
    /src\/infra\/analytics\/adapters\//,
    // Tests
    /tests\//,
  ]

  /**
   * UI code patterns that should NOT contain analytics.track() calls.
   * All analytics should go through systemEventBus.emit() instead.
   */
  const _UI_PATTERNS = [
    /src\/app\/\(frontend\)\//, // Frontend routes
    /src\/components\//, // React components
    /src\/ui\//, // UI components
  ]

  /**
   * Direct analytics.track() patterns that are forbidden in UI code.
   */
  const _FORBIDDEN_PATTERNS = [
    /analytics\.track\s*\(/, // Direct track() call
    /analytics\s*\.\s*track\s*\(/, // With analytics prefix
  ]

  it('should not have direct analytics.track() calls in frontend code', () => {
    const frontendDir = path.resolve(process.cwd(), 'src/app/(frontend)')
    const uiDir = path.resolve(process.cwd(), 'src/ui')

    const violations: string[] = []

    // Check frontend app directory
    checkDirectoryForViolations(frontendDir, violations)
    // Check UI directory
    checkDirectoryForViolations(uiDir, violations)

    // Filter out allowed files
    const actualViolations = violations.filter((violation) => {
      return !ALLOWED_PATHS.some((pattern) => pattern.test(violation))
    })

    expect(actualViolations).toHaveLength(0)
  })
})

/**
 * Recursively check a directory for analytics.track() violations.
 */
function checkDirectoryForViolations(dir: string, violations: string[]): void {
  if (!fs.existsSync(dir)) return

  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      // Skip node_modules and hidden directories
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
        continue
      }
      checkDirectoryForViolations(fullPath, violations)
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      const content = fs.readFileSync(fullPath, 'utf-8')

      // Check for direct analytics.track() calls (not through systemEventBus)
      const hasDirectTrackCall =
        content.includes('analytics.track(') || content.match(/analytics\s*\.\s*track\s*\(/)

      if (hasDirectTrackCall) {
        violations.push(fullPath)
      }
    }
  }
}
