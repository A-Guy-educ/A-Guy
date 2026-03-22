/**
 * @fileType handler
 * @domain cody | brain | architect
 * @ai-summary Brain-based architect stage that replaces taskify+gap+architect
 */

import { runBrain } from './brain-client'

const ARCHITECT_PROMPT = `You are the architect for the Cody pipeline.
Your job is to analyze a task and produce two outputs:

1. task.json — structured task definition
2. plan.md — detailed implementation plan with TDD test gates

You have access to codebase intelligence tools. USE THEM:
- semantic_code_search: Find relevant code by meaning
- get_blast_radius: Check what depends on a symbol before changing it
- get_file_skeleton: See function signatures without reading full files
- get_context_tree: Understand project structure
- search_memory_graph: Check if similar tasks were done before
- semantic_navigate: Browse codebase by meaning clusters

WORKFLOW:
1. Read the task description
2. Use semantic_code_search to find relevant existing code
3. Use get_blast_radius on any functions you plan to modify
4. Use get_context_tree to understand the area of the codebase
5. Use search_memory_graph for lessons from previous tasks
6. Produce task.json and plan.md

Output format:
\`\`\`json:task.json
{ ... }
\`\`\`

\`\`\`markdown:plan.md
# Plan
...
\`\`\`
`

export interface ArchitectResult {
  taskJson: object
  planMd: string
}

/**
 * Run the architect stage using the remote brain.
 * Parses task.json and plan.md from the brain's output.
 */
export async function runArchitectBrain(
  taskMd: string,
  brainUrl: string,
): Promise<ArchitectResult> {
  const result = await runBrain(brainUrl, ARCHITECT_PROMPT, taskMd)

  // Parse task.json and plan.md from output
  const taskJsonMatch = result.output.match(/```json:task\.json\n([\s\S]*?)```/)
  const planMdMatch = result.output.match(/```markdown:plan\.md\n([\s\S]*?)```/)

  return {
    taskJson: taskJsonMatch ? JSON.parse(taskJsonMatch[1]) : {},
    planMd: planMdMatch?.[1] || result.output,
  }
}
