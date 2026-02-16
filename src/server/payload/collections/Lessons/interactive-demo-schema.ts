/**
 * Interactive Demo Lesson Script Schema (Zod Validation)
 *
 * Reuses InlineRichText pattern from src/shared/exercise-content/types.ts
 */

import { z } from 'zod'

const DemoInlineRichTextSchema = z
  .object({
    type: z.literal('rich_text'),
    format: z.literal('md-math-v1'),
    value: z.string().max(5000),
    mediaIds: z.array(z.string().min(1)).default([]),
  })
  .strict()

const ContentBlockSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('content'),
    content: DemoInlineRichTextSchema,
    media: z.string().optional(),
  })
  .strict()

const McqOptionSchema = z
  .object({
    id: z.string().min(1),
    content: DemoInlineRichTextSchema,
  })
  .strict()

// Demo v1: single-correct only. correctOptionIds must have exactly 1 entry.
const McqBlockSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('mcq'),
    prompt: DemoInlineRichTextSchema,
    options: z.array(McqOptionSchema).min(2).max(6),
    correctOptionIds: z.array(z.string().min(1)).length(1), // FIX #1: exactly 1
    remediationPrompt: z.string().max(2000).optional(),
    media: z.string().optional(),
  })
  .strict()
  .superRefine((block, ctx) => {
    // Validate the single correctOptionId exists in options
    const optionIds = new Set(block.options.map((o) => o.id))
    const missing = block.correctOptionIds.filter((id) => !optionIds.has(id))
    if (missing.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `correctOptionIds contains unknown option id: ${missing.join(', ')}`,
        path: ['correctOptionIds'],
      })
    }
  })

const OpenBlockSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('open'),
    prompt: DemoInlineRichTextSchema,
    acceptedAnswers: z.array(z.string().min(1)).min(1).max(10),
    answerFormatHint: z.string().max(200).optional(), // FIX #13: optional per-block hint for incorrect feedback
    remediationPrompt: z.string().max(2000).optional(),
    media: z.string().optional(),
  })
  .strict()

const ScriptBlockSchema = z.discriminatedUnion('type', [
  ContentBlockSchema,
  McqBlockSchema,
  OpenBlockSchema,
])

export type ScriptBlock = z.infer<typeof ScriptBlockSchema>

export const LessonScriptSchema = z
  .object({
    version: z.literal(1),
    blocks: z.array(ScriptBlockSchema).min(1).max(50),
  })
  .strict()
  .superRefine((script, ctx) => {
    // Validate unique block IDs
    const ids = script.blocks.map((b) => b.id)
    const seen = new Set<string>()
    for (const id of ids) {
      if (seen.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate block id: ${id}`,
          path: ['blocks'],
        })
      }
      seen.add(id)
    }
  })
