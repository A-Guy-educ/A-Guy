// preflight.ts - Pre-flight validation for Cody
import { logger } from './logger'
import { execFileSync } from 'child_process'
import * as fs from 'fs'

interface Check {
  name: string
  test: () => void
  errorMessage?: string
}

export function preflight(): void {
  const checks: Check[] = [
    {
      name: 'ocode CLI (via pnpm)',
      test: () => execFileSync('pnpm', ['ocode', '--version'], { stdio: 'pipe' }),
      errorMessage: 'Run: pnpm install',
    },
    {
      name: 'Git repository',
      test: () => execFileSync('git', ['rev-parse', '--git-dir'], { stdio: 'pipe' }),
      errorMessage: 'Initialize git: git init',
    },
    {
      name: 'pnpm',
      test: () => execFileSync('which', ['pnpm'], { stdio: 'pipe' }),
      errorMessage: 'Install: npm install -g pnpm',
    },
    {
      name: 'Node.js v18+',
      test: () => {
        const version = execFileSync('node', ['--version'], { encoding: 'utf-8' }).trim()
        const major = parseInt(version.slice(1).split('.')[0])
        if (major < 18) {
          throw new Error(`Node ${version} is too old, need v18+`)
        }
      },
      errorMessage: 'Upgrade Node.js to v18 or higher',
    },
    {
      name: 'package.json',
      test: () => {
        if (!fs.existsSync('./package.json')) {
          throw new Error('package.json not found')
        }
      },
      errorMessage: 'Run from project root with package.json',
    },
  ]

  logger.info('🔍 Pre-flight checks...')
  let failed = false
  const errors: string[] = []

  for (const check of checks) {
    try {
      check.test()
      logger.info(`  ✅ ${check.name}`)
    } catch {
      logger.info(`  ❌ ${check.name}`)
      if (check.errorMessage) {
        errors.push(`     ${check.errorMessage}`)
      }
      failed = true
    }
  }

  if (failed) {
    const errorDetails = errors.join('\n')
    throw new Error(
      `Pre-flight checks failed:\n${errorDetails}\n\nFix issues above before running pipeline.`,
    )
  }

  logger.info('✅ Pre-flight complete\n')
}
