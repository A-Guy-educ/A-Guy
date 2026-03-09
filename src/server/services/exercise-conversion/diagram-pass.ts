/**
 * Diagram Pass Module
 *
 * Converts diagram description blocks to TikZ/LaTeX code.
 * Used by both the PDF batch pipeline and V3 single-exercise pipeline.
 *
 * @fileType service-module
 * @domain conversion
 * @pattern diagram-conversion
 */
import { nanoid } from 'nanoid'

import type { Payload } from 'payload'

import type {
  DiagramBlockInfo,
  DiagramPassMetrics,
  DiagramToTikzOutput,
} from './diagram-pass.types'
import { DiagramToTikzOutputSchema } from './diagram-pass.types'

import type { AIModelKey } from '@/infra/llm/models'
import {
  getLLMProvider,
  getProviderModelConfig,
  getProviderTypeFromEnv,
  type UnifiedLLMProvider,
} from '@/infra/llm/providers/factory'

// ── Constants ──

const TIKZ_MAX_LENGTH = 10_000

/**
 * Commands that could be used for file system access or code execution.
 * Checked case-insensitively against the TikZ output.
 */
const TIKZ_DENYLIST = [
  '\\input',
  '\\include',
  '\\write',
  '\\openout',
  '\\openin',
  '\\closein',
  '\\closeout',
  '\\newwrite',
  '\\newread',
  '\\immediate',
  '\\catcode',
  '\\csname',
  '\\endcsname',
  '\\makeatletter',
  '\\makeatother',
  '\\directlua',
  '\\luaexec',
]

// ── Detection ──

/**
 * Detection patterns for V3 diagram blocks.
 *
 * V3 prompt (v3-exercise-with-diagrams.ts) instructs LLM to produce:
 * - Global:          "**Diagram:** Right triangle $ABC$..."
 * - Per-sub-question: "**Diagram for א:** A coordinate plane..."
 *
 * These become rich_text blocks in exercise content via transform.ts.
 */
const GLOBAL_DIAGRAM_PREFIX = '**Diagram:**'
const PER_SQ_DIAGRAM_REGEX = /^\*\*Diagram for (.+?):\*\*/

/**
 * Detect diagram blocks in exercises.
 * Looks for rich_text blocks starting with "**Diagram:**" or "**Diagram for X:**"
 */
export function detectDiagramBlocks(
  exercises: Array<{
    blocks: Array<{ type: string; id?: string; value?: string }>
  }>,
): DiagramBlockInfo[] {
  const diagrams: DiagramBlockInfo[] = []

  for (let exIdx = 0; exIdx < exercises.length; exIdx++) {
    const exercise = exercises[exIdx]
    for (let blkIdx = 0; blkIdx < exercise.blocks.length; blkIdx++) {
      const block = exercise.blocks[blkIdx]
      if (block.type !== 'rich_text' || !block.value) continue

      const value = block.value

      // Check global pattern: "**Diagram:** ..."
      if (value.startsWith(GLOBAL_DIAGRAM_PREFIX)) {
        diagrams.push({
          exerciseIndex: exIdx,
          blockIndex: blkIdx,
          blockId: block.id ?? nanoid(),
          description: value.slice(GLOBAL_DIAGRAM_PREFIX.length).trim(),
          isPerSubQuestion: false,
        })
        continue
      }

      // Check per-sub-question pattern: "**Diagram for X:** ..."
      const match = PER_SQ_DIAGRAM_REGEX.exec(value)
      if (match) {
        // Find end of bold prefix: "**Diagram for X:**" → skip past closing "**"
        const closingBold = value.indexOf('**', 2)
        const prefixEnd = closingBold >= 0 ? closingBold + 2 : match[0].length
        diagrams.push({
          exerciseIndex: exIdx,
          blockIndex: blkIdx,
          blockId: block.id ?? nanoid(),
          description: value.slice(prefixEnd).trim(),
          isPerSubQuestion: true,
          subQuestionLabel: match[1],
        })
      }
    }
  }

  return diagrams
}

// ── Validation ──

interface TikzValidationResult {
  valid: boolean
  reason?: string
}

/**
 * Validate TikZ for safety before insertion.
 * Checks: size limit, balanced braces, command denylist
 */
export function validateTikzSafety(tikz: string): TikzValidationResult {
  if (tikz.length > TIKZ_MAX_LENGTH) {
    return {
      valid: false,
      reason: `TikZ exceeds max length (${tikz.length} > ${TIKZ_MAX_LENGTH})`,
    }
  }

  let depth = 0
  for (const char of tikz) {
    if (char === '{') depth++
    else if (char === '}') depth--
    if (depth < 0) return { valid: false, reason: 'Unbalanced braces (extra closing brace)' }
  }
  if (depth !== 0) {
    return { valid: false, reason: `Unbalanced braces (${depth} unclosed)` }
  }

  const tikzLower = tikz.toLowerCase()
  for (const cmd of TIKZ_DENYLIST) {
    if (tikzLower.includes(cmd.toLowerCase())) {
      return { valid: false, reason: `Blocked command: ${cmd}` }
    }
  }

  return { valid: true }
}

// ── Response Parsing ──

/**
 * Parse and validate LLM response for diagram conversion.
 * Extracts JSON from markdown code blocks or raw text, then validates against schema.
 */
export function parseDiagramResponse(responseText: string): DiagramToTikzOutput | null {
  try {
    // Extract JSON — handle markdown code blocks wrapping
    const jsonMatch =
      responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/) ||
      responseText.match(/(\{[\s\S]*\})/)
    const jsonStr = jsonMatch?.[1] || responseText

    const parsed = JSON.parse(jsonStr)
    const result = DiagramToTikzOutputSchema.safeParse(parsed)

    if (!result.success) {
      return null
    }

    return result.data
  } catch {
    return null
  }
}

// ── Block Insertion ──

/**
 * Insert a latex block immediately after the diagram description block.
 * Mutates the blocks array in place.
 *
 * Returns the new block for logging/metrics.
 */
export function insertTikzBlock(
  blocks: Array<Record<string, unknown>>,
  afterIndex: number,
  tikzContent: string,
): { id: string } {
  const id = nanoid()
  const latexBlock = {
    id,
    type: 'latex' as const,
    latex: tikzContent,
    renderMode: 'block' as const,
  }

  blocks.splice(afterIndex + 1, 0, latexBlock)
  return { id }
}

// ── LLM Caller ──

/**
 * Call the LLM to generate TikZ from a diagram description.
 */
async function callDiagramGenerator(
  payload: Payload,
  provider: UnifiedLLMProvider,
  attachments: Array<{ data: string; mimeType: string }>,
  prompt: string,
): Promise<{ output: DiagramToTikzOutput | null; latencyMs: number }> {
  const startTime = Date.now()

  try {
    const providerType = await getProviderTypeFromEnv(payload)
    const modelConfig = getProviderModelConfig(providerType, 'PDF_TO_EXERCISE' as AIModelKey)

    const result = await provider.generateMultimodalCompletion(
      {
        prompt,
        model: modelConfig,
        attachments,
      },
      payload,
    )

    const output = parseDiagramResponse(result.text)
    return { output, latencyMs: Date.now() - startTime }
  } catch {
    return { output: null, latencyMs: Date.now() - startTime }
  }
}

// ── Prompt Building ──

/**
 * Build the full prompt for a single diagram conversion.
 * Injects the diagram description into the base prompt template.
 */
function buildDiagramPrompt(
  basePrompt: string,
  diagramDescription: string,
  exerciseTitle: string,
): string {
  return `${basePrompt}

## Diagram to Convert

**Exercise**: ${exerciseTitle}

**Diagram Description**:
${diagramDescription}

## Required Output Format

Return ONLY valid JSON (no markdown code blocks, no surrounding text):
{
  "tikz": "\\\\begin{tikzpicture}...\\\\end{tikzpicture}",
  "diagramType": "geometry",
  "confidence": 0.85,
  "warnings": [],
  "notes": "optional"
}

## Classification Rules
- "geometry": Euclidean geometry — triangles, circles, angles, line segments, polygons, parallel lines
- "axis": Coordinate systems — graphs, functions, plotted points, number lines, asymptotes
- "other": Everything else — flowcharts, Venn diagrams, circuit diagrams, tables, trees

## TikZ Rules
1. Create a SCHEMATIC representation — simple geometric shapes, not photorealistic
2. Use basic TikZ primitives: \\draw, \\node, \\filldraw, \\coordinate
3. Do NOT infer or add elements not described
4. Do NOT solve or interpret the exercise
5. If uncertain about an element, OMIT it rather than guess
6. Use \\texthebrew{} for Hebrew labels if needed
7. Keep coordinates as simple integers when possible`
}

// ── Metrics ──

/**
 * Create empty metrics object for initial state.
 */
export function createEmptyMetrics(): DiagramPassMetrics {
  return {
    detected: 0,
    attempted: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    latencyMs: 0,
    byType: { geometry: 0, axis: 0, other: 0 },
    failureReasons: [],
  }
}

// ── Orchestrator ──

export interface DiagramPassContext {
  attachments: Array<{ data: string; mimeType: string }>
  diagramPrompt: string
  exercises: Array<{
    title?: string
    blocks: Array<{ type: string; id?: string; value?: string; [key: string]: unknown }>
  }>
}

/**
 * Run the diagram pass for a set of exercises.
 *
 * Detects diagram blocks → generates TikZ via LLM → validates safety → inserts latex blocks.
 * Mutates exercise blocks arrays in place. Returns metrics.
 *
 * Used by:
 * - PDF batch pipeline (per segment, on ValidatedExercise[])
 * - V3 single pipeline (per extraction, on ContentBlock[])
 */
export async function runDiagramPass(
  payload: Payload,
  context: DiagramPassContext,
): Promise<DiagramPassMetrics> {
  const { attachments, diagramPrompt, exercises } = context
  const metrics = createEmptyMetrics()

  // Step 1: Detect diagram blocks across all exercises
  const diagramBlocks = detectDiagramBlocks(exercises)
  metrics.detected = diagramBlocks.length

  if (diagramBlocks.length === 0) {
    return metrics
  }

  // Get LLM provider
  const provider = await getLLMProvider(payload)

  // Step 2: Process each diagram sequentially
  // Track insertion offsets per exercise (inserting latex blocks shifts later indices)
  const insertionOffsets = new Map<number, number>()

  for (const diagram of diagramBlocks) {
    metrics.attempted++

    const exercise = exercises[diagram.exerciseIndex]
    const offset = insertionOffsets.get(diagram.exerciseIndex) ?? 0
    const adjustedBlockIndex = diagram.blockIndex + offset

    // Build the full prompt
    const fullPrompt = buildDiagramPrompt(
      diagramPrompt,
      diagram.description,
      exercise.title ?? 'Untitled',
    )

    // Call LLM
    const { output: result, latencyMs } = await callDiagramGenerator(
      payload,
      provider,
      attachments,
      fullPrompt,
    )
    metrics.latencyMs += latencyMs

    // Handle failure: invalid response
    if (!result) {
      metrics.failed++
      metrics.failureReasons.push(`LLM call failed or invalid JSON (exercise: "${exercise.title}")`)
      continue
    }

    // Handle refusal or null tikz
    if (!result.tikz || result.refusal) {
      metrics.failed++
      metrics.failureReasons.push(
        `Refused: ${result.refusal?.reason ?? 'tikz is null'} (exercise: "${exercise.title}")`,
      )
      continue
    }

    // Validate TikZ safety
    const safety = validateTikzSafety(result.tikz)
    if (!safety.valid) {
      metrics.failed++
      metrics.failureReasons.push(`TikZ safety: ${safety.reason} (exercise: "${exercise.title}")`)
      continue
    }

    // Success: insert latex block after the diagram description block
    insertTikzBlock(
      exercise.blocks as Array<Record<string, unknown>>,
      adjustedBlockIndex,
      result.tikz,
    )
    insertionOffsets.set(diagram.exerciseIndex, offset + 1)

    metrics.byType[result.diagramType]++
    metrics.succeeded++
  }

  return metrics
}
