/**
 * @fileType utility
 * @domain cody | pipeline
 * @pattern post-action
 * @ai-summary Validates task.json after taskify stage, deletes invalid file for retry
 */

import * as fs from 'fs'
import * as path from 'path'

import { logger } from '../../logger'
import type { PipelineContext } from '../../engine/types'
import { readTask } from '../../pipeline-utils'

export async function executeValidateTaskJson(ctx: PipelineContext): Promise<void> {
  try {
    readTask(ctx.taskDir)
    logger.info('  ✓ task.json validated')
  } catch (error) {
    // G13: Delete invalid file so retry can recreate
    const taskJsonPath = path.join(ctx.taskDir, 'task.json')
    if (fs.existsSync(taskJsonPath)) {
      fs.unlinkSync(taskJsonPath)
    }
    const msg = error instanceof Error ? error.message : String(error)
    throw new Error(`Invalid task.json: ${msg}`)
  }
}
