#!/usr/bin/env tsx
/**
 * Pre-release checks to ensure everything is ready
 * Usage: pnpm tsx scripts/pre-release-check.ts
 */

import { execSync } from 'child_process'
import { exit } from 'process'

interface Check {
  name: string
  command: string
  validate: (output: string) => boolean
  error: string
}

const checks: Check[] = [
  {
    name: 'Clean working directory',
    command: 'git status --porcelain',
    validate: (output: string) => output.trim() === '',
    error: 'Working directory is not clean. Commit or stash your changes.',
  },
  {
    name: 'On main branch',
    command: 'git branch --show-current',
    validate: (output: string) => output.trim() === 'main',
    error: 'Not on main branch. Switch to main before releasing.',
  },
  {
    name: 'Up to date with remote',
    command: 'git fetch && git status -uno',
    validate: (output: string) => !output.includes('behind'),
    error: 'Branch is behind remote. Pull latest changes.',
  },
  {
    name: 'Typecheck passes',
    command: 'pnpm typecheck',
    validate: () => true,
    error: 'Typecheck is failing',
  },
  {
    name: 'Linting passes',
    command: 'pnpm lint',
    validate: () => true,
    error: 'Linting is failing',
  },
  {
    name: 'All tests pass',
    command: 'pnpm test',
    validate: () => true,
    error: 'Tests are failing',
  },
  {
    name: 'Build succeeds',
    command: 'pnpm build',
    validate: () => true,
    error: 'Build is failing',
  },
  {
    name: 'No TODO/FIXME in src/',
    command: 'grep -r "TODO\\|FIXME" src/ 2>/dev/null || true',
    validate: (output: string) => output.trim() === '',
    error: 'Found TODO/FIXME comments in source code',
  },
]

console.log('🔍 Running pre-release checks...\n')

let failed = false
const results: { name: string; passed: boolean; error?: string }[] = []

for (const check of checks) {
  try {
    process.stdout.write(`Checking: ${check.name}... `)
    const output = execSync(check.command, { encoding: 'utf-8', stdio: 'pipe' })

    if (!check.validate(output)) {
      console.log('❌')
      results.push({ name: check.name, passed: false, error: check.error })
      failed = true
    } else {
      console.log('✅')
      results.push({ name: check.name, passed: true })
    }
  } catch (error) {
    console.log('❌')
    results.push({ name: check.name, passed: false, error: check.error })
    failed = true
  }
}

console.log('\n' + '='.repeat(60))
console.log('RESULTS:')
console.log('='.repeat(60))

for (const result of results) {
  if (result.passed) {
    console.log(`✅ ${result.name}`)
  } else {
    console.log(`❌ ${result.name}`)
    console.log(`   ${result.error}`)
  }
}

console.log('='.repeat(60))

if (failed) {
  console.error('\n❌ Pre-release checks failed')
  console.error('Please fix the issues above before releasing.')
  exit(1)
}

console.log('\n✅ All pre-release checks passed!')
console.log('You can now proceed with the release.')
exit(0)
