/**
 * @fileType handler
 * @domain cody | brain | review
 * @ai-summary Brain-based review stage using remote brain server
 */

import { runBrain } from './brain-client'

const REVIEW_PROMPT = `You are the code reviewer for the Cody pipeline.
Your job is to review code changes against the plan and produce a review.

You have access to codebase intelligence tools. USE THEM:
- get_blast_radius: Check if changes break anything else
- semantic_code_search: Find related code that might need updating
- run_static_analysis: Run linters for type errors and dead code
- get_file_skeleton: Check if changed functions match existing patterns
- search_memory_graph: Check for known issues with similar changes

WORKFLOW:
1. Read the plan and changed files
2. Use get_blast_radius on every modified function
3. Use run_static_analysis on changed files
4. Use semantic_code_search to find related code that might be affected
5. Produce review.md with findings

Be specific. Reference file paths and line numbers.
Categorize findings as: critical (blocks merge), warning (should fix), info (suggestion).
`

/**
 * Run the review stage using the remote brain.
 */
export async function runReviewBrain(
  planMd: string,
  changedFiles: string[],
  diffs: string,
  brainUrl: string,
): Promise<string> {
  const userMessage = `## Plan\n${planMd}\n\n## Changed Files\n${changedFiles.join('\n')}\n\n## Diffs\n${diffs}`
  const result = await runBrain(brainUrl, REVIEW_PROMPT, userMessage)
  return result.output
}
