/**
 * @fileType script
 * @domain cody
 * @pattern version-management
 * @ai-summary Tag and manage Cody pipeline versions
 */

import { execSync } from 'child_process'
import * as fs from 'fs'

const TAG_PREFIX = 'cody-v'
const WORKFLOW_FILE = '.github/workflows/cody.yml'

// ============================================================================
// Helpers
// ============================================================================

function run(
  cmd: string,
  options: { encoding?: BufferEncoding; stdio?: 'pipe' | 'inherit' } = {},
): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: 'pipe', ...options }).trim()
  } catch (err: unknown) {
    const error = err as { stdout?: string; message?: string }
    if (error.stdout) return error.stdout.trim()
    console.error(`Error running: ${cmd}`)
    console.error(error.message)
    process.exit(1)
  }
}

function getLatestTagNumber(): number {
  const output = run(
    `git tag --list '${TAG_PREFIX}*' --sort=-version:refname 2>/dev/null | head -1`,
  )
  if (!output) return 0
  const match = output.match(/^cody-v(\d+)$/)
  return match ? parseInt(match[1], 10) : 0
}

function getCurrentBranch(): string {
  return run('git branch --show-current')
}

function getCurrentMessage(): string {
  const branch = getCurrentBranch()
  if (branch === 'main' || branch === 'master') {
    return 'Stable pipeline'
  }
  return `Development: ${branch}`
}

function readWorkflowVersion(): string | null {
  try {
    const content = fs.readFileSync(WORKFLOW_FILE, 'utf-8')
    const match = content.match(/CODY_DEFAULT_VERSION:\s*(\S+)/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

function updateWorkflowVersion(version: string): void {
  const content = fs.readFileSync(WORKFLOW_FILE, 'utf-8')
  const newContent = content.replace(/(CODY_DEFAULT_VERSION:\s*)\S+/, `$1${version}`)
  fs.writeFileSync(WORKFLOW_FILE, newContent)
  console.log(`Updated ${WORKFLOW_FILE}: default version → ${version}`)
}

// ============================================================================
// Commands
// ============================================================================

function cmdList() {
  const output = run(`git tag --list '${TAG_PREFIX}*' --sort=-version:refname`)
  if (!output) {
    console.log('No versions found.')
    return
  }

  const tags = output.split('\n').filter(Boolean)
  const currentDefault = readWorkflowVersion()

  console.log('Available versions:')
  console.log('')
  for (const tag of tags) {
    const commit = run(`git rev-list -1 ${tag}`).slice(0, 7)
    const date = run(`git log -1 --format=%ci ${tag} 2>/dev/null`).split(' ')[0] || '-'
    const isDefault = tag === currentDefault ? ' (default)' : ''
    console.log(`  ${tag}  ${commit}  ${date}${isDefault}`)
  }
}

function cmdCurrent() {
  const version = readWorkflowVersion()
  if (version) {
    console.log(version)
  } else {
    console.log('(no default set - uses current branch code)')
  }
}

function cmdCreate(options: { setDefault?: boolean; version?: string }) {
  let tagName: string
  let commitMsg: string

  if (options.version) {
    // Explicit version: cody-v2
    tagName = options.version.startsWith(TAG_PREFIX)
      ? options.version
      : `${TAG_PREFIX}${options.version}`
  } else {
    // Auto-increment
    const nextNum = getLatestTagNumber() + 1
    tagName = `${TAG_PREFIX}${nextNum}`
  }

  // Check if tag already exists
  const existing = run(`git tag -l ${tagName}`)
  if (existing) {
    console.error(
      `Tag ${tagName} already exists. Use --set-default to update default or specify a new version.`,
    )
    process.exit(1)
  }

  // Create annotated tag
  // eslint-disable-next-line prefer-const
  commitMsg = getCurrentMessage()
  run(`git tag -a ${tagName} -m "${tagName}: ${commitMsg}"`)
  console.log(`Created tag: ${tagName}`)

  // Optionally set as default
  if (options.setDefault) {
    updateWorkflowVersion(tagName)
  }
}

function cmdSetDefault(version?: string) {
  let tagName: string

  if (version) {
    // Specific version: v2 -> cody-v2
    tagName = version.startsWith(TAG_PREFIX) ? version : `${TAG_PREFIX}${version}`
  } else {
    // Use latest tag
    tagName = `${TAG_PREFIX}${getLatestTagNumber()}`
  }

  // Verify tag exists
  const existing = run(`git tag -l ${tagName}`)
  if (!existing) {
    console.error(`Tag ${tagName} does not exist. Create it first with: pnpm cody:tag`)
    process.exit(1)
  }

  updateWorkflowVersion(tagName)
}

// ============================================================================
// Main
// ============================================================================

function main() {
  const args = process.argv.slice(2)
  const flags = args.filter((a) => a.startsWith('--'))
  const positional = args.filter((a) => !a.startsWith('--'))

  const hasList = flags.includes('--list')
  const hasCurrent = flags.includes('--current')
  const hasSetDefault = flags.includes('--set-default')
  const hasHelp = flags.includes('--help') || flags.includes('-h')

  if (hasHelp) {
    console.log(`
Cody Pipeline Version Manager

Usage: pnpm cody:tag [command] [options]

Commands:
  (none)              Create a new version tag (auto-increment from latest)
  --list              List all version tags
  --current           Show current default version
  --set-default       Set latest tag as default (after creating it)
  --set-default vN    Set specific version as default

Examples:
  pnpm cody:tag                     # Create cody-v3, cody-v2 is latest
  pnpm cody:tag --list              # Show all versions
  pnpm cody:tag --set-default       # Set newly created tag as default
  pnpm cody:tag --set-default v2    # Set cody-v2 as default
  pnpm cody:tag --current           # Show current default

The default version is stored in .github/workflows/cody.yml
as CODY_DEFAULT_VERSION. Runs without --version use this default.
`)
    return
  }

  if (hasList) {
    cmdList()
    return
  }

  if (hasCurrent) {
    cmdCurrent()
    return
  }

  if (hasSetDefault) {
    const versionArg = positional[0]?.replace(/^v/, '')
    cmdSetDefault(versionArg)
    return
  }

  // Default: create new tag
  const versionArg = positional[0]?.replace(/^v/, '')
  cmdCreate({ setDefault: hasSetDefault, version: versionArg })
}

main()
