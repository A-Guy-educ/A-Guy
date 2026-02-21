/**
 * @fileType utility
 * @domain ci | cody | prompts
 * @pattern stage-prompts
 * @ai-summary Stage runtime context for OpenCode agents — behavioral instructions live in .opencode/agents/*.md
 */

import * as fs from 'fs'
import * as path from 'path'

import type { CodyInput } from './cody-utils'
import { stageOutputFile } from './pipeline-utils'

// ============================================================================
// Constants
// ============================================================================

/**
 * Spec-only stages that don't produce code (skip hooks, as they auto-commit but shouldn't be enforced)
 */
export const SPEC_STAGES = ['taskify', 'spec', 'clarify'] as const

export type SpecStage = (typeof SPEC_STAGES)[number]

/**
 * All valid stage names in the pipeline.
 * Note: 'test' was removed — tests are now written by build agent via @test-writer subagent (TDD)
 */
export const ALL_STAGES = [
  'taskify',
  'spec',
  'clarify',
  'architect',
  'plan-review',
  'build',
  'commit',
  'verify',
  'autofix',
  'auditor',
  'apply-audit',
  'pr',
] as const

export type Stage = (typeof ALL_STAGES)[number]

/**
 * Scripted stages that run directly without an LLM agent.
 * Their prompts in stageInstructions are unused but kept for documentation.
 */
export const SCRIPTED_STAGES = ['verify', 'commit', 'pr'] as const

// ============================================================================
// Stage Context — which files each stage needs to read
// ============================================================================

/**
 * Maps each stage to the task files it needs. Agents read these individual
 * files instead of a monolithic .context.md.
 *
 * Design principle: each agent gets ONLY what it needs.
 * Behavioral instructions live in .opencode/agents/<stage>.md (system prompt).
 * This file provides only runtime context (task ID, file paths).
 */
export const STAGE_CONTEXT_FILES: Record<Stage, string[]> = {
  taskify: ['task.md'],
  spec: ['task.md', 'task.json'],
  clarify: ['task.md', 'spec.md'],
  architect: ['spec.md', 'clarified.md', 'rerun-feedback.md', 'plan-review.rejected.md'],
  'plan-review': ['spec.md', 'plan.md'],
  build: ['spec.md', 'clarified.md', 'plan.md', 'plan-review.md'],
  commit: ['task.json'],
  verify: [], // scripted — no LLM prompt needed
  autofix: ['verify.md'],
  auditor: ['task.md', 'spec.md', 'build.md', 'verify.md'],
  'apply-audit': ['auditor.md'],
  pr: [], // scripted — no LLM prompt needed
}

// ============================================================================
// Stage Instructions — runtime context ONLY (not behavioral)
//
// Behavioral instructions (how to act, output format, rules) live in
// .opencode/agents/<stage>.md. These instructions provide ONLY:
// - Spec-only guard (don't modify code)
// - Stage-specific runtime hints (e.g., "this is a rerun")
// ============================================================================

const specOnlyInstructionTemplate = `CRITICAL: This is a SPEC-ONLY pipeline. DO NOT create branches, commits, or pull requests. DO NOT modify any code files. Only read from and write to the .tasks/{TASK_ID}/ directory.`

export const stageInstructions: Record<Stage, (taskId: string) => string> = {
  taskify: (taskId) => `${specOnlyInstructionTemplate.replace('{TASK_ID}', taskId)}`,

  spec: (taskId) => `${specOnlyInstructionTemplate.replace('{TASK_ID}', taskId)}`,

  clarify: (taskId) => `${specOnlyInstructionTemplate.replace('{TASK_ID}', taskId)}`,

  architect: () => ``,

  'plan-review': () => ``,

  build: () => ``,

  commit: () => ``,

  // Scripted stages — these prompts are never sent to an LLM
  verify: () => ``,
  autofix: () => ``,
  auditor: () => ``,
  'apply-audit': () => ``,
  pr: () => ``,
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Read task_type from task.json for the given task.
 * Returns 'implement_feature' as default if task.json doesn't exist or is invalid.
 */
function getTaskType(taskId: string): string {
  const taskJsonPath = path.join(process.cwd(), '.tasks', taskId, 'task.json')
  try {
    if (fs.existsSync(taskJsonPath)) {
      const content = fs.readFileSync(taskJsonPath, 'utf-8')
      const data = JSON.parse(content)
      if (data.task_type && typeof data.task_type === 'string') {
        return data.task_type
      }
    }
  } catch {
    // Ignore errors, return default
  }
  return 'implement_feature'
}

/**
 * Build the full prompt for a given stage.
 *
 * Instead of pointing to a monolithic .context.md, lists the specific files
 * the agent needs to read. Behavioral instructions come from the agent's
 * .opencode/agents/<stage>.md system prompt.
 *
 * @param input - Orchestrator input containing taskId
 * @param stage - The stage to build the prompt for
 * @returns The complete prompt string to pass to the agent
 */
export function buildStagePrompt(input: CodyInput, stage: string): string {
  const { taskId } = input
  const taskDir = `.tasks/${taskId}`

  // Get task_type for stages that need it (architect, build)
  const taskType = getTaskType(taskId)

  const instructionFn = stageInstructions[stage as Stage]
  const instruction = instructionFn ? instructionFn(taskId) : ''

  // Build file list for this stage
  const contextFiles = STAGE_CONTEXT_FILES[stage as Stage] || []
  const fileList = contextFiles.map((f) => `- ${taskDir}/${f}`).join('\n')

  const filesSection = contextFiles.length > 0 ? `\nRead these files for context:\n${fileList}` : ''

  // Add task_type for stages that need it (architect, build)
  const taskTypeSection =
    stage === 'architect' || stage === 'build' ? `\nTask Type: ${taskType}` : ''

  const outputFile = stageOutputFile(taskDir, stage)

  const parts = [
    instruction,
    `Task ID: ${taskId}`,
    taskTypeSection,
    filesSection,
    `Write your output to ${outputFile}`,
  ].filter(Boolean)

  return parts.join('\n\n')
}

/**
 * Get spec pipeline stages (taskify, spec, clarify)
 */
export function getSpecStages(): string[] {
  return [...SPEC_STAGES]
}

/**
 * Get implementation pipeline stages
 */
export function getImplStages(): string[] {
  return ['architect', 'plan-review', 'build', 'commit', 'verify', 'auditor', 'apply-audit', 'pr']
}
