/**
 * @fileType plugin
 * @domain inspector
 * @pattern knowledge-gardener-plugin
 * @ai-summary Reads memory.json from completed tasks and maintains the AI knowledge base
 *
 * Scans .tasks/ for new memory.json files (written by docs agent),
 * merges them into .ai-docs/knowledge/index.json (cap 100 entries),
 * updates pattern frequencies, and detects skill candidates when
 * a pattern appears >= 3 times (logs warning for human review).
 * Commits the updated knowledge base to git.
 */

import * as fs from 'fs'
import * as path from 'path'
import { execFileSync } from 'child_process'

import type { InspectorPlugin, ActionRequest, InspectorContext } from '../../../core/types'
import { findNewMemoryFiles, readKnowledgeIndex, toKnowledgeEntry } from './extractor'
import { cultivate } from './pruner'

const DEDUP_WINDOW_MINUTES = 23 * 60
const KNOWLEDGE_INDEX_PATH = path.join(process.cwd(), '.ai-docs', 'knowledge', 'index.json')
const TASKS_DIR = path.join(process.cwd(), '.tasks')

/**
 * Knowledge Base Gardener plugin.
 *
 * Runs ~daily (every 6th cycle + 23h dedup).
 */
export const knowledgeGardenerPlugin: InspectorPlugin = {
  name: 'knowledge-gardener',
  description: 'Maintain AI knowledge base from completed task memory files',
  domain: 'cody',
  schedule: { every: 6 },

  async run(ctx): Promise<ActionRequest[]> {
    ctx.log.debug('Running knowledge-gardener plugin')

    // Read current index
    const currentIndex = readKnowledgeIndex(KNOWLEDGE_INDEX_PATH)
    const existingTaskIds = new Set(currentIndex.entries.map((e) => e.taskId))

    // Find new memory.json files
    const newMemoryFiles = findNewMemoryFiles(TASKS_DIR, existingTaskIds)

    if (newMemoryFiles.length === 0) {
      ctx.log.info('No new memory.json files found — knowledge base is up to date')
      return []
    }

    ctx.log.info({ count: newMemoryFiles.length }, 'Found new memory files')

    const newEntries = newMemoryFiles.map(toKnowledgeEntry)
    const result = cultivate(currentIndex, newEntries)

    ctx.log.info(
      {
        added: result.newEntries.length,
        removed: result.removedEntries.length,
        skillCandidates: result.skillCandidates.length,
        totalEntries: result.updatedIndex.entries.length,
      },
      'Knowledge base updated',
    )

    if (result.skillCandidates.length > 0) {
      ctx.log.warn(
        { patterns: result.skillCandidates },
        'Skill candidates detected — consider creating new skills for these patterns',
      )
    }

    return [
      {
        plugin: 'knowledge-gardener',
        type: 'commit-knowledge-base',
        urgency: 'info',
        title: `Update knowledge base (+${result.newEntries.length} entries)`,
        detail: `Added ${result.newEntries.length} entries${result.removedEntries.length > 0 ? `, removed ${result.removedEntries.length} oldest` : ''}${result.skillCandidates.length > 0 ? `. Skill candidates: ${result.skillCandidates.join(', ')}` : ''}`,
        dedupKey: 'knowledge-gardener:commit-daily',
        dedupWindowMinutes: DEDUP_WINDOW_MINUTES,
        async execute(execCtx: InspectorContext): Promise<{ success: boolean; message?: string }> {
          // Write updated index
          try {
            const dir = path.dirname(KNOWLEDGE_INDEX_PATH)
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true })
            }
            fs.writeFileSync(
              KNOWLEDGE_INDEX_PATH,
              JSON.stringify(result.updatedIndex, null, 2) + '\n',
              'utf-8',
            )
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            execCtx.log.error({ err: msg }, 'Failed to write knowledge index')
            return { success: false, message: `Write failed: ${msg}` }
          }

          // Commit the update
          try {
            // Set git identity for CI
            execFileSync('git', ['config', '--local', 'user.name', 'Inspector Bot'], {
              stdio: 'pipe',
            })
            execFileSync(
              'git',
              ['config', '--local', 'user.email', 'inspector@noreply.github.com'],
              {
                stdio: 'pipe',
              },
            )

            execFileSync('git', ['add', KNOWLEDGE_INDEX_PATH], { stdio: 'pipe' })
            execFileSync(
              'git',
              [
                'commit',
                '-m',
                `chore: knowledge base update (+${result.newEntries.length} entries) [skip ci]`,
              ],
              {
                stdio: 'pipe',
              },
            )
            execFileSync('git', ['push'], { stdio: 'pipe' })
          } catch {
            // Non-fatal — file was written, git commit is best-effort in CI
            execCtx.log.warn('git commit for knowledge base failed (non-fatal)')
          }

          return {
            success: true,
            message: `Knowledge base updated: +${result.newEntries.length} entries${result.skillCandidates.length > 0 ? `, ${result.skillCandidates.length} skill candidates` : ''}`,
          }
        },
      },
    ]
  },
}
