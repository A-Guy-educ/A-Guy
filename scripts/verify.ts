#!/usr/bin/env tsx
/**
 * Pre-push verification script
 * Usage: pnpm verify
 * Runs: generate:types → generate:importmap → prettier → lint → typecheck → [build] → test:unit
 * Set SKIP_BUILD=1 to skip the Next.js build step (used in CI pipelines)
 */

import { execSync } from 'child_process'

// ANSI colors (same pattern as setup.ts)
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
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

function section(message: string) {
  log(`\n${message}`, colors.cyan)
}

interface VerifyStep {
  name: string
  command: string
}

const skipBuild = process.env.SKIP_BUILD === '1' || process.env.SKIP_BUILD === 'true'

const steps: VerifyStep[] = [
  { name: 'Prettier', command: 'pnpm prettier --check .' },
  { name: 'Lint', command: 'pnpm lint' },
  { name: 'Typecheck', command: 'pnpm typecheck' },
  ...(skipBuild ? [] : [{ name: 'Build', command: 'pnpm build' }]),
  { name: 'Unit tests', command: 'pnpm test:unit' },
]

function runStep(stepInfo: VerifyStep, index: number, total: number): boolean {
  section(`[${index}/${total}] Running ${stepInfo.name}...`)
  try {
    execSync(stepInfo.command, { stdio: 'inherit' })
    success(`${stepInfo.name} passed`)
    return true
  } catch {
    error(`${stepInfo.name} failed`)
    return false
  }
}

function main(): void {
  log('\n=== Verification Gate ===\n', colors.bright)

  // Pre-commit verifications
  info('pre-commit verifications:')

  // R10: Wrap generate commands in try/catch
  info('generating types')
  try {
    execSync('pnpm generate:types', { stdio: 'inherit' })
    success('Types generated')
  } catch {
    error('Types generation failed')
    process.exit(1)
  }

  info('generating import map')
  try {
    execSync('pnpm generate:importmap', { stdio: 'inherit' })
    success('Import map generated')
  } catch {
    error('Import map generation failed')
    process.exit(1)
  }

  if (skipBuild) {
    info('SKIP_BUILD=1 — skipping Next.js build step')
  }

  info('running verifications:')

  // Run verification steps
  for (let i = 0; i < steps.length; i++) {
    if (!runStep(steps[i], i, steps.length - 1)) {
      error('\nVerification failed!')
      process.exit(1)
    }
  }

  success('\n=== All verification checks passed ===\n')
  process.exit(0)
}

main()
