#!/usr/bin/env pnpm tsx
/**
 * @fileType script
 * @domain cody | system-test
 * @ai-summary Cleanup safety net - close all system test artifacts
 */

import { createSystemTestClient } from './lib/gh-client'
import { cleanupAllSystemTests } from './lib/cleanup'

async function main() {
  const args = process.argv.slice(2)
  let repo = process.env.REPO || ''
  let runId = ''

  // Parse args
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--repo' && i + 1 < args.length) {
      repo = args[i + 1]
      i++
    } else if (args[i] === '--run-id' && i + 1 < args.length) {
      runId = args[i + 1]
      i++
    }
  }

  if (!repo) {
    console.error('Error: --repo is required')
    console.error('Usage: pnpm tsx cleanup-all.ts --repo <owner/repo> --run-id <id>')
    process.exit(1)
  }

  console.log(`Cleaning up system test artifacts for repo: ${repo}`)
  if (runId) {
    console.log(`Run ID: ${runId}`)
  }
  console.log('')

  const gh = createSystemTestClient(repo)

  try {
    const result = await cleanupAllSystemTests(gh, repo)
    console.log('')
    console.log('Cleanup complete:')
    console.log(`  - Closed ${result.closedIssues} issues`)
    console.log(`  - Closed ${result.closedPRs} PRs`)
    console.log(`  - Deleted ${result.deletedBranches} branches`)
  } catch (error) {
    console.error('Cleanup failed:', error)
    // Don't fail - cleanup is best-effort
  }
}

main().catch((error) => {
  console.error('Fatal error:', error)
  // Exit 0 - cleanup is best-effort
  process.exit(0)
})
