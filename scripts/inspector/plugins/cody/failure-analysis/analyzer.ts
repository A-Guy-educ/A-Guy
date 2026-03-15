/**
 * @fileType utility
 * @domain inspector
 * @pattern failure-analysis
 * @ai-summary Analyzes Cody pipeline failures using MiniMax M2.5 and generates refined feedback
 */

export interface AnalysisInput {
  /** Original task description from the issue body */
  requirement: string
  /** Error message from the failure */
  errorMessage: string
  /** Name of the stage that failed */
  failedStage: string
  /** Content of the failed stage's output file */
  stageOutput: string
  /** Content of verify.md if relevant */
  verifyOutput?: string
  /** Previous retry feedback to avoid repeating */
  previousFeedback?: string
  /** Which attempt this is (1, 2, or 3) */
  retryNumber: number
}

export interface AnalysisResult {
  /** Brief analysis of what went wrong */
  rootCause: string
  /** Actionable instructions for the next attempt */
  refinedFeedback: string
  /** Whether retry is possible */
  canRetry: boolean
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
 * Analyze a Cody pipeline failure and generate refined feedback for retry.
 */
export async function analyzeFailure(input: AnalysisInput): Promise<AnalysisResult> {
  const apiKey = process.env.MINIMAX_API_KEY

  if (!apiKey) {
    return {
      rootCause: 'MINIMAX_API_KEY not set — using fallback analysis',
      refinedFeedback:
        input.previousFeedback || 'Review the error message and try a different approach.',
      canRetry: false, // Don't blindly retry without LLM analysis
    }
  }

  const context = buildContext(input)

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
          { role: 'user', content: context },
        ],
        temperature: 0.3,
      }),
    })

    if (!response.ok) {
      throw new Error(`MiniMax API error: ${response.status}`)
    }

    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] }
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      return {
        rootCause: 'Empty response from LLM',
        refinedFeedback:
          input.previousFeedback || 'Review the error message and try a different approach.',
        canRetry: false, // Don't retry on empty response
      }
    }

    return parseResponse(content, input)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      rootCause: `API error: ${errorMessage}`,
      refinedFeedback:
        input.previousFeedback || 'The failure analyzer could not reach the API. Try again.',
      canRetry: false, // Don't blindly retry on API error
    }
  }
}

function buildContext(input: AnalysisInput): string {
  let context = `## Original Requirement\n${input.requirement}\n\n## Failed Stage\n${input.failedStage}\n\n## Error Message\n${input.errorMessage}\n\n## Stage Output\n${input.stageOutput}`

  if (input.verifyOutput) {
    context += `\n\n## Verify Output\n${input.verifyOutput}`
  }

  if (input.previousFeedback) {
    context += `\n\n## Previous Retry Feedback (DO NOT repeat this approach)\n${input.previousFeedback}`
  }

  context += `\n\n## Current Attempt\nThis is attempt #${input.retryNumber} of 3.`
  return context
}

function parseResponse(content: string, input: AnalysisInput): AnalysisResult {
  // Generic fallback strings that indicate poor quality
  const GENERIC_FEEDBACK_PATTERNS = [
    'review the error',
    'try a different approach',
    'try again',
    'read the error',
    'fix the issue',
    'analyze the problem',
  ]

  function isGenericFeedback(feedback: string): boolean {
    const lower = feedback.toLowerCase()
    // Check if it's too short
    if (feedback.length < 50) return true
    // Check if it matches generic patterns
    return GENERIC_FEEDBACK_PATTERNS.some((pattern) => lower.includes(pattern))
  }

  try {
    const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/{[\s\S]*}/)
    const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content
    const parsed = JSON.parse(jsonStr)

    const refinedFeedback = parsed.refinedFeedback || 'Review the error and try again.'

    return {
      rootCause: parsed.rootCause || 'Unknown root cause',
      refinedFeedback,
      // Only retry if we have meaningful feedback
      canRetry: !isGenericFeedback(refinedFeedback),
    }
  } catch {
    return {
      rootCause: content.slice(0, 200),
      refinedFeedback:
        input.previousFeedback || 'Review the error message and try a different approach.',
      canRetry: false, // Don't retry on parse failure
    }
  }
}
