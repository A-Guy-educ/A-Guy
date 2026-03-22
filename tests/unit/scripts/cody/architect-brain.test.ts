import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the brain-client module before importing architect-brain
const mockRunBrain = vi.fn()
vi.mock('../../../../scripts/cody/brain-client', () => ({
  runBrain: mockRunBrain,
}))

describe('architect-brain', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  describe('runArchitectBrain', () => {
    it('parses task.json and plan.md from brain output', async () => {
      const mockOutput = `Some analysis text here

\`\`\`json:task.json
{
  "task_type": "implement_feature",
  "pipeline": "spec_execute_verify",
  "risk_level": "medium",
  "confidence": 0.85,
  "primary_domain": "backend",
  "scope": ["src/server/services/auth.ts"],
  "missing_inputs": [],
  "assumptions": []
}
\`\`\`

Here is the plan:

\`\`\`markdown:plan.md
# Implementation Plan

## Changes
- Modify auth service to support new token format

## Tests
- Add unit tests for token validation
\`\`\`
`

      mockRunBrain.mockResolvedValue({
        output: mockOutput,
        toolCalls: 3,
        tokensUsed: 5000,
      })

      const { runArchitectBrain } = await import('../../../../scripts/cody/architect-brain')
      const result = await runArchitectBrain(
        'Build a new authentication service',
        'http://100.66.248.120:4097/sse',
      )

      expect(result.taskJson).toEqual({
        task_type: 'implement_feature',
        pipeline: 'spec_execute_verify',
        risk_level: 'medium',
        confidence: 0.85,
        primary_domain: 'backend',
        scope: ['src/server/services/auth.ts'],
        missing_inputs: [],
        assumptions: [],
      })

      expect(result.planMd).toContain('# Implementation Plan')
      expect(result.planMd).toContain('## Changes')
      expect(result.planMd).toContain('## Tests')
    })

    it('returns empty object and raw output when task.json not found', async () => {
      const mockOutput = `No structured output, just plain text response from the brain.`

      mockRunBrain.mockResolvedValue({
        output: mockOutput,
        toolCalls: 2,
        tokensUsed: 3000,
      })

      const { runArchitectBrain } = await import('../../../../scripts/cody/architect-brain')
      const result = await runArchitectBrain('Build something', 'http://100.66.248.120:4097/sse')

      expect(result.taskJson).toEqual({})
      expect(result.planMd).toBe(mockOutput)
    })

    it('handles malformed JSON gracefully', async () => {
      const mockOutput = `\`\`\`json:task.json
{ invalid json here }
\`\`\`

\`\`\`markdown:plan.md
# Plan
Content here
\`\`\`
`

      mockRunBrain.mockResolvedValue({
        output: mockOutput,
        toolCalls: 1,
        tokensUsed: 2000,
      })

      const { runArchitectBrain } = await import('../../../../scripts/cody/architect-brain')
      // JSON.parse will throw on malformed JSON, which will propagate
      await expect(runArchitectBrain('Task', 'http://100.66.248.120:4097/sse')).rejects.toThrow()
    })

    it('uses correct system prompt for architect', async () => {
      mockRunBrain.mockResolvedValue({
        output: '```json:task.json\n{}\n```\n\n```markdown:plan.md\n# Plan\n```',
        toolCalls: 0,
        tokensUsed: 1000,
      })

      const { runArchitectBrain } = await import('../../../../scripts/cody/architect-brain')
      await runArchitectBrain('Task description', 'http://100.66.248.120:4097/sse')

      expect(mockRunBrain).toHaveBeenCalledWith(
        'http://100.66.248.120:4097/sse',
        expect.stringContaining('You are the architect for the Cody pipeline'),
        'Task description',
      )
    })
  })
})
