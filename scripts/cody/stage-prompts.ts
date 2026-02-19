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
 * All valid stage names in the pipeline (including new split stages)
 */
export const ALL_STAGES = [
  'taskify',
  'spec',
  'clarify',
  'architect',
  'plan-review',
  'build',
  'commit',
  'test',
  'verify',
  'auditor',
  'pr',
] as const

export type Stage = (typeof ALL_STAGES)[number]

/**
 * Scripted stages that run directly without an LLM agent
 */
export const SCRIPTED_STAGES = ['verify', 'pr'] as const

// ============================================================================
// Stage Instructions
// ============================================================================

const specOnlyInstructionTemplate = `CRITICAL: This is a SPEC-ONLY pipeline. DO NOT create branches, commits, or pull requests. DO NOT modify any code files. Only read from and write to the .tasks/{TASK_ID}/ directory.`

export const stageInstructions: Record<Stage, (taskId: string) => string> = {
  taskify: (taskId) => `${specOnlyInstructionTemplate.replace('{TASK_ID}', taskId)}

Analyze the task description and create a task.json with these exact fields:

- task_type: MUST be one of: implement_feature, fix_bug, refactor, docs, ops, research
  Examples: "Add dark mode" → implement_feature, "Fix login crash" → fix_bug, "Update README" → docs
  WRONG values (do NOT use): "feature", "bug", "bugfix", "hotfix", "spec_only"
  NOTE: "spec_only" is reserved for manual use only — NEVER choose it. If the task describes a problem or bug, use "fix_bug". If it asks for a change, use "implement_feature".
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

  'plan-review': () =>
    `Review the plan.md against the spec.md. Check that all requirements are covered, file paths exist, and steps are logical. Write a plan-review.md with verdict PASS or FAIL.`,

  build: () =>
    `Implement the changes as described in the plan. Write code to the repository. Do NOT commit or push — a separate commit agent handles git operations.`,

  commit: () =>
    `Commit all pending changes and push to the current branch. Use conventional commit format. Do NOT modify any source code files.`,

  test: () => `Run tests and verify the implementation works correctly.`,

  verify: () => `Run these quality gate commands in order and report results:

1. pnpm -s tsc --noEmit (typecheck)
2. pnpm -s lint (linting)
3. pnpm -s format (formatting)

Report PASS or FAIL for each. If any fail, include the error output. Do NOT run pnpm build - it is too slow for CI verification.`,

  auditor: () => `Review the implementation for security, best practices, and potential issues.`,

  pr: (taskId) => `Create a pull request for the changes in this branch.

STEP 1: Check if a PR already exists for this branch using "gh pr list --head <branch-name>". If one exists, just write the PR URL to the output file and stop.

STEP 2: Determine the PR title. This is critical:
- Run "git log --oneline dev..HEAD" to see what commits were made
- Read .tasks/${taskId}/task.md to understand the original task
- The title MUST follow conventional commit format: "type: short description"
  where type is feat/fix/refactor/chore/docs based on the actual changes
- GOOD examples: "fix: reduce typing speed in GreetingFlow", "feat: add user avatar upload"
- BAD examples: "Spec valid, ready to implement", "Update code", "Changes for task"
- The title must describe the USER-VISIBLE change, not internal pipeline status

STEP 3: Create the PR with "gh pr create --title <title> --body <body>"
- Body should summarize: what changed, why, files affected
- Reference the task: .tasks/${taskId}/`,
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
 * Get implementation pipeline stages
 */
export function getImplStages(): string[] {
  return ['architect', 'plan-review', 'build', 'commit', 'test', 'verify', 'auditor', 'pr']
}
