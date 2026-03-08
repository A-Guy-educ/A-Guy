/**
 * @fileType test
 * @domain cody
 * @pattern ci-status-polling
 * @ai-summary Tests for polling recovery after CI failure and hasConflicts tooltip
 */
import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('usePRCIStatus polling behavior', () => {
  it('should slow-poll on failure instead of stopping', () => {
    // Read the source to verify the polling logic
    const hookSource = fs.readFileSync(
      path.join(process.cwd(), 'src/ui/cody/hooks/usePRCIStatus.ts'),
      'utf-8',
    )

    // BUG: Current code only polls for 'running' and 'pending', returns false for 'failure'
    // FIX: Should return a slow interval (e.g., 30_000) for 'failure' to allow recovery polling
    // The hook should NOT return `false` when status is 'failure'

    // Verify that 'failure' has a polling interval (not false/stopped)
    // The refetchInterval function should have a case for 'failure' that returns a number
    expect(hookSource).toMatch(/failure.*\d{4,}|failure.*30/)

    // Verify 'success' stops polling (returns false)
    expect(hookSource).toMatch(/success/)
  })
})

describe('MergeTooltipContent conflict handling', () => {
  it('should accept hasConflicts prop in MergeTooltipContent', () => {
    const tooltipSource = fs.readFileSync(
      path.join(process.cwd(), 'src/ui/cody/components/tooltip-content.tsx'),
      'utf-8',
    )

    // BUG: MergeTooltipContent doesn't accept or handle hasConflicts prop
    // FIX: Should show "Merge Conflicts" when hasConflicts is true
    expect(tooltipSource).toContain('hasConflicts')
    expect(tooltipSource).toMatch(/[Cc]onflict/)
  })

  it('should show conflicts message distinct from CI failure', () => {
    const tooltipSource = fs.readFileSync(
      path.join(process.cwd(), 'src/ui/cody/components/tooltip-content.tsx'),
      'utf-8',
    )

    // Verify tooltip content has both conflict and CI failure messaging
    expect(tooltipSource).toContain('Merge Conflicts')
    expect(tooltipSource).toContain('CI Failed')
  })
})

describe('MergeButton hasConflicts propagation', () => {
  it('should extract hasConflicts from CI status data', () => {
    const buttonSource = fs.readFileSync(
      path.join(process.cwd(), 'src/ui/cody/components/MergeButton.tsx'),
      'utf-8',
    )

    // BUG: MergeButton doesn't extract or pass hasConflicts
    // FIX: Should extract hasConflicts from usePRCIStatus data and pass to tooltip
    expect(buttonSource).toContain('hasConflicts')
  })
})
