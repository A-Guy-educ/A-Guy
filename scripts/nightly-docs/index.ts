#!/usr/bin/env tsx
/**
 * Nightly Docs Agent
 *
 * Detects structural changes and updates documentation accordingly.
 * Only creates a PR when doc-impacting changes are detected.
 *
 * Run: pnpm nightly-docs
 * Dry run: pnpm nightly-docs --dry-run
 */

import path from 'node:path'
import { parseConfig, type Config } from './config-parser'
import { computeDelta, type Delta, type FileChange } from './delta'
import { applyMappings, deduplicateChanges } from './mappings'
import { validateTargets, applyPatches, type PatchResult } from './patches'
import { createPR, updateExistingPR, hasOpenPR } from './pr'
import { loadState, saveState } from './state'

const REPO_ROOT = process.cwd()
const CONFIG_PATH = path.join(REPO_ROOT, 'docs/nightly-docs-agent/CONFIG.md')
const STATE_PATH = path.join(REPO_ROOT, '.ai-docs/nightly-docs-state.json')

// ============================================================================
// CLI Arguments
// ============================================================================

interface CLIArgs {
  dryRun: boolean
  verbose: boolean
  force: boolean
  simulate?: string[]
  since?: string
}

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2)
  const result: CLIArgs = {
    dryRun: false,
    verbose: false,
    force: false,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--dry-run') result.dryRun = true
    else if (arg === '--verbose') result.verbose = true
    else if (arg === '--force') result.force = true
    else if (arg === '--simulate' && args[i + 1]) {
      result.simulate = result.simulate || []
      result.simulate.push(args[++i])
    } else if (arg === '--since' && args[i + 1]) {
      result.since = args[++i]
    }
  }

  return result
}

// ============================================================================
// Logging
// ============================================================================

let VERBOSE = false

function log(level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR', message: string): void {
  if (level === 'DEBUG' && !VERBOSE) return

  const prefix = {
    DEBUG: '\x1b[90m[DEBUG]\x1b[0m',
    INFO: '\x1b[36m[INFO]\x1b[0m',
    WARN: '\x1b[33m[WARN]\x1b[0m',
    ERROR: '\x1b[31m[ERROR]\x1b[0m',
  }[level]

  console.log(`${prefix} ${message}`)
}

// ============================================================================
// Structural Filtering
// ============================================================================

interface StructuralFile {
  path: string
  status: FileChange['status']
  category: string
  impact: string
}

function matchGlob(filePath: string, glob: string): boolean {
  // Convert glob to regex
  const regexStr = glob
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/{{GLOBSTAR}}/g, '.*')
    .replace(/\./g, '\\.')

  const regex = new RegExp(`^${regexStr}$`)
  return regex.test(filePath)
}

function filterStructural(delta: Delta, config: Config): StructuralFile[] {
  const structural: StructuralFile[] = []

  for (const file of delta.files) {
    // Check ignore patterns
    let ignored = false
    for (const pattern of config.ignorePatterns) {
      if (matchGlob(file.path, pattern)) {
        log('DEBUG', `Ignoring ${file.path} (matches ${pattern})`)
        ignored = true
        break
      }
    }
    if (ignored) continue

    // Find matching structural path
    for (const [name, pathConfig] of Object.entries(config.structuralPaths)) {
      if (matchGlob(file.path, pathConfig.glob)) {
        log('DEBUG', `Structural match: ${file.path} -> ${name}`)
        structural.push({
          path: file.path,
          status: file.status,
          category: name,
          impact: pathConfig.docImpact,
        })
        break
      }
    }
  }

  return structural
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const args = parseArgs()
  VERBOSE = args.verbose

  log('INFO', 'Nightly Docs Agent starting...')
  if (args.dryRun) log('INFO', 'Running in DRY RUN mode')

  // Step 1: Load config
  log('INFO', `Loading config from ${path.relative(REPO_ROOT, CONFIG_PATH)}`)
  let config: Config
  try {
    config = parseConfig(CONFIG_PATH)
    log('DEBUG', `Loaded ${Object.keys(config.structuralPaths).length} structural paths`)
    log('DEBUG', `Loaded ${config.mappings.length} mapping rules`)
  } catch (err) {
    log('ERROR', `Failed to parse config: ${err}`)
    process.exit(1)
  }

  // Step 2: Compute delta
  let delta: Delta
  if (args.simulate) {
    // Simulate mode: create fake delta from CLI args
    log('INFO', 'Using simulated delta')
    delta = {
      files: args.simulate.map((s) => {
        const [filePath, status] = s.split(':')
        return { path: filePath, status: (status || 'add') as FileChange['status'] }
      }),
      baseCommit: 'simulated',
      headCommit: 'simulated',
    }
  } else {
    const state = args.force ? null : loadState(STATE_PATH)
    delta = computeDelta(state, args.since, config.stateConfig.fallback.lookbackHours)
    log('INFO', `Delta: ${delta.files.length} files changed since ${delta.baseCommit.slice(0, 7)}`)
  }

  // Step 3: Filter structural files
  const structural = filterStructural(delta, config)
  log('INFO', `Structural files: ${structural.length} of ${delta.files.length}`)

  // STOP CHECK #1
  if (structural.length === 0) {
    log('INFO', 'No structural changes detected. Exiting without PR.')
    process.exit(0)
  }

  // Log structural files
  for (const sf of structural) {
    log('DEBUG', `  [${sf.status}] ${sf.path} (${sf.category}, impact: ${sf.impact})`)
  }

  // Step 5: Apply mappings
  log('INFO', 'Applying mapping rules...')
  const matches = applyMappings(structural, config.mappings)

  // STOP CHECK #2
  if (matches.length === 0) {
    log('INFO', 'Structural changes found but no doc mappings apply. Exiting without PR.')
    process.exit(0)
  }

  log('INFO', `Matched ${matches.length} mapping rule(s)`)

  // Step 7: Deduplicate
  const changes = deduplicateChanges(matches)
  log('INFO', `Deduplicated to ${changes.length} doc change(s)`)

  // Step 8: Validate targets
  log('INFO', 'Validating targets...')
  const validated = validateTargets(changes, config)

  if (validated.length === 0) {
    log('WARN', 'All targets invalid or missing anchors. Exiting without PR.')
    process.exit(0)
  }

  log('INFO', `Validated ${validated.length} target(s)`)

  // Step 10: Apply patches
  log('INFO', 'Applying patches...')
  let results: PatchResult[]
  if (args.dryRun) {
    log('INFO', 'DRY RUN: Would apply patches to:')
    for (const change of validated) {
      log('INFO', `  - ${change.doc} -> section: "${change.section}"`)
    }
    results = validated.map((v) => ({ doc: v.doc, section: v.section, changed: true }))
  } else {
    results = applyPatches(validated, config)
  }

  const changedResults = results.filter((r) => r.changed)

  // STOP CHECK #4
  if (changedResults.length === 0) {
    log('INFO', 'Patches applied but no actual text changes. Exiting without PR.')
    process.exit(0)
  }

  log('INFO', `Changed ${changedResults.length} doc(s)`)

  // Step 12: Create PR
  if (args.dryRun) {
    log('INFO', 'DRY RUN: Would create PR with:')
    log(
      'INFO',
      `  Title: docs(nightly): update ${changedResults.length} doc(s) for structural changes`,
    )
    log('INFO', '  Triggering files:')
    const triggers = [...new Set(validated.flatMap((v) => v.actions.map((a) => a.trigger.path)))]
    for (const t of triggers) {
      log('INFO', `    - ${t}`)
    }
    log('INFO', '  Evidence:')
    for (const v of validated) {
      for (const e of v.combinedEvidence) {
        log('INFO', `    - ${e}`)
      }
    }
  } else {
    log('INFO', 'Creating PR...')
    const prUrl = hasOpenPR(config.prConfig.branch)
      ? updateExistingPR(changedResults, validated, config)
      : createPR(changedResults, validated, config)

    log('INFO', `PR: ${prUrl}`)

    // Update state
    saveState(STATE_PATH, {
      lastCommit: delta.headCommit,
      lastRun: new Date().toISOString(),
      processedFiles: validated.flatMap((v) => v.actions.map((a) => a.trigger.path)),
    })
    log('INFO', `State updated: commit ${delta.headCommit.slice(0, 7)}`)
  }

  log('INFO', 'Done!')
}

main().catch((err) => {
  log('ERROR', `Unhandled error: ${err}`)
  process.exit(1)
})
