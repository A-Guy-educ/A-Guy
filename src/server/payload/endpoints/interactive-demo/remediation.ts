/**
 * Remediation Service for Interactive Demo
 *
 * Generates Socratic guidance for incorrect answers using LLM.
 */

import type { LessonSession } from '@/payload-types'

interface HistoryEntry {
  role: 'system' | 'user' | 'assistant'
  blockType: 'content' | 'mcq' | 'open' | 'remediation'
  content: string
  metadata?: Record<string, unknown>
}

export async function generateRemediation(params: {
  blockType: 'mcq' | 'open'
  prompt: string
  studentAnswer: string
  remediationPrompt?: string
  history: HistoryEntry[]
}): Promise<string | null> {
  const { blockType, prompt, studentAnswer, remediationPrompt, history } = params

  // Build context from history (last 3 entries max)
  const recentHistory = history.slice(-3)
  const historyContext = recentHistory
    .map((entry) => `[${entry.role}]: ${entry.content}`)
    .join('\n')

  // Determine system instruction
  const systemInstruction =
    remediationPrompt ??
    `
    You are a helpful math tutor helping a student understand a concept.
    The student just answered a ${blockType === 'mcq' ? 'multiple choice' : 'open-ended'} question incorrectly.

    Provide Socratic guidance to help them understand the correct answer.
    - Never reveal the answer directly
    - Ask guiding questions
    - Point out the misconception if apparent
    - Be encouraging and patient
    - Respond in the same language as the user's answer
  `

  // Build user message
  const userMessage = `
    Question: ${prompt}

    Student's answer: ${studentAnswer}

    Recent conversation context:
    ${historyContext}

    Please provide helpful guidance to help the student understand.
  `

  try {
    // Call LLM with timeout
    const timeout = 10000 // 10 second timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(
      `${process.env.GEMINI_API_URL ?? 'https://api.gemini.example.com'}/v1/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.GEMINI_API_KEY ?? ''}`,
        },
        body: JSON.stringify({
          model: 'gemini-2.0-flash-001',
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.4,
          max_output_tokens: 1024,
        }),
        signal: controller.signal,
      },
    )

    clearTimeout(timeoutId)

    if (!response.ok) {
      console.error('Remediation LLM call failed:', await response.text())
      return null
    }

    const data = await response.json()
    return data.choices?.[0]?.message?.content ?? null
  } catch (error) {
    console.error('Remediation generation failed:', error)
    return null
  }
}

/**
 * Check if remediation should be offered based on rate limits
 */
export function canOfferRemediation(
  session: LessonSession,
  blockId: string,
  maxPerBlock = 3,
  maxTotal = 15,
): boolean {
  const counts = session.remediationCounts ?? { perBlock: {}, total: 0 }
  const countsTyped = counts as { perBlock?: Record<string, number>; total?: number }
  const perBlock = countsTyped.perBlock ?? {}
  const blockCount = perBlock[blockId] ?? 0
  const total = countsTyped.total ?? 0
  return blockCount < maxPerBlock && total < maxTotal
}
