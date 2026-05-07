/**
 * Integration test for issue #1403 (second half): chat must know what lesson /
 * exercise the student is on, even when no admin Prompt is linked.
 *
 * Strategy: drive the real `composeFullSystemInstructions` (the function that
 * builds the system message used for every chat call). Pass the lessonContextBlock
 * the way the pipeline does. Assert the resulting instructions include the
 * lesson title, chapter, and (when given) the exercise prompt.
 *
 * This is the assertion that would have caught the production bug where the
 * model hallucinated "Pythagorean theorem" for a lesson titled
 * "דימיון משולשים" — because no lesson info was being injected at all.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  _buildLessonContextBlock,
  composeFullSystemInstructions,
} from '@/server/payload/endpoints/agent/chat/prompt-composition'
import config from '@payload-config'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import type { Logger } from 'pino'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const hasDatabaseUrl = !!process.env.DATABASE_URL

const noopLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  fatal: () => {},
  trace: () => {},
  child: () => noopLogger,
} as unknown as Logger

describe('buildLessonContextBlock (unit)', () => {
  it('includes lesson, chapter, course titles when given', () => {
    const block = _buildLessonContextBlock(
      { title: 'דימיון משולשים', type: 'practice' } as any,
      { title: 'Chapter 1' } as any,
      { title: 'Grade 9' } as any,
    )
    expect(block).toBeDefined()
    expect(block).toContain('דימיון משולשים')
    expect(block).toContain('Chapter 1')
    expect(block).toContain('Grade 9')
    expect(block).toContain('## Current Lesson')
    // Anti-refusal hint
    expect(block).toMatch(/do not refuse/i)
  })

  it('appends exercise prompt and hint when an exercise is provided (legacy schema)', () => {
    const block = _buildLessonContextBlock({ title: 'Triangles' } as any, null, null, {
      title: 'Exercise 14',
      prompt: 'Find the missing angle',
      hint: 'Use angle sum',
    } as any)
    expect(block).toBeDefined()
    expect(block).toContain('## Current Exercise')
    expect(block).toContain('Exercise 14')
    expect(block).toContain('Find the missing angle')
    expect(block).toContain('Use angle sum')
    // Hint should be guarded so the model doesn't blurt it out
    expect(block).toMatch(/do not reveal directly/i)
  })

  it('extracts the exercise body from content.blocks[] (current schema)', () => {
    const exercise = {
      title: 'תרגיל 14',
      content: {
        blocks: [
          { id: 'a', type: 'rich_text', value: 'בכל סעיף נתונים משולשים דומים — מצאו את' },
          { id: 'b', type: 'rich_text', value: 'אורך הצלע החסרה.' },
        ],
      },
    }
    const block = _buildLessonContextBlock(
      { title: 'דימיון משולשים' } as any,
      null,
      null,
      exercise as any,
    )
    expect(block).toBeDefined()
    expect(block).toContain('## Current Exercise')
    expect(block).toContain('תרגיל 14')
    expect(block).toContain('בכל סעיף')
    expect(block).toContain('אורך הצלע החסרה')
  })

  it('extracts prompt/hint from question_* blocks (multi-part exercises)', () => {
    const exercise = {
      title: 'תרגיל רב-שלבי',
      content: {
        blocks: [
          {
            id: 'a',
            type: 'rich_text',
            value: 'בכל סעיף נתונים משולשים דומים — מצאו את ערכו של x',
          },
          {
            id: 'b',
            type: 'question_geometry',
            prompt: 'סעיף 1: מה אורך הצלע AB?',
            hint: 'השתמש ביחס הדמיון',
          },
          {
            id: 'c',
            type: 'question_geometry',
            prompt: 'סעיף 2: חשב את שטח המשולש',
          },
        ],
      },
    }
    const block = _buildLessonContextBlock(null, null, null, exercise as any)
    expect(block).toBeDefined()
    expect(block).toContain('בכל סעיף')
    expect(block).toContain('Sub-question 2')
    expect(block).toContain('Sub-question 3')
    expect(block).toContain('סעיף 1: מה אורך הצלע AB')
    expect(block).toContain('סעיף 2: חשב את שטח המשולש')
    expect(block).toContain('השתמש ביחס הדמיון')
    expect(block).toMatch(/do not reveal directly/i)
  })

  it('handles question_* blocks where prompt/hint are InlineRichText objects (production shape)', () => {
    const exercise = {
      title: 'תרגיל 14',
      content: {
        blocks: [
          {
            id: 'a',
            type: 'rich_text',
            format: 'md-math-v1',
            value: 'בכל סעיף נתונים משולשים דומים — מצאו את ערכו של x',
            mediaIds: [],
          },
          {
            id: 'b',
            type: 'question_geometry',
            // Production shape: prompt/hint are InlineRichText objects, NOT strings
            prompt: {
              type: 'rich_text',
              format: 'md-math-v1',
              value: 'מצא את \\(x\\)',
              mediaIds: [],
            },
            hint: {
              type: 'rich_text',
              format: 'md-math-v1',
              value: 'השתמש ביחס דמיון',
              mediaIds: [],
            },
          },
        ],
      },
    }
    const block = _buildLessonContextBlock(null, null, null, exercise as any)
    expect(block).toBeDefined()
    expect(block).toContain('בכל סעיף')
    expect(block).toContain('מצא את')
    expect(block).toContain('השתמש ביחס דמיון')
  })

  it('parses content when stored as a JSON string', () => {
    const stringified = JSON.stringify({
      blocks: [{ id: 'x', type: 'rich_text', value: 'מצא את x' }],
    })
    const block = _buildLessonContextBlock(null, null, null, {
      title: 'JSON-stored',
      content: stringified,
    } as any)
    expect(block).toBeDefined()
    expect(block).toContain('מצא את x')
  })

  it('truncates very large exercise bodies', () => {
    const huge = 'x'.repeat(10000)
    const block = _buildLessonContextBlock(null, null, null, {
      title: 'Big',
      content: { blocks: [{ id: '1', type: 'rich_text', value: huge }] },
    } as any)
    expect(block).toBeDefined()
    expect(block).toContain('truncated')
    expect((block || '').length).toBeLessThan(huge.length)
  })

  it('returns undefined when nothing is known', () => {
    expect(_buildLessonContextBlock(null, null, null)).toBeUndefined()
    expect(_buildLessonContextBlock({} as any, null, null, {} as any)).toBeUndefined()
  })
})

describe.skipIf(!hasDatabaseUrl)('composeFullSystemInstructions wires lessonContextBlock', () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayload({ config })
  }, 60000)

  afterAll(async () => {
    if (payload?.db?.destroy) await payload.db.destroy()
  }, 30000)

  it('includes the lesson context block in the final instructions', async () => {
    const block = _buildLessonContextBlock(
      { title: 'דימיון משולשים', type: 'practice' } as any,
      { title: 'Chapter 1' } as any,
      { title: 'Grade 9' } as any,
    )
    expect(block).toBeDefined()

    const result = await composeFullSystemInstructions(
      payload,
      null, // no lesson prompt — the very case this fix targets
      noopLogger,
      null,
      undefined,
      undefined,
      block,
    )

    expect(result.instructions).toContain('דימיון משולשים')
    expect(result.instructions).toContain('Chapter 1')
    expect(result.instructions).toContain('## Current Lesson')

    // Order invariant: lesson context must appear AFTER the resolved/fallback
    // prompt and BEFORE the trailing math-formatting block. The unique marker
    // for the trailing block is "## Math Formatting (CRITICAL)" — the fallback
    // prompt has its own non-CRITICAL "## Math Formatting" heading.
    const ctxIdx = result.instructions.indexOf('## Current Lesson')
    const mathIdx = result.instructions.indexOf('## Math Formatting (CRITICAL)')
    expect(ctxIdx).toBeGreaterThan(0)
    expect(mathIdx).toBeGreaterThan(ctxIdx)
  }, 60000)

  it('omits the block when none is provided (back-compat)', async () => {
    const result = await composeFullSystemInstructions(
      payload,
      null,
      noopLogger,
      null,
      undefined,
      undefined,
      undefined,
    )
    expect(result.instructions).not.toContain('## Current Lesson')
    // Trailing math-formatting block still present
    expect(result.instructions).toContain('## Math Formatting (CRITICAL)')
  }, 60000)
})
