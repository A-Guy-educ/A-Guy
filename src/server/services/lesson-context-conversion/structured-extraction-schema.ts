/**
 * Schema for structured context extraction.
 *
 * Gemini is called with responseMimeType='application/json' + responseSchema
 * so each page returns an exercises array directly, instead of free-form
 * LaTeX that must be re-split with regex. The latex/solution fields still
 * carry compile-ready LaTeX content per the existing prompt rules.
 */
import { z } from 'zod'

export const ExtractedExerciseSchema = z.object({
  number: z
    .number()
    .int()
    .min(1)
    .describe('The exercise number as displayed in the source document.'),
  latex: z
    .string()
    .min(1)
    .describe(
      'Compile-ready LaTeX body for this single exercise. Do NOT include preamble, \\begin{document}, or wrapper environments — only the body of this exercise.',
    ),
  solution: z
    .string()
    .nullable()
    .describe(
      'Worked solution for this exercise as compile-ready LaTeX, or null if the source contains no solution for it.',
    ),
})

export const ExtractedPageSchema = z.object({
  exercises: z
    .array(ExtractedExerciseSchema)
    .describe(
      'Every exercise visible on this page. Empty array if the page contains no exercises (cover, formula sheet, instructions).',
    ),
})

export type ExtractedExercise = z.infer<typeof ExtractedExerciseSchema>
export type ExtractedPage = z.infer<typeof ExtractedPageSchema>
