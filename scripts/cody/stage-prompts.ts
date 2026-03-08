/**
 * @fileType utility
 * @domain ci | cody | prompts
 * @pattern stage-prompts
 * @ai-summary Stage runtime context for OpenCode agents — behavioral instructions live in .opencode/agents/*.md
 */

import * as fs from 'fs'
import * as path from 'path'

import type { CodyInput } from './cody-utils'
import { stageOutputFile, getSpecStagesForProfile, getAllImplStageNames } from './pipeline-utils'

// ============================================================================
// Constants
// ============================================================================

/**
 * Spec-only stages that don't produce code (skip hooks, as they auto-commit but shouldn't be enforced)
 */
export const SPEC_STAGES = ['taskify', 'spec', 'gap', 'clarify'] as const

export type SpecStage = (typeof SPEC_STAGES)[number]

/**
 * All valid stage names in the pipeline.
 * Note: 'test' was removed — tests are now written by build agent via @test-writer subagent (TDD)
 */
export const ALL_STAGES = [
  'taskify',
  'spec',
  'gap',
  'clarify',
  'architect',
  'plan-gap',
  'build',
  'commit',
  'verify',
  'autofix',
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
 *
 * Note: Some files may not exist (e.g., rerun-feedback.md on first runs).
 * The agent should gracefully handle missing optional files.
 */
export const STAGE_CONTEXT_FILES: Record<Stage, string[]> = {
  taskify: ['task.md'],
  spec: ['task.md', 'task.json'],
  gap: ['spec.md', 'task.json'],
  clarify: ['task.md', 'spec.md'],
  architect: ['spec.md', 'clarified.md', 'rerun-feedback.md'],
  'plan-gap': ['spec.md', 'plan.md', 'task.json'],
  build: ['spec.md', 'clarified.md', 'plan.md', 'plan-gap.md', 'rerun-feedback.md'],
  commit: ['task.json'],
  verify: [], // scripted — no LLM prompt needed
  autofix: ['verify.md', 'build-errors.md'],
  pr: [], // scripted — no LLM prompt needed
}

// ============================================================================
// Stage Instructions — runtime context ONLY (not behavioral)
//
// Behavioral instructions (how to act, output format, rules) live in
// .opencode/agents/<stage>.md. These instructions provide ONLY:
// - Spec-only guard (don't modify code)
// - Stage-specific runtime context hints (e.g., "this is a rerun")
// ============================================================================

// Use absolute path to avoid OpenCode path interpretation issues with task IDs containing hyphens
const specOnlyInstructionTemplate = (taskDir: string) =>
  `CRITICAL: This is a SPEC-ONLY pipeline. DO NOT create branches, commits, or pull requests. DO NOT modify any code files. Only read from and write to the ${taskDir}/ directory.`

export const stageInstructions: Record<Stage, (taskId: string) => string> = {
  taskify: (taskId) => {
    const taskDir = path.join(process.cwd(), '.tasks', taskId)
    return specOnlyInstructionTemplate(taskDir)
  },

  spec: (taskId) => {
    const taskDir = path.join(process.cwd(), '.tasks', taskId)
    return specOnlyInstructionTemplate(taskDir)
  },

  gap: (taskId) => {
    const taskDir = path.join(process.cwd(), '.tasks', taskId)
    return specOnlyInstructionTemplate(taskDir)
  },

  clarify: (taskId) => {
    const taskDir = path.join(process.cwd(), '.tasks', taskId)
    return specOnlyInstructionTemplate(taskDir)
  },

  architect: () => ``,

  'plan-gap': () => ``,

  build: () => `CRITICAL: IMPLEMENTATION STAGE - NOT DOCUMENTATION

You must ACTUALLY IMPLEMENT the code changes, not just document them.

Your job is to:
1. Use Edit/Write tools to modify source files in src/
2. Create new files as needed
3. Run tests to verify

The build.md file should be a SUMMARY of what you implemented, not the implementation plan.

DO NOT just write build.md - that will fail the pipeline! The pipeline validates that you modified actual source files.`,

  commit: () => ``,

  // Scripted stages — these prompts are never sent to an LLM
  verify: () => ``,
  autofix: () => ``,
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
 * Build the prompt for a given stage.
 * @param input - Orchestrator input with taskId
 * @param stage - The stage to build the prompt for
 * @param feedback - Optional feedback from a previous validation failure to include in the prompt
 * @returns The complete prompt string to pass to the agent
 */
export function buildStagePrompt(input: CodyInput, stage: string, feedback?: string): string {
  const { taskId } = input
  // Use absolute path to avoid OpenCode path interpretation issues with task IDs containing hyphens
  const taskDir = path.join(process.cwd(), '.tasks', taskId)

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

  // Add feedback section if provided
  const feedbackSection = feedback
    ? `\n⚠️ VALIDATION ERROR FROM PREVIOUS ATTEMPT:\n${feedback}\n\nPlease fix this in your next attempt.`
    : ''

  const parts = [
    instruction,
    `Task ID: ${taskId}`,
    taskTypeSection,
    filesSection,
    feedbackSection,
    `Write your output to ${outputFile}`,
  ].filter(Boolean)

  return parts.join('\n\n')
}

/**
 * Get spec pipeline stages (taskify, spec, clarify)
 * @param profile - Optional pipeline profile ('lightweight' | 'standard'), defaults to 'standard'
 */
export function getSpecStages(profile?: 'lightweight' | 'standard'): string[] {
  return getSpecStagesForProfile(profile ?? 'standard', false)
}

/**
 * Get implementation pipeline stages
 * @param profile - Optional pipeline profile ('lightweight' | 'standard'), defaults to 'standard'
 */
export function getImplStages(profile?: 'lightweight' | 'standard'): string[] {
  return getAllImplStageNames(profile ?? 'standard')
}
