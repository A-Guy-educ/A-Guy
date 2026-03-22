/**
 * @fileType utility
 * @domain cody | pipeline
 * @pattern post-action
 * @ai-summary Sets classification labels (type, risk, complexity, domain) on GitHub issue
 */

import type { PipelineContext } from '../../engine/types'
import { readTask } from '../../pipeline-utils'
import { setClassificationLabels } from '../../github-api'

export async function executeSetClassificationLabels(ctx: PipelineContext): Promise<void> {
  const taskDef = readTask(ctx.taskDir)
  if (ctx.input.issueNumber && taskDef) {
    setClassificationLabels(ctx.input.issueNumber, {
      task_type: taskDef.task_type,
      risk_level: taskDef.risk_level,
      complexity: taskDef.complexity,
      primary_domain: taskDef.primary_domain,
    })
  }
}
