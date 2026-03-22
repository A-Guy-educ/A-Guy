/**
 * @fileType utility
 * @domain cody | pipeline | post-action
 * @pattern knowledge-base | learning
 * @ai-summary Updates the cross-task knowledge base with patterns learned from completed tasks
 */

import * as fs from 'fs'
import * as path from 'path'

import { logger } from '../../logger'
import type { PipelineContext, PipelineStateV2 } from '../../engine/types'
import { loadState } from '../../engine/status'
import { readTask } from '../../pipeline-utils'
import type { TaskDefinition } from '../task-schema'

// ============================================================================
// Types
// ============================================================================

interface KnowledgeEntry {
  taskId: string
  date: string
  domain: string
  taskType: string
  complexity: number
  patterns: string[]
  summary: string
  feedbackLoops?: number
  errorPatterns?: string[]
}

interface KnowledgeBase {
  version: number
  description: string
  entries: KnowledgeEntry[]
  patternFrequency: Record<string, number>
  skillsCreated: string[]
  lastUpdated: string
}

// ============================================================================
// Constants
// ============================================================================

const KNOWLEDGE_BASE_PATH = '.ai-docs/knowledge/index.json'
const MAX_KNOWLEDGE_ENTRIES = 100

// Pattern detection keywords (detected in scope text)
const PATTERN_KEYWORDS: Record<string, string[]> = {
  'type-error': ['typescript', 'type', 'interface', 'type error'],
  'lint-error': ['lint', 'eslint', 'prettier'],
  'format-error': ['format', 'prettier', 'indentation'],
  'test-failure': ['test', 'vitest', 'assertion', 'expected'],
  'css-styling': ['tailwind', 'css', 'className', 'style'],
  'frontend-bugfix': ['ui', 'component', 'render', 'state'],
  'api-design': ['endpoint', 'route', 'request', 'response'],
  'data-modeling': ['collection', 'schema', 'field', 'relationship'],
  performance: ['optimize', 'cache', 'lazy', 'memo'],
  security: ['auth', 'sanitize', 'validate', 'permission'],
  hook: ['hook', 'beforeChange', 'afterChange', 'beforeValidate'],
  'access-control': ['access', 'permission', 'isAdmin', 'isOwner'],
}

// ============================================================================
// Helper: Detect patterns from task scope and error data
// ============================================================================

function detectPatterns(
  taskDef: TaskDefinition,
  errorPatterns: string[],
  feedbackLoops: number,
): string[] {
  const patterns: string[] = []

  // Detect from task scope (array of scope items joined)
  const scopeText = (taskDef.scope || []).join(' ').toLowerCase()
  const typeText = taskDef.task_type.toLowerCase()

  for (const [pattern, keywords] of Object.entries(PATTERN_KEYWORDS)) {
    if (keywords.some((kw) => scopeText.includes(kw) || typeText.includes(kw))) {
      patterns.push(pattern)
    }
  }

  // Add error patterns that were encountered
  for (const error of errorPatterns) {
    const normalized = error.toLowerCase()
    if (normalized.includes('type') || normalized.includes('ts')) {
      patterns.push('type-error')
    }
    if (normalized.includes('lint') || normalized.includes('eslint')) {
      patterns.push('lint-error')
    }
    if (normalized.includes('format') || normalized.includes('prettier')) {
      patterns.push('format-error')
    }
    if (normalized.includes('test') || normalized.includes('vitest')) {
      patterns.push('test-failure')
    }
  }

  // If feedback loops were needed, mark as needing iteration
  if (feedbackLoops > 0) {
    patterns.push('iterative-fix')
  }

  // Deduplicate
  return [...new Set(patterns)]
}

// ============================================================================
// Helper: Load existing knowledge base
// ============================================================================

function loadKnowledgeBase(): KnowledgeBase {
  const kbPath = path.join(process.cwd(), KNOWLEDGE_BASE_PATH)

  if (!fs.existsSync(kbPath)) {
    return {
      version: 1,
      description:
        'Cross-task knowledge base for Cody pipeline self-learning. Updated by the pipeline after each task completion.',
      entries: [],
      patternFrequency: {},
      skillsCreated: [],
      lastUpdated: new Date().toISOString(),
    }
  }

  try {
    const data = fs.readFileSync(kbPath, 'utf-8')
    return JSON.parse(data) as KnowledgeBase
  } catch (err) {
    logger.warn({ err }, 'Failed to load knowledge base, starting fresh')
    return {
      version: 1,
      description: 'Cross-task knowledge base for Cody pipeline self-learning.',
      entries: [],
      patternFrequency: {},
      skillsCreated: [],
      lastUpdated: new Date().toISOString(),
    }
  }
}

// ============================================================================
// Helper: Save knowledge base
// ============================================================================

function saveKnowledgeBase(kb: KnowledgeBase): void {
  const kbPath = path.join(process.cwd(), KNOWLEDGE_BASE_PATH)
  const dir = path.dirname(kbPath)

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  kb.lastUpdated = new Date().toISOString()
  fs.writeFileSync(kbPath, JSON.stringify(kb, null, 2), 'utf-8')
  logger.info(`  📚 Updated knowledge base with ${kb.entries.length} entries`)
}

// ============================================================================
// Main: Execute knowledge base update
// ============================================================================

/**
 * Post-action that updates the cross-task knowledge base after task completion.
 *
 * This captures:
 * - Task domain and type
 * - Complexity score
 * - Patterns detected (from scope and error patterns)
 * - Feedback loops needed (indicates difficulty)
 * - Error patterns encountered
 *
 * The knowledge base is read by the architect stage to inform planning.
 */
export async function executeUpdateKnowledgeBase(
  ctx: PipelineContext,
  _state: PipelineStateV2 | null,
): Promise<void> {
  if (ctx.input.dryRun) {
    logger.info('  ℹ️ Dry run, skipping knowledge base update')
    return
  }

  logger.info('  📚 Updating knowledge base...')

  try {
    // Load task definition
    const taskDef = readTask(ctx.taskDir)
    if (!taskDef) {
      logger.warn('  ⚠️ No task definition found, skipping knowledge base update')
      return
    }

    // Load pipeline state for metrics
    const state = loadState(ctx.taskId)
    const buildStage = state?.stages?.build

    // Extract error patterns from verify failures if they exist
    let errorPatterns: string[] = []
    const verifyFailuresPath = path.join(ctx.taskDir, 'verify-failures.md')
    if (fs.existsSync(verifyFailuresPath)) {
      const content = fs.readFileSync(verifyFailuresPath, 'utf-8')
      // Extract error categories from the failures file
      const errorMatches = content.match(/##\s+Error\s+\d+:\s+(\S+)/g) || []
      errorPatterns = errorMatches.map((m) => m.replace(/##\s+Error\s+\d+:\s+/, ''))
    }

    // Detect patterns
    const patterns = detectPatterns(taskDef, errorPatterns, buildStage?.feedbackLoops || 0)

    // Create knowledge entry
    const entry: KnowledgeEntry = {
      taskId: ctx.taskId,
      date: new Date().toISOString(),
      domain: taskDef.primary_domain,
      taskType: taskDef.task_type,
      complexity: taskDef.complexity || 0,
      patterns,
      summary: taskDef.scope?.slice(0, 3).join(', ') || 'No scope',
      feedbackLoops: buildStage?.feedbackLoops,
      errorPatterns: errorPatterns.length > 0 ? errorPatterns : undefined,
    }

    // Load and update knowledge base
    const kb = loadKnowledgeBase()

    // Check for duplicate entry (same taskId)
    const existingIndex = kb.entries.findIndex((e) => e.taskId === ctx.taskId)
    if (existingIndex >= 0) {
      // Update existing entry
      kb.entries[existingIndex] = entry
      logger.info(`  📝 Updated existing knowledge entry for ${ctx.taskId}`)
    } else {
      // Add new entry
      kb.entries.push(entry)
      logger.info(`  ✅ Added new knowledge entry for ${ctx.taskId}`)
    }

    // Trim entries if too many
    if (kb.entries.length > MAX_KNOWLEDGE_ENTRIES) {
      kb.entries = kb.entries.slice(-MAX_KNOWLEDGE_ENTRIES)
      logger.info(`  ℹ️ Trimmed knowledge base to ${MAX_KNOWLEDGE_ENTRIES} entries`)
    }

    // Update pattern frequency
    for (const pattern of patterns) {
      kb.patternFrequency[pattern] = (kb.patternFrequency[pattern] || 0) + 1
    }

    // Save updated knowledge base
    saveKnowledgeBase(kb)

    logger.info(
      `  ✅ Knowledge base updated: domain=${taskDef.primary_domain}, patterns=[${patterns.join(', ')}], feedbackLoops=${buildStage?.feedbackLoops || 0}`,
    )
  } catch (err) {
    // Non-fatal — log and continue
    logger.warn({ err }, 'Failed to update knowledge base, continuing pipeline')
  }
}
