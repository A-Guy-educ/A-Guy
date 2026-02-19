/**
 * @fileType utility
 * @domain ci | cody | prompts
 * @pattern stage-prompts
 * @ai-summary Stage prompt templates for OpenCode agents in the Cody pipeline
 */

import type { CodyInput } from './cody-utils'

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

Analyze the task description and create a task.json with these exact fields:

- task_type: MUST be one of: spec_only, implement_feature, fix_bug, refactor, docs, ops, research
  Examples: "Add dark mode" → implement_feature, "Fix login crash" → fix_bug, "Update README" → docs
  WRONG values (do NOT use): "feature", "bug", "bugfix", "hotfix"
- risk_level: MUST be one of: low, medium, high
- confidence: MUST be a number between 0.0 and 1.0 (e.g., 0.85)
- primary_domain: MUST be one of: backend, frontend, infra, data, llm, devops, product
- scope: MUST be an array of file paths (e.g., ["src/app/page.tsx", "src/components/Login.tsx"])
- missing_inputs: array of objects with "field" and "question" keys, or empty []
- assumptions: array of strings

NOTE: Do NOT include a "pipeline" field — it is auto-derived from task_type.

Example output:
{
  "task_type": "fix_bug",
  "risk_level": "low",
  "confidence": 0.9,
  "primary_domain": "frontend",
  "scope": ["src/components/Login.tsx"],
  "missing_inputs": [],
  "assumptions": ["The bug is in the login form validation"]
}

Write valid JSON only — no explanations, no markdown code fences, no comments.`,

  spec: (taskId) => `${specOnlyInstructionTemplate.replace('{TASK_ID}', taskId)}

Read the task.json and create a detailed spec.md describing the implementation approach.`,

  clarify: (taskId) => `${specOnlyInstructionTemplate.replace('{TASK_ID}', taskId)}

Review the spec and any questions from previous stages. Answer them or note clarifications needed.`,

  architect: () =>
    `Create a detailed plan.md with the implementation approach, file changes, and dependencies.`,

  build: () => `Implement the changes as described in the plan. Write code to the repository.`,

  test: () => `Run tests and verify the implementation works correctly.`,

  verify: () => `Run these quality gate commands in order and report results:

1. pnpm -s tsc --noEmit (typecheck)
2. pnpm -s lint (linting)
3. pnpm -s format (formatting)

Report PASS or FAIL for each. If any fail, include the error output. Do NOT run pnpm build - it is too slow for CI verification.`,

  auditor: () => `Review the implementation for security, best practices, and potential issues.`,

  pr: (taskId) => `Create a pull request for the changes in this branch.

IMPORTANT: First check if a PR already exists for this branch using "gh pr list --head <branch-name>". If a PR already exists, do NOT create a new one - just write the PR URL to the output file and finish.

REQUIREMENTS:
- The PR title MUST be a conventional commit format (e.g. "fix: resolve login crash", "feat: add dark mode toggle")
- The PR title MUST describe WHAT the code change does, based on the actual code diff (not the spec pipeline status)
- The PR body should summarize what changed, why, and how it was tested
- Read .tasks/${taskId}/task.md and .tasks/${taskId}/spec.md for context on the task objective
- Use git diff to understand the actual code changes`,
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
export function buildStagePrompt(input: CodyInput, stage: string): string {
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
