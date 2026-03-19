/**
 * @fileType utility
 * @domain cody | task
 * @pattern task-setup
 * @ai-summary Task directory and file preparation — extracted to avoid circular dependency between entry.ts and modes/
 */

import * as fs from 'fs'
import * as path from 'path'

import type { PipelineContext } from './engine/types'
import { logger } from './logger'

/**
 * Ensures task.md exists before pipeline runs (needed for taskify agent).
 * - Uses --file flag content if provided
 * - Fetches from GitHub issue body if --issue-number provided
 * - Throws if neither available and task.md doesn't exist
 */
export async function ensureTaskMd(ctx: PipelineContext): Promise<void> {
  const { input, taskDir } = ctx
  const taskMdPath = path.join(taskDir, 'task.md')

  // --file flag has priority
  if (input.file) {
    const resolvedFile = path.resolve(input.file)
    if (!fs.existsSync(resolvedFile)) {
      throw new Error(`File not found: ${resolvedFile}`)
    }
    const content = fs.readFileSync(resolvedFile, 'utf-8').trim()
    if (!content) {
      throw new Error(`File is empty: ${resolvedFile}`)
    }
    fs.writeFileSync(taskMdPath, `# Task\n\n${content}\n`)
    logger.info(`Created task.md from ${resolvedFile}`)
    return
  }

  // Create task.md from issue body if it doesn't exist
  if (!fs.existsSync(taskMdPath)) {
    if (input.issueNumber) {
      const { getIssue } = await import('./github-api')
      logger.info('task.md not found, fetching issue body to create it...')
      const { body: issueBody, title: issueTitle } = getIssue(input.issueNumber)
      if (issueBody) {
        const titleSection = issueTitle ? `## Issue Title\n\n${issueTitle}\n` : ''
        fs.writeFileSync(taskMdPath, `# Task\n\n${titleSection}${issueBody}\n`)
        logger.info(`Created task.md from issue #${input.issueNumber}`)
      } else {
        throw new Error(
          `task.md not found in .tasks/${input.taskId}/ and issue #${input.issueNumber} has no body. Create it first.`,
        )
      }
    } else {
      throw new Error(`task.md not found in .tasks/${input.taskId}/. Create it first.`)
    }
  }
}
