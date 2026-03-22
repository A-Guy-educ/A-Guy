/**
 * @fileType utility
 * @domain cody | pipeline
 * @pattern post-action
 * @ai-summary Resolves pipeline profile (standard/lightweight) based on task definition,
 *   triggers two-phase pipeline rebuild, creates promoted stubs for skipped stages
 */

import * as fs from 'fs'
import * as path from 'path'

import { logger } from '../../logger'
import type { PipelineContext } from '../../engine/types'
import { readTask } from '../../pipeline-utils'
import { setProfileLabel } from '../../github-api'
import { buildPromotedStub } from './promoted-stub'

export async function executeResolveProfile(ctx: PipelineContext): Promise<void> {
  const taskDef = readTask(ctx.taskDir)
  if (taskDef) {
    // Apply --complexity override if provided (for testing/debugging)
    if (ctx.input.complexityOverride !== undefined) {
      const oldComplexity = taskDef.complexity
      taskDef.complexity = ctx.input.complexityOverride
      taskDef.complexity_reasoning = `Override via --complexity=${ctx.input.complexityOverride}`
      if (oldComplexity !== undefined) {
        logger.info(`  ℹ️ Complexity override: ${oldComplexity} → ${ctx.input.complexityOverride}`)
      } else {
        logger.info(`  ℹ️ Complexity override applied: ${ctx.input.complexityOverride}`)
      }
    }
    // Update ctx.taskDef so subsequent post-actions can access it
    ctx.taskDef = taskDef
    const { resolvePipelineProfile, getComplexityTier } = await import('../../pipeline-utils')
    ctx.profile = resolvePipelineProfile(taskDef)
    // Set profile label on the issue
    if (ctx.input.issueNumber) {
      setProfileLabel(ctx.input.issueNumber, ctx.profile)
    }
    // Signal engine to rebuild pipeline with new profile (two-phase construction)
    ctx.pipelineNeedsRebuild = true
    if (taskDef.complexity !== undefined) {
      const tier = getComplexityTier(taskDef.complexity)
      logger.info(`  ℹ️ Complexity: ${taskDef.complexity} (${tier}) → profile: ${ctx.profile}`)

      // R2-FIX #6: Warn when complexity seems mismatched with profile.
      // A lightweight profile with high complexity may skip important stages.
      if (ctx.profile === 'lightweight' && taskDef.complexity >= 35) {
        logger.warn(
          `  ⚠️ Profile/complexity mismatch: lightweight profile with complexity ${taskDef.complexity} (complex tier). ` +
            `Some stages may be unexpectedly skipped. Consider overriding with --profile=standard.`,
        )
      }
    } else {
      logger.info(
        `  ℹ️ Resolved profile: ${ctx.profile} (no complexity score, using legacy heuristic)`,
      )
    }

    // Create stub promoted files for stages in skip_stages
    // The skip condition checks file existence, so we must ensure the file exists
    // Stubs must include sections that downstream validators expect
    const skipStages = taskDef.input_quality?.skip_stages ?? []
    for (const stage of skipStages) {
      const outputFile = path.join(ctx.taskDir, `${stage}.md`)
      if (!fs.existsSync(outputFile)) {
        const stub = buildPromotedStub(stage, ctx.taskDir)
        fs.writeFileSync(outputFile, stub)
        logger.info(`  ℹ️ Created promoted stub: ${stage}.md`)
      }
    }
  }
}
