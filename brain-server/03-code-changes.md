# Brain Server — Code Changes

Pipeline modifications to use the remote brain for thinking stages.

Prerequisite: Server running (02-server-setup.md).

---

## Overview

Split pipeline into thinking (remote brain) and executing (local OpenCode):

| Stage | Where | Brain Access | What Changes |
|-------|-------|-------------|-------------|
| Architect | Remote (Claude API + MCP) | Direct MCP client | Replaces taskify + gap + architect |
| Build | Local (OpenCode) | Via opencode.json MCP config | Add brain tools guidance to prompt |
| Verify | Local (scripted) | No | No changes |
| Review | Remote (Claude API + MCP) | Direct MCP client | Replaces current review stage |
| Commit | Local (git) | No | No changes |
| PR | Local (git) | No | No changes |

## New Files

### 1. `scripts/cody/brain-client.ts`

Shared MCP client + Claude API wrapper used by both architect and review.

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import Anthropic from "@anthropic-ai/sdk";

export interface BrainResult {
  output: string;
  toolCalls: number;
  tokensUsed: number;
}

export async function connectBrain(serverUrl: string): Promise<Client> {
  const transport = new SSEClientTransport(new URL(serverUrl));
  const client = new Client({ name: "cody-brain" });
  await client.connect(transport);
  return client;
}

export async function isBrainHealthy(serverUrl: string): Promise<boolean> {
  try {
    const resp = await fetch(serverUrl, { signal: AbortSignal.timeout(5000) });
    return resp.ok;
  } catch {
    return false;
  }
}

export async function runBrain(
  serverUrl: string,
  systemPrompt: string,
  userMessage: string,
  model: string = "claude-opus-4-20250514",
): Promise<BrainResult> {
  // 1. Connect to Context+ MCP
  const mcpClient = await connectBrain(serverUrl);
  const { tools } = await mcpClient.listTools();

  // 2. Convert MCP tools to Anthropic tool format
  const anthropicTools = tools.map(tool => ({
    name: tool.name,
    description: tool.description || "",
    input_schema: tool.inputSchema,
  }));

  // 3. Call Claude with tools
  const anthropic = new Anthropic();
  let messages = [{ role: "user", content: userMessage }];
  let toolCalls = 0;
  let totalTokens = 0;

  // 4. Tool-use loop
  while (true) {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 8192,
      system: systemPrompt,
      messages,
      tools: anthropicTools,
    });

    totalTokens += response.usage.input_tokens + response.usage.output_tokens;

    // If no tool use, we're done
    if (response.stop_reason === "end_turn") {
      const textBlock = response.content.find(b => b.type === "text");
      await mcpClient.close();
      return {
        output: textBlock?.text || "",
        toolCalls,
        tokensUsed: totalTokens,
      };
    }

    // Execute tool calls against Context+ MCP
    const toolResults = [];
    for (const block of response.content) {
      if (block.type === "tool_use") {
        toolCalls++;
        const result = await mcpClient.callTool({
          name: block.name,
          arguments: block.input,
        });
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result.content,
        });
      }
    }

    // Add assistant response + tool results to conversation
    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });
  }
}
```

### 2. `scripts/cody/architect-brain.ts`

Architect stage — replaces taskify + gap + architect.

```typescript
import { runBrain } from "./brain-client";

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
`;

export async function runArchitectBrain(
  taskMd: string,
  brainUrl: string,
): Promise<{ taskJson: object; planMd: string }> {
  const result = await runBrain(brainUrl, ARCHITECT_PROMPT, taskMd);

  // Parse task.json and plan.md from output
  const taskJsonMatch = result.output.match(/```json:task\.json\n([\s\S]*?)```/);
  const planMdMatch = result.output.match(/```markdown:plan\.md\n([\s\S]*?)```/);

  return {
    taskJson: JSON.parse(taskJsonMatch?.[1] || "{}"),
    planMd: planMdMatch?.[1] || result.output,
  };
}
```

### 3. `scripts/cody/review-brain.ts`

Review stage — replaces current OpenCode review.

```typescript
import { runBrain } from "./brain-client";

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
`;

export async function runReviewBrain(
  planMd: string,
  changedFiles: string[],
  diffs: string,
  brainUrl: string,
): Promise<string> {
  const userMessage = `## Plan\n${planMd}\n\n## Changed Files\n${changedFiles.join("\n")}\n\n## Diffs\n${diffs}`;
  const result = await runBrain(brainUrl, REVIEW_PROMPT, userMessage);
  return result.output;
}
```

### 4. `scripts/cody/brain-health.ts`

Health check with fallback logic.

```typescript
export async function isBrainAvailable(url: string | undefined): Promise<boolean> {
  if (!url) return false;
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return resp.ok;
  } catch {
    return false;
  }
}
```

## Modified Files

### 5. `scripts/cody/entry.ts`

Add brain routing before pipeline execution.

```typescript
// New env var
const BRAIN_SERVER_URL = process.env.BRAIN_SERVER_URL; // e.g., http://100.x.x.x:4097

// In the mode handler:
if (mode === 'full') {
  const brainAvailable = await isBrainAvailable(BRAIN_SERVER_URL);

  if (brainAvailable) {
    logger.info("🧠 Brain server available — using remote architect + review");

    // Phase 1: Remote architect (replaces taskify + gap + architect)
    const { taskJson, planMd } = await runArchitectBrain(taskMd, BRAIN_SERVER_URL);
    writeTaskJson(taskDir, taskJson);
    writePlanMd(taskDir, planMd);

    // Phase 2: Local executor (build + verify)
    const pipeline = resolvePipelineForMode('impl', profile, false, ctx);
    await runPipeline(ctx, pipeline);

    // Phase 3: Remote review
    const reviewMd = await runReviewBrain(planMd, changedFiles, diffs, BRAIN_SERVER_URL);
    writeReviewMd(taskDir, reviewMd);

    // Phase 4: Local commit + PR
    await runCommitAndPR(ctx);
  } else {
    logger.warn("🧠 Brain server unavailable — falling back to standard pipeline");
    await runFullMode(ctx);
  }
}
```

### 6. `opencode.json`

Add Context+ MCP server so build agent can query brain during execution.

```json
{
  "mcp": {
    "neuron": {
      "type": "sse",
      "url": "http://100.66.248.120:4097/sse"
    }
  }
}
```

### 7. Build Stage Prompt Modifications

In `scripts/cody/pipeline/definitions.ts` or stage prompt files, add brain guidance:

```typescript
const BRAIN_TOOLS_GUIDANCE = `
## Codebase Intelligence (Brain Tools)

You have access to a codebase intelligence brain via MCP tools.
Use these tools PROACTIVELY — they give you deeper understanding than just reading files.

BEFORE creating any new file:
  → semantic_code_search("what you're building") — check if similar code exists

BEFORE modifying any function:
  → get_blast_radius("functionName") — check what depends on it

BEFORE reading a whole file:
  → get_file_skeleton("path/to/file.ts") — see the API surface first

TO find related patterns:
  → search_memory_graph("topic") — check project knowledge and past decisions

TO understand project structure:
  → get_context_tree("src/server/") — see structure with symbols
`;

// Add to build prompt when brain is available:
const buildPrompt = brainAvailable
  ? `${BASE_BUILD_PROMPT}\n\n${BRAIN_TOOLS_GUIDANCE}`
  : BASE_BUILD_PROMPT;
```

### 8. Review Stage Prompt Modifications

Same brain guidance for review, plus:

```typescript
const REVIEW_BRAIN_GUIDANCE = `
BEFORE approving any change:
  → get_blast_radius on every modified function
  → run_static_analysis on changed files
  → semantic_code_search for related code that might need updating
`;
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BRAIN_SERVER_URL` | No | empty | URL of Context+ brain server (e.g., http://100.x.x.x:4097) |
| `ANTHROPIC_API_KEY` | Yes (for brain) | existing | Claude API key for architect + review |

Add to:
- `.env` (local dev)
- GitHub Actions secrets (CI)
- `scripts/cody/env-validation.ts` (optional, non-blocking)

## Testing

### Unit Tests

```
tests/unit/scripts/cody/brain-client.test.ts
tests/unit/scripts/cody/architect-brain.test.ts
tests/unit/scripts/cody/review-brain.test.ts
tests/unit/scripts/cody/brain-health.test.ts
```

Test with mocked MCP server + mocked Claude API:
- Brain connects successfully → returns results
- Brain unavailable → fallback to current pipeline
- Tool call loop → handles multiple rounds
- Parse task.json + plan.md from output
- Review produces valid review.md

### CLI Test Scenarios

Add new scenario:

```
scripts/cody-cli-test/scenarios/08-brain-architect.ts
```

- Start mock brain server
- Run pipeline with BRAIN_SERVER_URL set
- Verify architect-brain produces task.json + plan.md
- Verify build stage proceeds
- Verify review-brain produces review.md

### Integration Test

```
scripts/cody-cli-test/scenarios/09-brain-fallback.ts
```

- Set BRAIN_SERVER_URL to unreachable address
- Verify pipeline falls back to standard flow
- Verify warning logged

## Migration Strategy

1. **Phase A: Deploy brain server** (02-server-setup.md)
2. **Phase B: Add brain-client + architect-brain** (this doc, steps 1-2)
3. **Phase C: Wire into entry.ts with fallback** (step 5)
4. **Phase D: Add build prompt guidance** (step 7)
5. **Phase E: Add review-brain** (step 3)
6. **Phase F: Test all scenarios** (testing section)

Each phase is independently deployable. Fallback ensures no breaking changes.

## Estimated Time

| Step | Effort |
|------|--------|
| brain-client.ts | 2-3 hours |
| architect-brain.ts | 2-3 hours |
| review-brain.ts | 1-2 hours |
| brain-health.ts | 30 min |
| entry.ts modifications | 2-3 hours |
| opencode.json + prompt changes | 1 hour |
| Unit tests | 2-3 hours |
| CLI test scenarios | 1-2 hours |
| **Total** | **~12-17 hours** |
