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
// Geometry/Axis SVG serialization
// -------------------------------------------

/**
 * Serialize a GeometrySpecV1 to an SVG string representation.
 * This creates a simplified SVG visualization of the geometry specification.
 */
function serializeGeometrySpecToSvg(
  spec: import('@/infra/contracts/graphics/geometry.v1').GeometrySpecV1,
): string {
  const { canvas, elements } = spec
  const { width, height } = canvas
  const parts: string[] = []

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
  )

  // Background
  if (canvas.background) {
    parts.push(`<rect width="100%" height="100%" fill="${canvas.background}"/>`)
  }

  // Grid
  if (canvas.grid) {
    parts.push(
      `<defs><pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e0e0e0" stroke-width="0.5"/></pattern></defs>`,
    )
    parts.push(`<rect width="100%" height="100%" fill="url(#grid)"/>`)
  }

  // Axis
  if (canvas.axis) {
    parts.push(
      `<line x1="0" y1="${height / 2}" x2="${width}" y2="${height / 2}" stroke="black" stroke-width="1"/>`,
    )
    parts.push(
      `<line x1="${width / 2}" y1="0" x2="${width / 2}" y2="${height}" stroke="black" stroke-width="1"/>`,
    )
  }

  // Points
  for (const point of elements.points || []) {
    const cx = point.x
    const cy = height - point.y // Flip Y coordinate
    const color = point.color || '#000000'
    const size = point.size || 4
    parts.push(`<circle cx="${cx}" cy="${cy}" r="${size}" fill="${color}" stroke="${color}"/>`)
    if (point.name) {
      parts.push(
        `<text x="${cx + 8}" y="${cy - 8}" font-size="12" fill="${color}">${escapeXml(point.name)}</text>`,
      )
    }
  }

  // Lines
  for (const line of elements.lines || []) {
    const fromPt = elements.points.find((p) => p.name === line.from)
    const toPt = elements.points.find((p) => p.name === line.to)
    if (fromPt && toPt) {
      const x1 = fromPt.x
      const y1 = height - fromPt.y
      const x2 = toPt.x
      const y2 = height - toPt.y
      const color = line.color || '#000000'
      const dash = line.style === 'dashed' ? 'stroke-dasharray="5,5"' : ''
      parts.push(
        `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${line.thickness || 2}" ${dash}/>`,
      )
      if (line.label?.value) {
        const midX = (x1 + x2) / 2
        const midY = (y1 + y2) / 2
        parts.push(
          `<text x="${midX}" y="${midY - 5}" font-size="${line.label.fontSize || 10}" fill="${color}" text-anchor="middle">${escapeXml(line.label.value)}</text>`,
        )
      }
    }
  }

  // Circles
  for (const circle of elements.circles || []) {
    const center = elements.points.find((p) => p.name === circle.center)
    if (center) {
      const cx = center.x
      const cy = height - center.y
      const color = circle.color || '#000000'
      if (circle.through) {
        const through = elements.points.find((p) => p.name === circle.through)
        if (through) {
          const radius = Math.sqrt(
            Math.pow(through.x - center.x, 2) + Math.pow(through.y - center.y, 2),
          )
          const dash = circle.style === 'dashed' ? 'stroke-dasharray="5,5"' : ''
          parts.push(
            `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${color}" stroke-width="2" ${dash}/>`,
          )
        }
      } else if (circle.radius) {
        const dash = circle.style === 'dashed' ? 'stroke-dasharray="5,5"' : ''
        parts.push(
          `<circle cx="${cx}" cy="${cy}" r="${circle.radius}" fill="none" stroke="${color}" stroke-width="2" ${dash}/>`,
        )
      }
    }
  }

  // Texts
  for (const text of elements.texts || []) {
    let x = text.place?.x ?? 0
    let y = height - (text.place?.y ?? 0)
    if (text.on?.from && text.on?.to) {
      const from = elements.points.find((p) => p.name === text.on?.from)
      const to = elements.points.find((p) => p.name === text.on?.to)
      if (from && to) {
        x = (from.x + to.x) / 2
        y = height - (from.y + to.y) / 2
      }
    }
    const color = text.color || '#000000'
    const fontSize = text.sizeScale ? text.sizeScale * 2 : text.fontSize || 14
    parts.push(
      `<text x="${x}" y="${y}" font-size="${fontSize}" fill="${color}" text-anchor="middle">${escapeXml(text.value)}</text>`,
    )
  }

  parts.push('</svg>')
  return parts.join('\n')
}

/**
 * Serialize an AxisSpecV1 to an SVG string representation.
 */
function serializeAxisSpecToSvg(
  spec: import('@/infra/contracts/graphics/axis.v1').AxisSpecV1,
): string {
  const viewport = spec.viewport || {}
  const xMin = viewport.xMin ?? -10
  const xMax = viewport.xMax ?? 10
  const yMin = viewport.yMin ?? -10
  const yMax = viewport.yMax ?? 10

  const width = 600
  const height = 400

  // Scale functions
  const scaleX = (x: number) => ((x - xMin) / (xMax - xMin)) * width
  const scaleY = (y: number) => height - ((y - yMin) / (yMax - yMin)) * height

  const parts: string[] = []
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
  )

  // Background
  if (spec.grid.enabled) {
    const gridColor = spec.grid.color || '#e0e0e0'
    for (let x = 0; x <= width; x += 20) {
      parts.push(
        `<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="${gridColor}" stroke-width="0.5"/>`,
      )
    }
    for (let y = 0; y <= height; y += 20) {
      parts.push(
        `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="${gridColor}" stroke-width="0.5"/>`,
      )
    }
  }

  // Axes
  const originX = scaleX(spec.axes.origin?.x ?? 0)
  const originY = scaleY(spec.axes.origin?.y ?? 0)
  parts.push(
    `<line x1="0" y1="${originY}" x2="${width}" y2="${originY}" stroke="black" stroke-width="1"/>`,
  )
  parts.push(
    `<line x1="${originX}" y1="0" x2="${originX}" y2="${height}" stroke="black" stroke-width="1"/>`,
  )

  // Arrows
  parts.push(
    `<polygon points="${width - 5},${originY - 3} ${width},${originY} ${width - 5},${originY + 3}" fill="black"/>`,
  )
  parts.push(`<polygon points="${originX - 3},5 ${originX},0 ${originX + 3},5" fill="black"/>`)

  // Graphs
  for (const graph of spec.elements.graphs || []) {
    const color = graph.color || '#0066cc'
    const strokeWidth = graph.thickness || 2
    const dash = graph.style === 'dashed' ? 'stroke-dasharray="5,5"' : ''
    // Simple polyline approximation - in a real implementation, we'd evaluate the function
    const points: string[] = []
    const steps = 100
    const rangeFrom = graph.range?.fromX ?? xMin
    const rangeTo = graph.range?.toX ?? xMax
    for (let i = 0; i <= steps; i++) {
      const x = rangeFrom + (i / steps) * (rangeTo - rangeFrom)
      // Simple linear approximation for demo - real impl would parse the function
      const y = evalSimpleGraph(graph.fn, x)
      if (y !== null && y >= yMin && y <= yMax) {
        points.push(`${scaleX(x)},${scaleY(y)}`)
      }
    }
    if (points.length > 0) {
      parts.push(
        `<polyline points="${points.join(' ')}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" ${dash}/>`,
      )
    }
  }

  // Points
  for (const point of spec.elements.points || []) {
    const cx = scaleX(point.x)
    const cy = scaleY(point.y)
    const color = point.color || '#000000'
    if (point.type === 'floating_text') {
      parts.push(
        `<text x="${cx}" y="${cy}" font-size="14" fill="${color}" text-anchor="middle">${escapeXml(point.label || '')}</text>`,
      )
    } else {
      const fillColor = point.type === 'hole' ? '#ffffff' : color
      parts.push(
        `<circle cx="${cx}" cy="${cy}" r="4" fill="${fillColor}" stroke="${color}" stroke-width="2"/>`,
      )
      if (point.label) {
        parts.push(
          `<text x="${cx + 8}" y="${cy - 8}" font-size="12" fill="${color}">${escapeXml(point.label)}</text>`,
        )
      }
    }
  }

  // Axis numbers
  if (spec.axes.showNumbers) {
    const step = spec.axes.ticks || 1
    for (let x = Math.ceil(xMin / step) * step; x <= xMax; x += step) {
      if (x === 0) continue
      const sx = scaleX(x)
      parts.push(
        `<text x="${sx}" y="${originY + 15}" font-size="10" fill="#666" text-anchor="middle">${x}</text>`,
      )
    }
    for (let y = Math.ceil(yMin / step) * step; y <= yMax; y += step) {
      if (y === 0) continue
      const sy = scaleY(y)
      parts.push(
        `<text x="${originX + 5}" y="${sy}" font-size="10" fill="#666" text-anchor="start">${y}</text>`,
      )
    }
  }

  parts.push('</svg>')
  return parts.join('\n')
}

/**
 * Very simple graph evaluator for common functions.
 * Handles basic polynomial forms. For complex functions, returns null.
 */
function evalSimpleGraph(fn: string, x: number): number | null {
  try {
    // Only handle safe, simple expressions
    const safeFn = fn.replace(/[^0-9+\-*/.x()^]/g, '')
    if (!safeFn.includes('x')) {
      // Constant
      return Number(safeFn)
    }
    // Replace ^ with ** for exponentiation, then evaluate
    const expr = safeFn.replace(/\^/g, '**')
    // Simple polynomial evaluation
    const result = new Function('x', `return ${expr}`)(x)
    return typeof result === 'number' && isFinite(result) ? result : null
  } catch {
    return null
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
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
  // For geometry/axis - the spec is serialized to SVG
  geometrySpec?: import('@/infra/contracts/graphics/geometry.v1').GeometrySpecV1
  axisSpec?: import('@/infra/contracts/graphics/axis.v1').AxisSpecV1
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
        answer: undefined, // Table answers are embedded in the table
      }
    case 'question_matching':
      return {
        prompt: block.prompt,
        hint: block.hint,
        solution: block.solution,
        fullSolution: block.fullSolution,
        answer: undefined, // Matching answers are in correctPairs
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

  // If no correct option found (shouldn't happen with valid data), use first as correct
  if (correctOptions.length === 0 && answer.options.length > 0) {
    correctOptions.push(answer.options[0])
    wrongOptions.push(...answer.options.slice(1))
  }

  return { correct: correctOptions[0], wrong: wrongOptions }
}

// -------------------------------------------
// Main conversion function
// -------------------------------------------

/**
 * Convert a single exercise document to canonical format.
 *
 * @param exerciseDoc - Raw exercise document from Payload
 * @param exerciseIndex - 0-based index within the lesson's blocks
 */
export function exerciseToCanonical(
  exerciseDoc: Record<string, unknown>,
  exerciseIndex: number,
): CanonicalExercise {
  const content = exerciseDoc.content as ContentData | undefined
  const blocks = content?.blocks || []

  // Collect data (non-question blocks)
  const dataParts: CanonicalTextContent[] = []
  const sections: CanonicalSection[] = []

  let sectionIndex = 0

  for (const block of blocks) {
    if (isRichTextBlock(block)) {
      dataParts.push(wrapTextContent(block))
    } else if (isLatexBlock(block)) {
      // LaTeX content goes into text as the latex string
      dataParts.push({ text: block.latex, table: null, PNG: '', svg: '' })
    } else if (isSvgBlock(block)) {
      dataParts.push({ text: '', table: null, PNG: '', svg: block.value })
    } else if (isQuestionGeometryBlock(block)) {
      // Geometry spec serialized to SVG
      const qc = extractQuestionContent(block)
      if (qc) {
        const sectionDataSvg = qc.geometrySpec ? serializeGeometrySpecToSvg(qc.geometrySpec) : ''
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
      }
    } else if (isQuestionAxisBlock(block)) {
      // Axis spec serialized to SVG
      const qc = extractQuestionContent(block)
      if (qc) {
        const sectionDataSvg = qc.axisSpec ? serializeAxisSpecToSvg(qc.axisSpec) : ''
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
      }
    } else {
      // Other question types (question_select, question_free_response, question_table, question_matching)
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

        // Handle MCQ answer (question_select with mcq variant)
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

  // Merge data parts into single data object
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

  // If there are no question sections, we still need an empty sections array
  return {
    exercise_number: String(exerciseIndex + 1),
    level: '1', // Default level - there's no level field in exercises
    exercise_content: {
      data: mergedData,
      sections,
    },
  }
}

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

  const exercises = exerciseDocs.map((ex, idx) => exerciseToCanonical(ex, idx))

  return {
    class: className,
    lesson_number: lessonNumber,
    topic,
    exercises,
  }
}
