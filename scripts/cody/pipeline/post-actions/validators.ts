/**
 * @fileType utility
 * @domain cody | pipeline
 * @pattern post-action
 * @ai-summary Build/source validation post-actions — validates plan exists,
 *   build content has required sections, and build agent modified source files
 */

import * as fs from 'fs'
import * as path from 'path'
import { execFileSync } from 'child_process'

import { logger } from '../../logger'
import type { PipelineContext } from '../../engine/types'

export async function executeValidatePlanExists(ctx: PipelineContext): Promise<void> {
  const planFile = path.join(ctx.taskDir, 'plan.md')
  const gapFile = path.join(ctx.taskDir, 'gap.md')

  if (!fs.existsSync(planFile)) {
    throw new Error('plan.md not found - gap agent may have deleted it')
  }

  const gapContent = fs.existsSync(gapFile) ? fs.readFileSync(gapFile, 'utf-8') : ''

  // Basic validation - check for expected sections
  if (!gapContent.includes('## ') && !gapContent.includes('No gaps identified')) {
    throw new Error('gap.md must contain ## sections or "No gaps identified"')
  }
}

export async function executeValidateBuildContent(ctx: PipelineContext): Promise<void> {
  const buildFile = path.join(ctx.taskDir, 'build.md')
  if (!fs.existsSync(buildFile)) {
    throw new Error('build.md not found')
  }

  const buildContent = fs.readFileSync(buildFile, 'utf-8')

  // Check for required sections
  if (!buildContent.includes('## Changes') && !buildContent.includes('## Files')) {
    throw new Error('build.md must contain ## Changes or ## Files section')
  }
}

export async function executeValidateSrcChanges(ctx: PipelineContext): Promise<void> {
  if (ctx.input.dryRun) return

  // Check that the build agent actually modified source files, not just .tasks/
  let diff = ''
  let untracked = ''
  let gitFailed = false
  try {
    diff = execFileSync('git', ['diff', '--name-only'], { encoding: 'utf-8' }).trim()
  } catch (error) {
    logger.error({ err: error }, 'git diff failed during src validation')
    gitFailed = true
  }
  try {
    untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {
      encoding: 'utf-8',
    }).trim()
  } catch (error) {
    logger.error({ err: error }, 'git ls-files failed during src validation')
    gitFailed = true
  }

  if (gitFailed) {
    throw new Error(
      'validate-src-changes: git commands failed — cannot verify source changes. Check git state.',
    )
  }

  const allChanged = [...diff.split('\n'), ...untracked.split('\n')]
    .filter(Boolean)
    .filter((f) => !f.startsWith('.tasks/'))

  if (allChanged.length === 0) {
    throw new Error(
      'Build agent wrote build.md but did NOT modify any source files. ' +
        'The agent must use Edit/Write tools to implement actual code changes, not just document them in build.md.',
    )
  }

  logger.info(`   ✓ ${allChanged.length} source file(s) changed by build agent`)
}
