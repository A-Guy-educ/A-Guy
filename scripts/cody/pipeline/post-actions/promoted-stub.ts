/**
 * @fileType utility
 * @domain cody | pipeline
 * @pattern post-action
 * @ai-summary Builds promoted stub files for stages skipped via input_quality.skip_stages
 */

import * as fs from 'fs'
import * as path from 'path'

/**
 * Build a promoted stub file for a skipped stage.
 * Includes sections that downstream validators expect.
 */
export function buildPromotedStub(stage: string, taskDir: string): string {
  const title = stage.charAt(0).toUpperCase() + stage.slice(1)

  if (stage === 'spec') {
    // Gap validator checks for ## Requirements or ## Acceptance Criteria
    // Pull description from task.md if available
    const taskMdPath = path.join(taskDir, 'task.md')
    let description = 'See task.md and task.json for full details.'
    if (fs.existsSync(taskMdPath)) {
      description = fs.readFileSync(taskMdPath, 'utf-8')
    }
    return `# Specification (promoted)

Skipped via input_quality — taskify determined spec is unnecessary.

## Requirements

${description}

## Acceptance Criteria

- [ ] Fix applied as described in task.md
- [ ] TypeScript compilation passes
- [ ] Unit tests pass
`
  }

  if (stage === 'architect' || stage === 'plan-gap') {
    // Build stage reads plan.md; plan-gap validator checks plan.md exists
    return `# ${title} (promoted)

Skipped via input_quality — taskify determined this stage is unnecessary.
See task.json input_quality.reasoning for details.

## Changes

See task.md for implementation details.
`
  }

  // Generic stub for other stages
  return `# ${title} (promoted)

Skipped via input_quality — taskify determined this stage is unnecessary.
See task.json input_quality.reasoning for details.
`
}
