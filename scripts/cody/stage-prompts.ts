/**
 * @fileType utility
 * @domain ci | cody | prompts
 * @pattern stage-prompts
 * @ai-summary Stage runtime context for OpenCode agents — behavioral instructions live in .opencode/agents/*.md
 */

import * as fs from 'fs'
import * as path from 'path'

import type { CodyInput } from './cody-utils'
import {
  getStageContextFiles,
  stageOutputFile,
  isValidStageName,
  SPEC_ORDER_STANDARD,
  SPEC_ORDER_LIGHTWEIGHT,
  flattenTypedPipeline,
  IMPL_ORDER_STANDARD,
  IMPL_ORDER_LIGHTWEIGHT,
} from './stages/registry'

// Re-export for backward compatibility
export { SPEC_STAGES, SCRIPTED_STAGES } from './stages/registry'

// ============================================================================
// Stage Context — which files each stage needs to read
// ============================================================================

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

export const stageInstructions: Record<string, (taskId: string) => string> = {
  taskify: (taskId) => {
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

  test: () => `TDD RED PHASE: Write failing tests from the plan.
You run in PARALLEL with the build agent. Write tests to tests/ ONLY.
Do NOT modify src/. Do NOT run tests (they will fail without implementation).`,

  build: () => `CRITICAL: IMPLEMENTATION STAGE - NOT DOCUMENTATION ONLY

You must ACTUALLY IMPLEMENT the code changes, not just document them.

Your job is to:
1. Use Edit/Write tools to modify source files in src/
2. Create new files as needed
3. Run tests to verify
4. **MUST write build.md** summarizing what was implemented before exiting

The build.md file format:
- Must include a ## Changes or ## Files section (required by pipeline validation)
- Should be a SUMMARY of what was implemented
- Write it to: .tasks/<taskId>/build.md

Example format:
\`\`\`markdown
# Build Summary

## Changes
- Created src/infra/utils/pipeline-health.ts
- Added PipelineHealthReport class
- Added integration tests

## Files
- src/infra/utils/pipeline-health.ts
- tests/unit/infra/utils/pipeline-health.test.ts
\`\`\`

DO NOT skip writing build.md - the pipeline REQUIRES this file!`,

  commit: () => ``,

  review: () => `CRITICAL: CODE REVIEW + SPEC SATISFACTION STAGE

You are reviewing already-generated code AND verifying spec satisfaction. DO NOT modify code files.

Your #1 job is the GOAL-BACKWARD SPEC CHECK: for every requirement in spec.md, verify there is matching code.
Your #2 job is standard code review (security, correctness, quality).
NOTE: Tests are written separately via the deferred-tests inspector plugin. Do NOT flag missing tests as issues.

Produce review.md with a Spec Satisfaction matrix (requirement → code location → status) FIRST, then code quality findings.
If ANY spec requirement has no corresponding code: mark as Critical issue.`,

  fix: () => `CRITICAL: TARGETED FIX STAGE

You are applying MINIMAL fixes to resolve identified issues.
DO NOT regenerate entire codebase.
DO NOT refactor or rewrite working code.
Only fix the specific issues identified in verify-failures.md, review.md, or rerun-feedback.md.

For fix_bug tasks: follow the SCIENTIFIC DEBUG PROTOCOL in your agent instructions.
Hypothesis first, reproduction test second, minimal fix third.

IMPORTANT: If review.md lists many issues (dozens+), focus on the CRITICAL issues first, then MAJOR issues.
Do NOT try to fix every single issue — prioritize the most impactful ones.
The goal is to make the code substantially better, not perfectly bug-free.
Write fix-summary.md summarizing what you changed.`,

  // Scripted stages — these prompts are never sent to an LLM
  verify: () => ``,
  autofix: () => ``,
  docs: () => `DOCUMENTATION STAGE

You are updating project documentation based on task changes.
DO NOT modify source code files — only documentation files (.md, .json indexes).
Write docs.md as your output summarizing documentation changes.`,
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

  const instructionFn = stageInstructions[stage]
  const instruction = instructionFn ? instructionFn(taskId) : ''

  // Build file list for this stage
  const contextFiles = isValidStageName(stage) ? getStageContextFiles(stage) : []
  const fileList = contextFiles.map((f) => `- ${taskDir}/${f}`).join('\n')

  // For architect stage, also include the cross-task knowledge base
  const knowledgePath = path.join(process.cwd(), '.ai-docs', 'knowledge', 'index.json')
  const knowledgeSection =
    stage === 'architect' && fs.existsSync(knowledgePath) ? `\n- ${knowledgePath}` : ''

  const filesSection =
    contextFiles.length > 0 || knowledgeSection
      ? `\nRead these files for context:\n${fileList}${knowledgeSection}`
      : ''

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
 * Get spec pipeline stages (taskify, gap — without clarify by default)
 * @param profile - Optional pipeline profile ('lightweight' | 'standard'), defaults to 'standard'
 */
export function getSpecStages(profile?: 'lightweight' | 'standard'): string[] {
  const order = profile === 'lightweight' ? SPEC_ORDER_LIGHTWEIGHT : SPEC_ORDER_STANDARD
  // Default: exclude clarify (backward compat with old getSpecStagesForProfile(profile, false))
  return order.filter((s) => s !== 'clarify')
}

/**
 * Get implementation pipeline stages
 * @param profile - Optional pipeline profile ('lightweight' | 'standard'), defaults to 'standard'
 */
export function getImplStages(profile?: 'lightweight' | 'standard'): string[] {
  return flattenTypedPipeline(
    profile === 'lightweight' ? IMPL_ORDER_LIGHTWEIGHT : IMPL_ORDER_STANDARD,
  )
}
