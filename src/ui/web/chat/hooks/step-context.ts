/**
 * Pure helpers for the chat ↔ interactive-lesson step-context channel.
 *
 * Lives in its own module so the prompt-injection boundary (escape on
 * write, strip on history reload) can be unit-tested independently of the
 * hook that uses them. See step-context.test.ts.
 */

import type { AskStepContextEvent } from '@/app/(frontend)/ask/_components/ask-types'

export type ChatStepContext = AskStepContextEvent

/**
 * Strip the system-emitted `<step-context>...</step-context>` prefix from a
 * persisted user message before display. Non-greedy so it stops at the FIRST
 * closing tag (the system's), and never consumes a user's legitimate
 * `</step-context>` token elsewhere in the message body.
 *
 * With the write-side escaping in place, an adversarial Gemini-derived
 * narration cannot produce a literal `</step-context>`, so the only such
 * token in a stored message comes from the system prefix or the user's own
 * typed text — both safe to handle this way.
 */
export const STEP_CONTEXT_BLOCK_REGEX = /^<step-context[\s\S]*?<\/step-context>\s*/

/**
 * Escape characters that could break the surrounding XML-ish tag. The
 * stepTitle / stepNarration originate from Gemini reading a user-uploaded
 * image and must be treated as untrusted: an adversarial image could
 * induce narration containing a literal `</step-context>` tag and inject
 * arbitrary instructions to the chat model. Escaping `<`, `>`, `&`, and
 * `"` makes that impossible.
 */
export function escapeStepContextField(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Wrap the user message with an invisible context block the AI sees. The
 * displayed bubble carries the raw message; only the prompt sent to the
 * model gets the prefix.
 */
export function buildPromptWithStepContext(message: string, step: ChatStepContext | null): string {
  if (!step) return message
  const safeTitle = step.stepTitle ? escapeStepContextField(step.stepTitle) : ''
  const safeNarration = step.stepNarration ? escapeStepContextField(step.stepNarration) : ''
  const titleAttr = safeTitle ? ` title="${safeTitle}"` : ''
  const narrationLine = safeNarration ? `\nNarration: ${safeNarration}` : ''
  return (
    `<step-context step="${step.currentStepId}" total="${step.totalSteps}"${titleAttr}>` +
    `The student is currently watching step ${step.currentStepId} of ${step.totalSteps}` +
    `${safeTitle ? `: "${safeTitle}"` : ''}.${narrationLine}` +
    `</step-context>\n\n` +
    message
  )
}

/** Remove the system prefix from a persisted user message for display. */
export function stripStepContext(content: string): string {
  return content.replace(STEP_CONTEXT_BLOCK_REGEX, '')
}
