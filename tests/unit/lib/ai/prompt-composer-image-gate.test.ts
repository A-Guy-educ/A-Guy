/**
 * Verifies the IMAGE_HANDLING_INSTRUCTIONS block is only injected into the
 * system prompt when the request carries an image. Without this gate, Gemini
 * anchors on the rejection rules and refuses text-only chats with
 * "please upload an image" responses, masking the lesson context fix.
 */
import { composeSystemInstructions } from '@/infra/llm/prompt-composer.server'
import { describe, expect, it } from 'vitest'

const IMAGE_MARKER = '## Image Handling (CRITICAL)'

describe('composeSystemInstructions — IMAGE_HANDLING gate', () => {
  it('omits image-handling block when hasImageAttached is false', () => {
    const out = composeSystemInstructions(
      [],
      'You are a tutor.',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      false,
    )
    expect(out).not.toContain(IMAGE_MARKER)
    // Math formatting is always present
    expect(out).toContain('## Math Formatting (CRITICAL)')
  })

  it('includes image-handling block when hasImageAttached is true', () => {
    const out = composeSystemInstructions(
      [],
      'You are a tutor.',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      true,
    )
    expect(out).toContain(IMAGE_MARKER)
  })

  it('defaults to including image-handling for back-compat (no flag passed)', () => {
    const out = composeSystemInstructions([], 'You are a tutor.')
    expect(out).toContain(IMAGE_MARKER)
  })
})
