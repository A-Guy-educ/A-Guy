#!/usr/bin/env npx tsx
/**
 * Create Pull Request Script
 *
 * @fileType utility
 * @domain git, automation
 * @ai-summary Create a PR with the Engineering Task Execution Contract template
 *
 * Usage:
 *   npx tsx .agents/skills/implement/scripts/create-pr.ts "PR Title" "What/Why" "Scope" "Test results"
 */

import { execSync } from 'child_process'
import { parseArgs } from 'util'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface Options {
  title: string
  whatWhy: string
  scope: string
  testResults: string
  baseBranch?: string
  dryRun: boolean
}

// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
}

function log(message: string, color = COLORS.reset) {
  console.log(`${color}${message}${COLORS.reset}`)
}

function error(message: string) {
  console.error(`${COLORS.red}${message}${COLORS.reset}`)
}

function runCommand(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf-8' }).trim()
  } catch (e: unknown) {
    const err = e as { message?: string }
    return err.message || ''
  }
}

function commandExists(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { encoding: 'utf-8', stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

// ─────────────────────────────────────────────
// Git Operations
// ─────────────────────────────────────────────

function getCurrentBranch(): string {
  return runCommand('git branch --show-current')
}

function getDefaultBranch(): string {
  try {
    const output = runCommand('git remote show origin')
    const match = output.match(/HEAD branch:\s*(\S+)/)
    return match ? match[1] : 'main'
  } catch {
    return 'main'
  }
}

function isGitRepo(): boolean {
  try {
    runCommand('git rev-parse --git-dir')
    return true
  } catch {
    return false
  }
}

function checkGhAuth(): boolean {
  try {
    execSync('gh auth status', { encoding: 'utf-8', stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function installGh() {
  log('GitHub CLI (gh) is not installed.', COLORS.yellow)
  log('Please install it: https://github.com/cli/cli#installation')
  process.exit(1)
}

function promptGhLogin() {
  log('Please authenticate with GitHub:', COLORS.yellow)
  log('Run: gh auth login')
  process.exit(1)
}

// ─────────────────────────────────────────────
// PR Creation
// ─────────────────────────────────────────────

function createPrBody(options: Options): string {
  return `## What / Why

${options.whatWhy}

## Scope of Changes

${options.scope}

## How It Was Tested

${options.testResults}

## Definition of Done Checklist

- [ ] All quality gates pass (typecheck, lint, format, tests)
- [ ] Zod validation at all modified/added API boundaries
- [ ] Pino logs with requestId correlation for server-side changes
- [ ] Sentry captures relevant errors
- [ ] Tests added/updated for logic changes or bug fixes
- [ ] No new dependencies without approval
- [ ] CI checks green

## Screenshots / GIF (if UI changed)

N/A

## Risks / Rollback Notes

[Any deployment risks or rollback instructions]

🤖 Generated with [Claude Code](https://claude.com/claude-code)
`
}

function createPr(options: Options, defaultBranch: string, currentBranch: string) {
  // Fetch latest changes
  log('Fetching latest changes from origin...')
  runCommand('git fetch origin')

  // Rebase on default branch
  log(`Rebasing ${currentBranch} on top of origin/${defaultBranch}...`)
  try {
    runCommand(`git rebase origin/${defaultBranch}`)
    log('✓ Branch successfully rebased', COLORS.green)
  } catch {
    error('❌ Rebase failed - please resolve conflicts manually')
    log('After resolving conflicts, run:')
    log('  git add <resolved-files>')
    log('  git rebase --continue')
    log('  git push -u origin ' + currentBranch + ' --force-with-lease')
    log('Then run this script again')
    process.exit(1)
  }

  // Push branch
  log(`Pushing branch: ${currentBranch}`)
  runCommand(`git push -u origin ${currentBranch} --force-with-lease`)

  // Create PR
  log('Creating pull request...')
  const body = createPrBody(options)

  try {
    execSync(`gh pr create --title "${options.title}" --body "${body.replace(/"/g, '\\"')}"`, {
      encoding: 'utf-8',
    })
  } catch (e: unknown) {
    const err = e as { message?: string }
    error('Failed to create PR: ' + (err.message || ''))
    process.exit(1)
  }

  log('✅ Pull request created successfully!', COLORS.green)
}

function dryRun(options: Options, defaultBranch: string, currentBranch: string) {
  log('[DRY RUN] Would perform the following actions:', COLORS.yellow)
  log('')
  log(`  1. Fetch from origin`)
  log(`  2. Rebase ${currentBranch} on origin/${defaultBranch}`)
  log(`  3. Push branch to origin`)
  log(`  4. Create PR: "${options.title}"`)
  log('')
  log('PR Body:')
  log('─'.repeat(40))
  console.log(createPrBody(options))
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

function main() {
  const { values, positionals } = parseArgs({
    options: {
      title: { type: 'string', short: 't' },
      'what-why': { type: 'string' },
      scope: { type: 'string', short: 's' },
      tests: { type: 'string' },
      'base-branch': { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    allowPositionals: true,
  })

  if (values.help) {
    console.log(`
Create Pull Request Script

Usage: npx tsx .agents/skills/implement/scripts/create-pr.ts [options] [title] [whatWhy] [scope] [tests]

Options:
  --title, -t <text>      PR title
  --what-why <text>       What/Why description
  --scope, -s <text>      Scope of changes
  --tests <text>          Test results
  --base-branch <name>    Base branch (auto-detected if omitted)
  --dry-run               Preview without creating PR
  --help, -h              Show this help message

Positional Arguments (all optional):
  1. title      - PR title (default: "feat: update")
  2. whatWhy    - What/Why description  
  3. scope      - Scope of changes
  4. tests      - Test results

Examples:
  npx tsx .../create-pr.ts -t "feat: add new feature" -s "src/api, src/utils" --tests "All tests pass"
  npx tsx .../create-pr.ts "fix: bug in auth" "Fixed token expiry" "src/auth" "Unit tests pass"
`)
    process.exit(0)
  }

  // Validate git repo
  if (!isGitRepo()) {
    error('Not a git repository')
    process.exit(1)
  }

  // Check gh CLI
  if (!commandExists('gh')) {
    installGh()
  }

  // Check gh auth
  if (!checkGhAuth()) {
    promptGhLogin()
  }

  // Get current branch
  const currentBranch = getCurrentBranch()
  const defaultBranch = values['base-branch'] || getDefaultBranch()

  // Safety check
  if (currentBranch === defaultBranch) {
    error(`❌ ERROR: Cannot push to default branch '${defaultBranch}'`)
    error('You are currently on the default branch.')
    error('Please switch to your feature branch first:')
    error(`  git checkout <your-feature-branch>`)
    process.exit(1)
  }

  log(`✓ Current branch: ${currentBranch} (safe to push)`, COLORS.green)
  log(`✓ Default branch: ${defaultBranch}`, COLORS.blue)

  // Get options (CLI or positional)
  const title = values.title || positionals[0] || 'feat: update'
  const whatWhy =
    values['what-why'] || positionals[1] || '[Brief description of what changed and why]'
  const scope = values.scope || positionals[2] || '[List affected files/modules/features]'
  const tests = values.tests || positionals[3] || '[Test results]'

  const options: Options = {
    title,
    whatWhy,
    scope,
    testResults: tests,
    baseBranch: defaultBranch,
    dryRun: values['dry-run'],
  }

  if (options.dryRun) {
    dryRun(options, defaultBranch, currentBranch)
  } else {
    createPr(options, defaultBranch, currentBranch)
  }
}

main()
