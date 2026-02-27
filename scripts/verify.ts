#!/usr/bin/env tsx
/**
 * Pre-push verification script
 * Usage: pnpm verify
 * Runs: generate:types → generate:importmap → [parallel: prettier, lint, typecheck, test:unit]
 * Note: Build removed - CI catches build failures, typecheck catches most issues
 */

import { execSync } from 'child_process'
import { cpus } from 'os'

// ANSI colors (same pattern as setup.ts)
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
}

function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`)
}

function success(message: string) {
  log(`✅ ${message}`, colors.green)
}

function error(message: string) {
  log(`❌ ${message}`, colors.red)
}

function info(message: string) {
  log(`${message}`, colors.yellow)
}

interface VerifyStep {
  name: string
  command: string
}

const steps: VerifyStep[] = [
  { name: 'Prettier', command: 'pnpm prettier --check .' },
  { name: 'Lint', command: 'pnpm lint' },
  { name: 'Typecheck', command: 'pnpm typecheck' },
  // Build removed - CI will catch build failures, typecheck catches most issues
  { name: 'Unit tests', command: 'pnpm test:unit' },
]

async function runStepAsync(
  stepInfo: VerifyStep,
): Promise<{ name: string; success: boolean; error?: Error }> {
  return new Promise((resolve) => {
    try {
      execSync(stepInfo.command, { stdio: 'inherit' })
      resolve({ name: stepInfo.name, success: true })
    } catch (err) {
      resolve({ name: stepInfo.name, success: false, error: err as Error })
    }
  })
}

async function main(): Promise<void> {
  log('\n=== Verification Gate ===\n', colors.bright)

  // Pre-commit verifications
  info('pre-commit verifications:')

  // R10: Wrap generate commands in try/catch - run in parallel for speed
  info('generating types and import map in parallel')
  try {
    await Promise.all([
      execSync('pnpm generate:types', { stdio: 'inherit' }),
      execSync('pnpm generate:importmap', { stdio: 'inherit' }),
    ])
    success('Types and import map generated')
  } catch {
    error('Generation failed')
    process.exit(1)
  }

  info('running verifications in parallel:')

  // Run verification steps in parallel
  const maxConcurrency = Math.min(cpus().length, steps.length)
  info(`(max concurrency: ${maxConcurrency})\n`)

  // Process steps in batches for better output readability
  let stepIndex = 0
  const results: { name: string; success: boolean }[] = []

  async function runBatch(): Promise<void> {
    const batch: VerifyStep[] = []
    const batchStart = stepIndex

    // Take up to maxConcurrency steps for this batch
    while (stepIndex < steps.length && stepIndex < batchStart + maxConcurrency) {
      batch.push(steps[stepIndex])
      stepIndex++
    }

    if (batch.length === 0) return

    // Run batch in parallel
    const batchResults = await Promise.all(batch.map((step) => runStepAsync(step)))
    results.push(...batchResults)

    // Log results for this batch
    for (const result of batchResults) {
      if (result.success) {
        success(`${result.name} passed`)
      } else {
        error(`${result.name} failed`)
      }
    }
  }

  // Run all batches
  while (stepIndex < steps.length) {
    await runBatch()
  }

  // Check for failures
  const failedSteps = results.filter((r) => !r.success)
  if (failedSteps.length > 0) {
    error(`\nVerification failed! Failed steps: ${failedSteps.map((f) => f.name).join(', ')}`)
    process.exit(1)
  }

  success('\n=== All verification checks passed ===\n')
  process.exit(0)
}

main()
