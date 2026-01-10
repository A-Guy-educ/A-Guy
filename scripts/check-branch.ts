#!/usr/bin/env tsx
/**
 * Check if current branch follows naming conventions
 * Usage: pnpm tsx scripts/check-branch.ts
 */

import { execSync } from 'child_process'

const branchPatterns = [
  /^feat\/.+$/, // feature branches
  /^fix\/.+$/, // bug fix branches
  /^chore\/.+$/, // chore branches
  /^docs\/.+$/, // documentation branches
  /^refactor\/.+$/, // refactoring branches
  /^test\/.+$/, // test branches
  /^security\/.+$/, // security branches
  /^(main|dev)$/, // main branches
]

const branchExamples = `
Branch names must follow one of these patterns:
  ✅ feat/<description>     - New features
  ✅ fix/<description>      - Bug fixes
  ✅ chore/<description>    - Maintenance tasks
  ✅ docs/<description>     - Documentation changes
  ✅ refactor/<description> - Code refactoring
  ✅ test/<description>     - Test additions/changes
  ✅ security/<description> - Security fixes
  ✅ main or dev            - Main branches

Examples:
  git checkout -b feat/user-authentication
  git checkout -b fix/login-bug
  git checkout -b chore/update-dependencies
  git checkout -b security/fix-xss-vulnerability
`

try {
  const branch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim()

  if (!branch) {
    console.error('❌ Error: Could not determine current branch')
    process.exit(1)
  }

  const isValid = branchPatterns.some((pattern) => pattern.test(branch))

  if (!isValid) {
    console.error(`\n❌ Invalid branch name: '${branch}'`)
    console.error(branchExamples)
    process.exit(1)
  }

  console.log(`✅ Branch name is valid: '${branch}'`)
  process.exit(0)
} catch (error) {
  console.error('❌ Failed to check branch name:', error)
  process.exit(1)
}
