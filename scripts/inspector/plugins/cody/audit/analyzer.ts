/**
 * @fileType utility
 * @domain inspector
 * @pattern audit-analyzer
 * @ai-summary Analyzes completed task runs using MiniMax to identify process improvements
 */

import type { AuditInput, AuditResult, Improvement } from './types'

/**
 * Analyze a completed task run to identify process improvements.
 * Uses MiniMax M2.5 for analysis.
 */
export async function analyzeRun(input: AuditInput): Promise<AuditResult> {
  const prompt = buildAuditPrompt(input)

  try {
    const response = await callMiniMax(prompt)
    return parseAuditResponse(response)
  } catch (error) {
    console.error('Audit analysis failed:', error)
    return { improvements: [], stageQuality: {} }
  }
}

/**
 * Build the audit prompt from task files.
 */
function buildAuditPrompt(input: AuditInput): string {
  return `# Auditor Analysis

Analyze the following task run and identify process improvements.

## Task Info
- Task ID: ${input.taskId}

## Task Description
${input.taskMd || '(no description)'}

## Spec
${input.specMd || '(no spec)'}

## Build
${input.buildMd || '(no build log)'}

## Verify
${input.verifyMd || '(no verify log)'}

## Your Task

1. Evaluate stage quality (spec, plan, build, verify)
2. Identify friction signals (repeated questions, retries, tribal knowledge needed)
3. Recommend improvements (DOC, INDEX, GUARDRAIL, PROMPT, AUTOMATION, PIPELINE, SECURITY, CODE_PATTERN)

## Output Format (JSON)

Return a JSON object with:
{
  "stageQuality": {
    "spec": "good|needs_improvement|poor",
    "build": "good|needs_improvement|poor", 
    "verify": "good|needs_improvement|poor"
  },
  "improvements": [
    {
      "type": "DOC|INDEX|GUARDRAIL|PROMPT|AUTOMATION|PIPELINE|SECURITY|CODE_PATTERN",
      "title": "Short title",
      "where": "file path or area",
      "rationale": "1-2 sentences explaining why this improvement would help"
    }
  ]
}

Only include improvements if you have concrete, actionable recommendations.
Return empty improvements array if the run was clean with no issues.
`
}

/**
 * Call MiniMax API for analysis.
 */
async function callMiniMax(prompt: string): Promise<string> {
  const apiKey = process.env.MINIMAX_API_KEY || process.env.OPENAI_API_KEY

  if (!apiKey) {
    console.warn('No MiniMax API key available, skipping audit')
    return JSON.stringify({ stageQuality: {}, improvements: [] })
  }

  const response = await fetch('https://api.minimax.chat/v1/text/chatcompletion_v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'MiniMax-M2.5',
      messages: [
        {
          role: 'system',
          content:
            'You are a process improvement auditor. Analyze task runs and provide actionable improvements.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
    }),
  })

  if (!response.ok) {
    throw new Error(`MiniMax API error: ${response.status}`)
  }

  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] }
  return data.choices?.[0]?.message?.content || ''
}

/**
 * Parse the LLM response into an AuditResult.
 */
function parseAuditResponse(response: string): AuditResult {
  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/) || response.match(/{[\s\S]*}/)
    const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : response

    const parsed = JSON.parse(jsonStr)

    return {
      stageQuality: parsed.stageQuality || {},
      improvements: (parsed.improvements || []).map((imp: Partial<Improvement>) => ({
        type: imp.type || 'DOC',
        title: imp.title || 'Untitled improvement',
        where: imp.where || '',
        rationale: imp.rationale || '',
      })),
    }
  } catch (error) {
    console.error('Failed to parse audit response:', error)
    return { improvements: [], stageQuality: {} }
  }
}
