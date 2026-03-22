/**
 * @fileType handler
 * @domain cody | modes
 * @ai-summary Pipeline mode handler — extracted from entry.ts for modularity
 */

import * as fs from 'fs'
import * as path from 'path'

import type { PipelineContext } from '../engine/types'
import { PipelinePausedError } from '../engine/types'
import { runPipeline } from '../engine/state-machine'
import { resolvePipelineForMode } from '../engine/pipeline-resolver'
import { logger } from '../logger'
import { commitPipelineFiles } from '../git-utils'

import { ensureTaskMd } from '../task-setup'
import { handleClarification } from '../clarify-workflow'
import { postComment } from '../github-api'

export async function runSpecMode(ctx: PipelineContext): Promise<void> {
  const { input, taskDir } = ctx

  // R4: Ensure task.md exists before running pipeline
  await ensureTaskMd(ctx)

  // Run spec pipeline
  const pipeline = resolvePipelineForMode('spec', 'standard', input.clarify ?? false, ctx)
  await runPipeline(ctx, pipeline)

  // G17: Post-spec clarification logic
  if (input.clarify) {
    const clarifyResult = handleClarification(input, taskDir)
    if (clarifyResult === 'waiting') {
      logger.info('\n⚠️ Clarify stage has questions that need answering')
      const questionsPath = path.join(taskDir, 'questions.md')
      if (input.issueNumber) {
        let preview = '(questions file not found)'
        try {
          if (fs.existsSync(questionsPath)) {
            const questionsContent = fs.readFileSync(questionsPath, 'utf-8')
            preview = questionsContent.slice(0, 1500)
          }
        } catch (readErr) {
          logger.warn({ err: readErr }, 'Failed to read questions.md for preview')
        }
        postComment(
          input.issueNumber,
          `🔄 Cody stopped at clarify stage - questions need answering:\n\n${preview}\n\nPlease answer these questions and call \`/cody\` again to proceed with implementation.`,
        )
      }
      // Commit task files and pause
      commitPipelineFiles({
        taskDir,
        taskId: input.taskId,
        message: `ci(cody): Save task files for ${input.taskId}\n\nAuto-committed by Cody pipeline`,
        ensureBranch: true,
        cleanDirtyState: true,
        stagingStrategy: 'task-only',
        push: true,
        isCI: !input.local,
        dryRun: input.dryRun,
      })
      throw new PipelinePausedError(`clarify stage: awaiting answers for ${input.taskId}`)
    }
  }

  // Commit spec task files
  commitPipelineFiles({
    taskDir,
    taskId: input.taskId,
    message: `ci(cody): Save task files for ${input.taskId}\n\nAuto-committed by Cody pipeline`,
    ensureBranch: true,
    cleanDirtyState: true,
    stagingStrategy: 'task-only',
    push: true,
    isCI: !input.local,
    dryRun: input.dryRun,
  })

  logger.info('\n✅ Cody SPEC pipeline complete')
}
