/**
 * @fileType utility
 * @domain ci | pipeline | prompts
 * @pattern stage-prompts
 * @ai-summary Stage prompt templates for OpenCode agents in the orchestrated pipeline
 */

import type { OrchestratorInput } from './orchestrator-utils'

// ============================================================================
// Constants
// ============================================================================

/**
 * Spec-only stages that don't produce code (skip hooks, as they auto-commit but shouldn't be enforced)
 */
export const SPEC_STAGES = ['taskify', 'spec', 'clarify'] as const

export type SpecStage = (typeof SPEC_STAGES)[number]

/**
 * All valid stage names in the pipeline
 */
export const ALL_STAGES = [
  'taskify',
  'spec',
  'clarify',
  'architect',
  'build',
  'test',
  'verify',
  'auditor',
  'pr',
] as const

export type Stage = (typeof ALL_STAGES)[number]

// ============================================================================
// Stage Instructions
// ============================================================================

const specOnlyInstructionTemplate = `CRITICAL: This is a SPEC-ONLY pipeline. DO NOT create branches, commits, or pull requests. DO NOT modify any code files. Only read from and write to the .tasks/{TASK_ID}/ directory.`

export const stageInstructions: Record<Stage, (taskId: string) => string> = {
  taskify: (taskId) => `${specOnlyInstructionTemplate.replace('{TASK_ID}', taskId)}

Analyze the task description and create a task.json with task_type, pipeline, risk_level, confidence, primary_domain, scope, missing_inputs, and assumptions.`,

  spec: (taskId) => `${specOnlyInstructionTemplate.replace('{TASK_ID}', taskId)}

Read the task.json and create a detailed spec.md describing the implementation approach.`,

  clarify: (taskId) => `${specOnlyInstructionTemplate.replace('{TASK_ID}', taskId)}

Review the spec and any questions from previous stages. Answer them or note clarifications needed.`,

  architect: () =>
    `Create a detailed plan.md with the implementation approach, file changes, and dependencies.`,

  build: () => `Implement the changes as described in the plan. Write code to the repository.`,

  test: () => `Run tests and verify the implementation works correctly.`,

  verify: () => `Run quality checks (typecheck, lint, format) and verify the build passes.`,

  auditor: () => `Review the implementation for security, best practices, and potential issues.`,

  pr: () => `Create a pull request with all changes. Include a summary and testing notes.`,
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Build the full prompt for a given stage
 *
 * @param input - Orchestrator input containing taskId
 * @param stage - The stage to build the prompt for
 * @returns The complete prompt string to pass to the agent
 */
export function buildStagePrompt(input: OrchestratorInput, stage: string): string {
  const { taskId } = input
  const contextPath = `.tasks/${taskId}/.context.md`

  const instructionFn = stageInstructions[stage as Stage]
  const instruction = instructionFn ? instructionFn(taskId) : `Execute the "${stage}" stage.`

  return `${instruction}

Task ID: ${taskId}
Read the full context from ${contextPath}.
Write your output to the expected output file in .tasks/${taskId}/.`
}

/**
 * Get spec pipeline stages (taskify, spec, clarify)
 */
export function getSpecStages(): string[] {
  return [...SPEC_STAGES]
}

/**
 * Get implementation pipeline stages (architect, build, test, verify, auditor, pr)
 */
export function getImplStages(): string[] {
  return ['architect', 'build', 'test', 'verify', 'auditor', 'pr']
}
