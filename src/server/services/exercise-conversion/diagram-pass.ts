/**
 * Diagram Pass - TikZ Generation for PDF Exercises
 *
 * Detects "Diagram:" blocks in exercises and generates TikZ representations
 * via a dedicated LLM call. Runs as batch post-processing per segment.
 */

import {
  getLLMProvider,
  getProviderModelConfig,
  getProviderTypeFromEnv,
} from '@/infra/llm/providers/factory'
import { nanoid } from 'nanoid'
import type { Payload } from 'payload'
import type { DiagramBlockInfo, DiagramPassMetrics, DiagramPassResult } from './diagram-pass.types'
import type { EnrichedExercise } from './idempotency'

const DIAGRAM_PREFIX = 'Diagram:'

/**
 * Detect exercises containing "Diagram:" blocks
 * Returns info about each diagram block found
 */
export function detectDiagramBlocks(exercises: EnrichedExercise[]): DiagramBlockInfo[] {
  const diagrams: DiagramBlockInfo[] = []

  for (let exIdx = 0; exIdx < exercises.length; exIdx++) {
    const exercise = exercises[exIdx]
    for (let blkIdx = 0; blkIdx < exercise.blocks.length; blkIdx++) {
      const block = exercise.blocks[blkIdx]
      if (
        block.type === 'rich_text' &&
        typeof block.value === 'string' &&
        block.value.startsWith(DIAGRAM_PREFIX)
      ) {
        diagrams.push({
          exerciseIndex: exIdx,
          blockIndex: blkIdx,
          blockId: block.id,
          description: block.value.slice(DIAGRAM_PREFIX.length).trim(),
        })
      }
    }
  }

  return diagrams
}

/**
 * Parse diagram pass LLM response
 * Expected format: {"tikz":"\\begin{tikzpicture}...","confidence":"medium","notes":"optional"}
 */
export function parseDiagramResponse(responseText: string): DiagramPassResult | null {
  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch =
      responseText.match(/\{[\s\S]*\}/) || responseText.match(/```json\n([\s\S]*?)\n```/)
    const jsonStr = jsonMatch?.[1] || jsonMatch?.[0] || responseText

    const parsed = JSON.parse(jsonStr)

    // Validate required fields
    if (!parsed.tikz || typeof parsed.tikz !== 'string') {
      return null
    }

    // Validate confidence if present
    const validConfidence = ['low', 'medium', 'high']
    const confidence = validConfidence.includes(parsed.confidence) ? parsed.confidence : 'low'

    return {
      tikz: parsed.tikz,
      confidence,
      notes: parsed.notes,
    }
  } catch (error) {
    console.error('[DiagramPass] Failed to parse response:', error)
    return null
  }
}

/**
 * Insert TikZ latex block after the Diagram: rich_text block
 * Mutates the exercise in place
 */
export function insertTikzBlock(
  exercise: EnrichedExercise,
  diagramBlockIndex: number,
  tikzContent: string,
): void {
  const latexBlock = {
    id: nanoid(),
    type: 'latex' as const,
    latex: tikzContent,
    renderMode: 'block' as const,
  }

  // Insert after the diagram description block
  exercise.blocks.splice(diagramBlockIndex + 1, 0, latexBlock)
}

/**
 * Create initial metrics object
 */
export function createDiagramMetrics(): DiagramPassMetrics {
  return {
    detected: 0,
    attempted: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    latencyMs: 0,
  }
}

/**
 * Build the diagram generation prompt
 */
export function buildDiagramPrompt(
  basePrompt: string,
  diagramDescription: string,
  exerciseTitle: string,
  segment: { pageStart: number; pageEnd: number },
): string {
  return `${basePrompt}

## Diagram to Convert

**Exercise**: ${exerciseTitle}
**Source PDF pages**: ${segment.pageStart}-${segment.pageEnd}

**Diagram Description**:
${diagramDescription}

## Output Format

Return ONLY valid JSON (no markdown code blocks):
{
  "tikz": "\\begin{tikzpicture}...\\end{tikzpicture}",
  "confidence": "low" | "medium" | "high",
  "notes": "optional brief note about any assumptions made"
}

## Guidelines

1. Create a SCHEMATIC representation - simple geometric shapes
2. Use basic TikZ primitives: \\draw, \\node, \\filldraw
3. Do NOT infer or add elements not described
4. Do NOT solve or interpret the exercise
5. If uncertain about an element, OMIT it rather than guess
6. Prefer clarity over complexity`
}

/**
 * Call LLM to generate TikZ for a single diagram
 */
export async function callDiagramGenerator(
  payload: Payload,
  attachments: Array<{ data: string; mimeType: string }>,
  prompt: string,
): Promise<DiagramPassResult | null> {
  try {
    const providerType = await getProviderTypeFromEnv(payload)
    const provider = await getLLMProvider(payload, { type: providerType })
    const modelConfig = getProviderModelConfig(providerType, 'PDF_TO_EXERCISE')

    const result = await provider.generateMultimodalCompletion(
      {
        prompt,
        model: modelConfig,
        attachments,
      },
      payload,
    )

    return parseDiagramResponse(result.text)
  } catch (error) {
    console.error('[DiagramPass] LLM call failed:', error)
    return null
  }
}

/**
 * Run diagram pass for a segment's exercises
 *
 * Detects diagram blocks, generates TikZ, inserts latex blocks.
 * Mutates exercises in place. Returns metrics.
 *
 * NOTE: Processing is sequential per diagram. Parallel batching deferred to V1.1
 * for simplicity and to avoid LLM rate limit issues.
 * TODO: Consider parallel batching if latency becomes a problem.
 */
export async function runDiagramPass(
  payload: Payload,
  context: {
    attachments: Array<{ data: string; mimeType: string }>
    segment: { pageStart: number; pageEnd: number }
    diagramPrompt: string
    exercises: EnrichedExercise[]
  },
): Promise<DiagramPassMetrics> {
  const { attachments, segment, diagramPrompt, exercises } = context
  const metrics = createDiagramMetrics()
  const startTime = Date.now()

  // Step 1: Detect diagram blocks
  const diagramBlocks = detectDiagramBlocks(exercises)
  metrics.detected = diagramBlocks.length

  if (diagramBlocks.length === 0) {
    metrics.skipped = 1 // Segment skipped (no diagrams)
    return metrics
  }

  console.log(
    `[DiagramPass] Segment ${segment.pageStart}-${segment.pageEnd}: Found ${diagramBlocks.length} diagram(s)`,
  )

  // Step 2: Process each diagram
  // Track which exercises have had blocks inserted (affects subsequent indices)
  const insertionOffsets = new Map<number, number>() // exerciseIndex -> offset

  for (const diagram of diagramBlocks) {
    metrics.attempted++

    const exercise = exercises[diagram.exerciseIndex]
    const offset = insertionOffsets.get(diagram.exerciseIndex) || 0
    const adjustedBlockIndex = diagram.blockIndex + offset

    // Build prompt for this specific diagram
    const prompt = buildDiagramPrompt(diagramPrompt, diagram.description, exercise.title, segment)

    // Call LLM
    const result = await callDiagramGenerator(payload, attachments, prompt)

    if (result && result.tikz) {
      // Insert TikZ block
      insertTikzBlock(exercise, adjustedBlockIndex, result.tikz)

      // Update offset for this exercise (we inserted a block)
      insertionOffsets.set(diagram.exerciseIndex, offset + 1)

      metrics.succeeded++
      console.log(
        `[DiagramPass] Generated TikZ for "${exercise.title}" (confidence: ${result.confidence})`,
      )
    } else {
      metrics.failed++
      console.warn(`[DiagramPass] Failed to generate TikZ for "${exercise.title}"`)
      // Keep original "Diagram:" block - graceful degradation
    }
  }

  metrics.latencyMs = Date.now() - startTime

  console.log(
    `[DiagramPass] Segment complete: ${metrics.succeeded}/${metrics.attempted} succeeded in ${metrics.latencyMs}ms`,
  )

  return metrics
}
