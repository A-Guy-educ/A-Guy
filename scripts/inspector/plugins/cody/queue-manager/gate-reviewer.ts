/**
 * @fileType utility
 * @domain inspector
 * @pattern gate-review
 * @ai-summary LLM-powered gate review using MiniMax M2.5 — reviews specs/plans before auto-approving
 */

import type { GateReviewInput, GateReviewResult } from './types'

const SYSTEM_PROMPT = `You are a technical reviewer for an AI coding agent pipeline called "Cody".

Your task is to review a pipeline stage output (spec or plan) and decide if it adequately addresses the original requirement.

## Review criteria:
1. Does the spec/plan correctly understand the requirement?
2. Are there critical gaps or misunderstandings?
3. Are there security concerns?
4. Does the plan reference realistic files and patterns?

## Output format (JSON):
{
  "approved": true/false,
  "feedback": "Your review feedback — always provide suggestions, even on approval",
  "confidence": 0.0-1.0
}

## Guidelines:
- APPROVE if the core requirement is addressed and there are no critical gaps
- REJECT if: requirement is misunderstood, scope is fundamentally wrong, critical security issues, or plan references nonexistent patterns
- Be lenient on minor issues — the pipeline has verification stages that catch code-level problems
- Always provide actionable feedback, even on approval (refinement suggestions help the next stage)
- Keep feedback concise (2-3 sentences max)`

/**
 * Review a gate output using MiniMax M2.5 LLM.
 * Fails open: if LLM is unavailable, auto-approves.
 */
export async function reviewGate(input: GateReviewInput): Promise<GateReviewResult> {
  const apiKey = process.env.MINIMAX_API_KEY

  if (!apiKey) {
    return {
      approved: true,
      feedback: 'Auto-approved (no LLM available — MINIMAX_API_KEY not set)',
      confidence: 0,
    }
  }

  const userPrompt = buildUserPrompt(input)

  try {
    const response = await fetch('https://api.minimax.chat/v1/text/chatcompletion_v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'MiniMax-M2.5',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
      }),
    })

    if (!response.ok) {
      return {
        approved: true,
        feedback: `Auto-approved (LLM API returned ${response.status})`,
        confidence: 0,
      }
    }

    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] }
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      return {
        approved: true,
        feedback: 'Auto-approved (empty LLM response)',
        confidence: 0,
      }
    }

    return parseGateResponse(content)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return {
      approved: true,
      feedback: `Auto-approved (LLM error: ${msg})`,
      confidence: 0,
    }
  }
}

function buildUserPrompt(input: GateReviewInput): string {
  const parts = [
    `## Original Requirement`,
    input.requirement,
    ``,
    `## Gate Stage: ${input.gateName}`,
    `## Task ID: ${input.taskId}`,
    ``,
    `## Gate Output`,
    input.gateOutput.slice(0, 8000), // Truncate to avoid token limits
  ]
  return parts.join('\n')
}

function parseGateResponse(content: string): GateReviewResult {
  try {
    // Try to extract JSON from markdown code blocks or raw JSON
    const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/\{[\s\S]*\}/)
    const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content
    const parsed = JSON.parse(jsonStr)

    return {
      approved: typeof parsed.approved === 'boolean' ? parsed.approved : true,
      feedback:
        typeof parsed.feedback === 'string' && parsed.feedback.length > 0
          ? parsed.feedback
          : 'No specific feedback provided.',
      confidence:
        typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
    }
  } catch {
    // If JSON parsing fails, treat the raw text as feedback and auto-approve
    return {
      approved: true,
      feedback: content.slice(0, 500) || 'Auto-approved (could not parse LLM response)',
      confidence: 0.3,
    }
  }
}
