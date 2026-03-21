/**
 * @fileType utility
 * @domain cody | pipeline
 * @pattern post-action
 * @ai-summary Commits and pushes pipeline task files to remote branch
 */

import type { PipelineContext, PostAction } from '../../engine/types'
import { commitPipelineFiles } from '../../git-utils'

export async function executeCommitTaskFiles(
  ctx: PipelineContext,
  action: PostAction & { type: 'commit-task-files' },
): Promise<void> {
  // G18: Skip if localOnly and not in local mode
  if (action.localOnly && !ctx.input.local) {
    return
  }
  // Skip if dryRun
  if (ctx.input.dryRun) {
    return
  }

  const result = commitPipelineFiles({
    taskDir: ctx.taskDir,
    taskId: ctx.taskId,
    message: action.commitMessage || `ci(cody): commit task files for ${ctx.taskId}`,
    ensureBranch: action.ensureBranch,
    cleanDirtyState: action.cleanDirtyState,
    stagingStrategy: action.stagingStrategy === 'tracked-only' ? 'all' : action.stagingStrategy,
    push: action.push,
    isCI: !ctx.input.local,
    dryRun: ctx.input.dryRun,
  })
  if (!result.success) {
    throw new Error(`commit-task-files failed: ${result.message}`)
  }
}
