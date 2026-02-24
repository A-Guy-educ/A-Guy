/**
 * @fileType utility
 * @domain supervisor
 * @pattern failure-analysis
 * @ai-summary Analyzes Cody pipeline failures using MiniMax M2.5 and generates refined feedback for retries
 */

import OpenAI from 'openai'

export interface AnalysisInput {
  /** Original task description from the issue body */
  requirement: string
  /** Error message from the failure comment */
  errorMessage: string
  /** Name of the stage that failed (e.g., "build", "verify") */
  failedStage: string
  /** Content of the failed stage's output file */
  stageOutput: string
  /** Content of verify.md if relevant (for verification failures) */
  verifyOutput?: string
  /** Previous retry feedback to avoid repeating the same approach */
  previousFeedback?: string
  /** Which attempt this is (1, 2, or 3) */
  retryNumber: number
}

export interface AnalysisResult {
  /** Brief analysis of what went wrong */
  rootCause: string
  /** Actionable instructions for the next attempt */
  refinedFeedback: string
  /** Whether retry is possible (false for infrastructure/timeouts) */
  canRetry: boolean
}

// Lazy initialization
let openai: OpenAI | null = null

function getMiniMaxClient(): OpenAI {
  if (!openai) {
    if (!process.env.MINIMAX_API_KEY) {
      throw new Error('MINIMAX_API_KEY environment variable is not set')
    }
    openai = new OpenAI({
      apiKey: process.env.MINIMAX_API_KEY,
      baseURL: 'https://api.minimax.io/v1',
    })
  }
  return openai
}

const SYSTEM_PROMPT = `You are a CI pipeline failure analyst for a Payload CMS / Next.js project.

Your task is to analyze failed Cody pipeline runs and produce actionable feedback for retry attempts.

## Input you'll receive:
- Original requirement (the issue description)
- Error message from the failure
- Failed stage name
- Content from the failed stage's output file
- verify.md content (if verification failed)
- Previous retry feedback (if this is a retry)

## Output format (JSON):
{
  "rootCause": "Brief 1-2 sentence analysis of what went wrong",
  "refinedFeedback": "Specific, actionable instructions for the coding agent's next attempt"
}

## Guidelines for refinedFeedback:
- Address the specific root cause directly
- Be concise but precise (this will be passed as a CLI --feedback argument)
- If previous feedback was provided, explicitly avoid repeating the same approach
- Reference specific files, types, functions, or patterns when possible
- For TypeScript/Payload errors, suggest specific fixes
- For verification failures (tsc, lint, format, tests), identify the specific errors and how to fix them
- Do NOT suggest "read the error more carefully" or "try again" - be specific about WHAT to change

## Common failure patterns to recognize:
- TypeScript errors: Identify the specific type mismatch or missing import
- Missing dependencies: Suggest installing the package or adding import
- Payload collection errors: Check for nested objects, missing access control, etc.
- Test failures: Identify which tests failed and what assertion needs fixing
- Build timeouts: Suggest simplifying the implementation or splitting into smaller chunks
- LLM hallucinations: If output file is empty or contains placeholder text, suggest being more specific`

/**
 * Analyze a Cody pipeline failure and generate refined feedback for retry
 */
export async function analyzeFailure(input: AnalysisInput): Promise<AnalysisResult> {
  const client = getMiniMaxClient()

  // Build context for the LLM
  let context = `## Original Requirement
${input.requirement}

## Failed Stage
${input.failedStage}

## Error Message
${input.errorMessage}

## Stage Output
${input.stageOutput}`

  if (input.verifyOutput) {
    context += `

## Verify Output
${input.verifyOutput}`
  }

  if (input.previousFeedback) {
    context += `

## Previous Retry Feedback (DO NOT repeat this approach)
${input.previousFeedback}`
  }

  context += `

## Current Attempt
This is attempt #${input.retryNumber} of 3.`

  try {
    const response = await client.chat.completions.create({
      model: 'MiniMax-M2.5',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: context },
      ],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0]?.message?.content

    if (!content) {
      return {
        rootCause: 'Failed to analyze: empty response from LLM',
        refinedFeedback:
          input.previousFeedback || 'Review the error message and try a different approach.',
        canRetry: true,
      }
    }

    // Parse JSON response
    try {
      const parsed = JSON.parse(content)
      return {
        rootCause: parsed.rootCause || 'Unknown root cause',
        refinedFeedback: parsed.refinedFeedback || 'Review the error and try again.',
        canRetry: true,
      }
    } catch {
      // JSON parse failed, try to extract from text
      return {
        rootCause: content.slice(0, 200),
        refinedFeedback: content.slice(0, 500),
        canRetry: true,
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('MiniMax API error:', errorMessage)

    // Return fallback with error info
    return {
      rootCause: `API error: ${errorMessage}`,
      refinedFeedback:
        input.previousFeedback ||
        'The supervisor failed to analyze this error. Please run `/cody rerun <task-id> --feedback "fix the issue manually"` with specific guidance.',
      canRetry: true,
    }
  }
}

/**
 * Analyze failure with fallback for when API is not available (testing)
 */
export async function analyzeFailureWithFallback(
  input: AnalysisInput,
  mockResult?: AnalysisResult,
): Promise<AnalysisResult> {
  if (mockResult) {
    return mockResult
  }

  // If no API key, return a placeholder (for testing without API)
  if (!process.env.MINIMAX_API_KEY) {
    return {
      rootCause: 'MINIMAX_API_KEY not set - using fallback analysis',
      refinedFeedback:
        input.previousFeedback ||
        'No API key available for analysis. Please manually review the error.',
      canRetry: true,
    }
  }

  return analyzeFailure(input)
}
