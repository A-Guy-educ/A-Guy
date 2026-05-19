/**
 * Converts an exercise document into the canonical content export format.
 *
 * Canonical format:
 * {
 *   exercise_number: string,   // 1-indexed position
 *   level: string,             // exercise level (default "1")
 *   exercise_content: {
 *     data: { text, table, PNG, svg },   // non-question blocks
 *     sections: [{                     // question blocks
 *       section_data: { text, table, PNG, svg },
 *       question_number: string,       // א, ב, ג...
 *       question: { text, table, PNG, svg },
 *       hint: { text, table, PNG, svg },
 *       solution: { text, table, PNG, svg },
 *       full_solution: { text, table, PNG, svg },
 *       correct_option: { text, table, PNG, svg },
 *       wrong_options: [{ text, table, PNG, svg }, ...]
 *     }]
 *   }
 * }
 *
 * @fileType utility
 * @domain lessons
 * @pattern lesson-export
 * @ai-summary Converts exercise content blocks to canonical export format.
 */
import type {
  ContentBlock,
  ContentData,
  InlineRichText,
  QuestionAnswer,
} from '@/server/payload/collections/Exercises/types'
import {
  geometrySpecToSvg,
  axisSpecToSvg,
} from '@/server/services/lesson-duplication/graphics-to-svg'
import { GeometrySpecV1Schema } from '@/infra/contracts/graphics/geometry.v1'
import { AxisSpecV1Schema } from '@/infra/contracts/graphics/axis.v1'

// -------------------------------------------
// Types for canonical format
// -------------------------------------------

export interface CanonicalTextContent {
  text: string
  table: null
  PNG: string
  svg: string
}

export interface CanonicalSection {
  section_data: CanonicalTextContent
  question_number: string
  question: CanonicalTextContent
  hint: CanonicalTextContent
  solution: CanonicalTextContent
  full_solution: CanonicalTextContent
  correct_option: CanonicalTextContent
  wrong_options: CanonicalTextContent[]
}

export interface CanonicalExerciseContent {
  data: CanonicalTextContent
  sections: CanonicalSection[]
}

export interface CanonicalExercise {
  exercise_number: string
  level: string
  exercise_content: CanonicalExerciseContent
}

export interface CanonicalLessonExport {
  class: string
  lesson_number: string
  topic: string
  exercises: CanonicalExercise[]
  meta: {
    renderedSvgCount: number
    renderFailures: Array<{ blockIndex: number; blockType: string; issues: string[] }>
  }
}

// -------------------------------------------
// Hebrew ordinal conversion
// -------------------------------------------

const HEBREW_LETTERS = [
  'א',
  'ב',
  'ג',
  'ד',
  'ה',
  'ו',
  'ז',
  'ח',
  'ט',
  'י',
  'יא',
  'יב',
  'יג',
  'יד',
  'טו',
  'טז',
  'יז',
  'יח',
  'יט',
  'כ',
]

function toHebrewOrdinal(n: number): string {
  if (n <= HEBREW_LETTERS.length) {
    return HEBREW_LETTERS[n - 1]
  }
  // For larger numbers, fallback to decimal representation
  return String(n)
}

// -------------------------------------------
// Content wrapper conversion
// -------------------------------------------

/**
 * Convert an InlineRichText to canonical { text, table, PNG, svg } format.
 * LaTeX content (which comes as {latex: string}) is treated as text.
 */
function wrapTextContent(
  content: InlineRichText | string | undefined | null,
): CanonicalTextContent {
  if (!content) {
    return { text: '', table: null, PNG: '', svg: '' }
  }
  if (typeof content === 'string') {
    return { text: content, table: null, PNG: '', svg: '' }
  }
  // InlineRichText has type, format, value, mediaIds
  return { text: content.value || '', table: null, PNG: '', svg: '' }
}

// -------------------------------------------
// Block type detection
// -------------------------------------------

function isRichTextBlock(
  block: ContentBlock,
): block is import('@/server/payload/collections/Exercises/types').RichTextBlock {
  return block.type === 'rich_text'
}

function isLatexBlock(
  block: ContentBlock,
): block is import('@/server/payload/collections/Exercises/types').LatexBlock {
  return block.type === 'latex'
}

function isSvgBlock(
  block: ContentBlock,
): block is import('@/server/payload/collections/Exercises/types').SvgBlock {
  return block.type === 'svg'
}

function isQuestionGeometryBlock(
  block: ContentBlock,
): block is import('@/server/payload/collections/Exercises/types').QuestionGeometryBlock {
  return block.type === 'question_geometry'
}

function isQuestionAxisBlock(
  block: ContentBlock,
): block is import('@/server/payload/collections/Exercises/types').QuestionAxisBlock {
  return block.type === 'question_axis'
}

// -------------------------------------------
// Question content extraction
// -------------------------------------------

type AnyAnswer =
  | QuestionAnswer
  | import('@/server/payload/collections/Exercises/types').TrueFalseAnswer
  | import('@/server/payload/collections/Exercises/types').McqAnswer
  | import('@/server/payload/collections/Exercises/types').FreeResponseAnswer

interface QuestionContent {
  prompt: InlineRichText
  hint?: InlineRichText
  solution?: InlineRichText
  fullSolution?: InlineRichText
  answer?: AnyAnswer
  geometrySpec?: unknown
  axisSpec?: unknown
}

function extractQuestionContent(block: ContentBlock): QuestionContent | null {
  switch (block.type) {
    case 'question_select':
      return {
        prompt: block.prompt,
        hint: block.hint,
        solution: block.solution,
        fullSolution: block.fullSolution,
        answer: block.answer as AnyAnswer,
      }
    case 'question_free_response':
      return {
        prompt: block.prompt,
        hint: block.hint,
        solution: block.solution,
        fullSolution: block.fullSolution,
        answer: block.answer as AnyAnswer,
      }
    case 'question_table':
      return {
        prompt: block.prompt,
        hint: block.hint,
        solution: block.solution,
        fullSolution: block.fullSolution,
        answer: undefined,
      }
    case 'question_matching':
      return {
        prompt: block.prompt,
        hint: block.hint,
        solution: block.solution,
        fullSolution: block.fullSolution,
        answer: undefined,
      }
    case 'question_geometry':
      return {
        prompt: block.prompt,
        hint: block.hint,
        solution: block.solution,
        fullSolution: block.fullSolution,
        answer: block.answer as AnyAnswer,
        geometrySpec: block.geometry,
      }
    case 'question_axis':
      return {
        prompt: block.prompt,
        hint: block.hint,
        solution: block.solution,
        fullSolution: block.fullSolution,
        answer: block.answer as AnyAnswer,
        axisSpec: block.axis,
      }
    default:
      return null
  }
}

// -------------------------------------------
// MCQ option splitting
// -------------------------------------------

function splitMcqOptions(
  answer: import('@/server/payload/collections/Exercises/types').McqAnswer,
): {
  correct: import('@/server/payload/collections/Exercises/types').McqOption
  wrong: import('@/server/payload/collections/Exercises/types').McqOption[]
} {
  const correctOptions: import('@/server/payload/collections/Exercises/types').McqOption[] = []
  const wrongOptions: import('@/server/payload/collections/Exercises/types').McqOption[] = []

  for (const option of answer.options) {
    if (answer.correctOptionIds.includes(option.id)) {
      correctOptions.push(option)
    } else {
      wrongOptions.push(option)
    }
  }

  if (correctOptions.length === 0 && answer.options.length > 0) {
    correctOptions.push(answer.options[0])
    wrongOptions.push(...answer.options.slice(1))
  }

  return { correct: correctOptions[0], wrong: wrongOptions }
}

// -------------------------------------------
// Main conversion function
// -------------------------------------------

export interface ExerciseToCanonicalResult {
  exercise: CanonicalExercise
  renderedSvgCount: number
  renderFailures: Array<{ blockIndex: number; blockType: string; issues: string[] }>
}

/**
 * Convert a single exercise document to canonical format.
 *
 * @param exerciseDoc - Raw exercise document from Payload
 * @param exerciseIndex - 0-based index within the lesson's blocks
 */
export function exerciseToCanonical(
  exerciseDoc: Record<string, unknown>,
  exerciseIndex: number,
): ExerciseToCanonicalResult {
  const content = exerciseDoc.content as ContentData | undefined
  const blocks = content?.blocks || []

  const dataParts: CanonicalTextContent[] = []
  const sections: CanonicalSection[] = []
  let renderedSvgCount = 0
  const renderFailures: Array<{ blockIndex: number; blockType: string; issues: string[] }> = []

  let sectionIndex = 0

  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
    const block = blocks[blockIndex]
    if (isRichTextBlock(block)) {
      dataParts.push(wrapTextContent(block))
    } else if (isLatexBlock(block)) {
      dataParts.push({ text: block.latex, table: null, PNG: '', svg: '' })
    } else if (isSvgBlock(block)) {
      dataParts.push({ text: '', table: null, PNG: '', svg: block.value })
    } else if (isQuestionGeometryBlock(block)) {
      const qc = extractQuestionContent(block)
      if (qc?.geometrySpec) {
        // Validate before rendering
        const parsed = GeometrySpecV1Schema.safeParse(qc.geometrySpec)
        if (!parsed.success) {
          renderFailures.push({
            blockIndex,
            blockType: 'question_geometry',
            issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
          })
        } else {
          const sectionDataSvg = geometrySpecToSvg(qc.geometrySpec)
          if (sectionDataSvg) {
            renderedSvgCount++
            const section: CanonicalSection = {
              section_data: { text: '', table: null, PNG: '', svg: sectionDataSvg },
              question_number: toHebrewOrdinal(sectionIndex + 1),
              question: wrapTextContent(qc.prompt),
              hint: wrapTextContent(qc.hint),
              solution: wrapTextContent(qc.solution),
              full_solution: wrapTextContent(qc.fullSolution),
              correct_option: { text: '', table: null, PNG: '', svg: '' },
              wrong_options: [],
            }
            sections.push(section)
            sectionIndex++
          } else {
            renderFailures.push({
              blockIndex,
              blockType: 'question_geometry',
              issues: ['Rendering returned empty SVG'],
            })
          }
        }
      }
    } else if (isQuestionAxisBlock(block)) {
      const qc = extractQuestionContent(block)
      if (qc?.axisSpec) {
        const parsed = AxisSpecV1Schema.safeParse(qc.axisSpec)
        if (!parsed.success) {
          renderFailures.push({
            blockIndex,
            blockType: 'question_axis',
            issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
          })
        } else {
          const sectionDataSvg = axisSpecToSvg(qc.axisSpec)
          if (sectionDataSvg) {
            renderedSvgCount++
            const section: CanonicalSection = {
              section_data: { text: '', table: null, PNG: '', svg: sectionDataSvg },
              question_number: toHebrewOrdinal(sectionIndex + 1),
              question: wrapTextContent(qc.prompt),
              hint: wrapTextContent(qc.hint),
              solution: wrapTextContent(qc.solution),
              full_solution: wrapTextContent(qc.fullSolution),
              correct_option: { text: '', table: null, PNG: '', svg: '' },
              wrong_options: [],
            }
            sections.push(section)
            sectionIndex++
          } else {
            renderFailures.push({
              blockIndex,
              blockType: 'question_axis',
              issues: ['Rendering returned empty SVG'],
            })
          }
        }
      }
    } else {
      const qc = extractQuestionContent(block)
      if (qc) {
        const section: CanonicalSection = {
          section_data: { text: '', table: null, PNG: '', svg: '' },
          question_number: toHebrewOrdinal(sectionIndex + 1),
          question: wrapTextContent(qc.prompt),
          hint: wrapTextContent(qc.hint),
          solution: wrapTextContent(qc.solution),
          full_solution: wrapTextContent(qc.fullSolution),
          correct_option: { text: '', table: null, PNG: '', svg: '' },
          wrong_options: [],
        }

        if (
          block.type === 'question_select' &&
          block.variant === 'mcq' &&
          qc.answer &&
          'options' in qc.answer &&
          'correctOptionIds' in qc.answer
        ) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { correct, wrong } = splitMcqOptions(qc.answer as any)
          section.correct_option = wrapTextContent(correct.content)
          section.wrong_options = wrong.map((opt) => wrapTextContent(opt.content))
        }

        sections.push(section)
        sectionIndex++
      }
    }
  }

  const mergedData: CanonicalTextContent = {
    text: dataParts
      .map((d) => d.text)
      .filter(Boolean)
      .join('\n'),
    table: null,
    PNG: '',
    svg: dataParts
      .map((d) => d.svg)
      .filter(Boolean)
      .join('\n'),
  }

  return {
    exercise: {
      exercise_number: String(exerciseIndex + 1),
      level: '1',
      exercise_content: {
        data: mergedData,
        sections,
      },
    },
    renderedSvgCount,
    renderFailures,
  }
}

// -------------------------------------------
// Build canonical lesson export
// -------------------------------------------

/**
 * Build the complete canonical lesson export structure.
 *
 * @param lessonDoc - Raw lesson document from Payload
 * @param exerciseDocs - Array of exercise documents in blocks order
 * @param className - The grade/class level (e.g., "כיתה ז")
 */
export function buildCanonicalLessonExport(
  lessonDoc: Record<string, unknown>,
  exerciseDocs: Record<string, unknown>[],
  className: string,
): CanonicalLessonExport {
  const lessonNumber = String((lessonDoc.order as number) || 1)
  const topic = (lessonDoc.title as string) || ''

  let totalRenderedSvgCount = 0
  const allRenderFailures: Array<{ blockIndex: number; blockType: string; issues: string[] }> = []

  const exercises: CanonicalExercise[] = []
  for (let i = 0; i < exerciseDocs.length; i++) {
    const result = exerciseToCanonical(exerciseDocs[i], i)
    exercises.push(result.exercise)
    totalRenderedSvgCount += result.renderedSvgCount
    allRenderFailures.push(...result.renderFailures)
  }

  return {
    class: className,
    lesson_number: lessonNumber,
    topic,
    exercises,
    meta: {
      renderedSvgCount: totalRenderedSvgCount,
      renderFailures: allRenderFailures,
    },
  }
}
