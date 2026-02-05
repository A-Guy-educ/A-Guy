# Diagram Roundtrip Pass - Implementation Plan

**Status**: Ready for Implementation
**Spec Version**: 1.1
**Last Updated**: 2026-02-05

---

## Executive Summary

Add a second LLM pass for diagram-to-TikZ conversion in the PDF→Exercises pipeline. Runs at segment-level post-processing, batch processes all diagram-containing exercises, fails gracefully without breaking the pipeline.

**Key Decisions**:
- Run location: End of segment (per-segment batch)
- Model config: Reuse `PDF_TO_EXERCISE` (no new model key)
- Prompt source: Select from Prompts collection (new `diagram_generator` usage type)
- Failure mode: Keep "Diagram:" block, increment metrics, continue
- Transaction safety: Pass `req` through all operations (per AGENTS.md)
- Processing: Sequential per diagram (parallel batching deferred to V1.1)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│ PDF TO EXERCISES CONVERSION JOB (with Diagram Pass)                 │
└─────────────────────────────────────────────────────────────────────┘

PASS 0: PDF Load & Validate (unchanged)

PASS 1: Segmentation (unchanged)

PASS 2: FOR EACH SEGMENT
  ├─ Extract: LLM Call (MODIFIED - prompt instructs "Diagram:" blocks)
  │     └─ Output: exercises with rich_text blocks starting "Diagram:"
  │
  ├─ Parse & Validate (unchanged)
  │
  ├─ Enrich Block IDs (unchanged)
  │
  ├─ In-Memory Dedup (unchanged)
  │
  ├─ Verify (unchanged)
  │
  ├─ ══════════════════════════════════════════════════════════════
  │  NEW: DIAGRAM PASS (batch per segment)
  │  ══════════════════════════════════════════════════════════════
  │  ├─ Detect: Find exercises with "Diagram:" blocks
  │  ├─ Skip if none detected
  │  ├─ FOR EACH exercise with diagram:
  │  │    ├─ Build prompt with: diagram description + page context
  │  │    ├─ Call LLM for TikZ generation
  │  │    ├─ Parse JSON response: {tikz, confidence}
  │  │    ├─ On success: Insert latex block after "Diagram:" block
  │  │    └─ On failure: Log, increment metrics, keep original
  │  └─ Record metrics: detected, attempted, succeeded, failed, latencyMs
  │
  └─ Upsert per Exercise (unchanged)

Output: (EXTENDED with diagram metrics)
  {
    ...,
    diagramsDetected: number,
    diagramPassAttempted: number,
    diagramPassSucceeded: number,
    diagramPassFailed: number,
    diagramPassSkipped: number,
    diagramPassLatencyMsTotal: number,
    segments: [{
      ...,
      debug: {
        proposedIdempotencyKeys: [...],
        diagramPass: { detected, attempted, succeeded, failed, latencyMs }
      }
    }]
  }
```

---

## Implementation Tasks

### Phase 1: Schema & Types (Foundation)

#### Task 1.1: Add `diagram_generator` to Prompts Collection

**File**: `src/server/payload/collections/Prompts.ts`

```typescript
// Update usage field options
{
  name: 'usage',
  type: 'select',
  options: [
    { label: 'Chat', value: 'chat' },
    { label: 'PDF Extractor', value: 'extractor' },
    { label: 'PDF Verifier', value: 'verifier' },
    { label: 'Diagram Generator', value: 'diagram_generator' },  // NEW
  ],
  // ...
}
```

#### Task 1.2: Create Diagram Pass Types

**File**: `src/server/services/exercise-conversion/diagram-pass.types.ts` (NEW)

```typescript
/**
 * Diagram Pass Types
 * Types for the diagram-to-TikZ conversion pass
 */

export interface DiagramPassMetrics {
  detected: number
  attempted: number
  succeeded: number
  failed: number
  skipped: number
  latencyMs: number
}

export interface DiagramPassResult {
  tikz: string
  confidence: 'low' | 'medium' | 'high'
  notes?: string
}

export interface DiagramBlockInfo {
  exerciseIndex: number
  blockIndex: number
  blockId: string
  description: string  // The "Diagram:" block value (without prefix)
}

export interface DiagramPassContext {
  attachments: Array<{ data: string; mimeType: string }>
  segment: { pageStart: number; pageEnd: number }
  diagramPrompt: string
  exercises: EnrichedExercise[]
  req: any  // Transaction safety - pass through for nested operations
}
```

#### Task 1.3: Extend Job Output Types

**File**: `src/server/payload/jobs/types.ts`

Add to `JobOutput` interface:
```typescript
export interface PdfToExercisesOutput {
  // Existing fields...
  segmentsTotal: number
  segmentsDone: number
  segmentsFailed: number
  exercisesCreated: number
  exercisesDeduped: number
  exercisesSkipped: number
  errors: JobError[]
  segments: SegmentResult[]

  // NEW: Diagram pass aggregate metrics
  diagramsDetected: number
  diagramPassAttempted: number
  diagramPassSucceeded: number
  diagramPassFailed: number
  diagramPassSkipped: number
  diagramPassLatencyMsTotal: number
}

export interface SegmentResult {
  // Existing fields...
  debug?: {
    proposedIdempotencyKeys: string[]
    // NEW
    diagramPass?: {
      detected: number
      attempted: number
      succeeded: number
      failed: number
      latencyMs: number
    }
  }
}
```

---

### Phase 2: Core Diagram Pass Implementation

#### Task 2.1: Create Diagram Detection Utility

**File**: `src/server/services/exercise-conversion/diagram-pass.ts` (NEW)

```typescript
/**
 * Diagram Pass - TikZ Generation for PDF Exercises
 *
 * Detects "Diagram:" blocks in exercises and generates TikZ representations
 * via a dedicated LLM call. Runs as batch post-processing per segment.
 */

import { nanoid } from 'nanoid'
import type { EnrichedExercise } from './idempotency'
import type { DiagramBlockInfo, DiagramPassMetrics, DiagramPassResult } from './diagram-pass.types'

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
        block.value?.startsWith(DIAGRAM_PREFIX)
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
    const jsonMatch = responseText.match(/\{[\s\S]*\}/) ||
                      responseText.match(/```json\n([\s\S]*?)\n```/)
    const jsonStr = jsonMatch?.[1] || jsonMatch?.[0] || responseText

    const parsed = JSON.parse(jsonStr)

    // Validate required fields
    if (!parsed.tikz || typeof parsed.tikz !== 'string') {
      return null
    }

    // Validate confidence if present
    const validConfidence = ['low', 'medium', 'high']
    const confidence = validConfidence.includes(parsed.confidence)
      ? parsed.confidence
      : 'low'

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
```

#### Task 2.2: Create Diagram Pass LLM Caller

**File**: `src/server/services/exercise-conversion/diagram-pass.ts` (continued)

```typescript
import { getLLMProvider, getProviderTypeFromEnv, getProviderModelConfig } from '@/infra/llm/providers/factory'
import type { Payload } from 'payload'

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
    const provider = await getLLMProvider(payload)
    const providerType = await getProviderTypeFromEnv(payload)
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
```

#### Task 2.3: Create Main Diagram Pass Orchestrator

**File**: `src/server/services/exercise-conversion/diagram-pass.ts` (continued)

```typescript
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
  req: any,  // Transaction safety - pass through for nested operations (per AGENTS.md)
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
    metrics.skipped = 1  // Segment skipped (no diagrams)
    return metrics
  }

  console.log(`[DiagramPass] Segment ${segment.pageStart}-${segment.pageEnd}: Found ${diagramBlocks.length} diagram(s)`)

  // Step 2: Process each diagram
  // Track which exercises have had blocks inserted (affects subsequent indices)
  const insertionOffsets = new Map<number, number>()  // exerciseIndex -> offset

  for (const diagram of diagramBlocks) {
    metrics.attempted++

    const exercise = exercises[diagram.exerciseIndex]
    const offset = insertionOffsets.get(diagram.exerciseIndex) || 0
    const adjustedBlockIndex = diagram.blockIndex + offset

    // Build prompt for this specific diagram
    const prompt = buildDiagramPrompt(
      diagramPrompt,
      diagram.description,
      exercise.title,
      segment,
    )

    // Call LLM
    const result = await callDiagramGenerator(payload, attachments, prompt)

    if (result && result.tikz) {
      // Insert TikZ block
      insertTikzBlock(exercise, adjustedBlockIndex, result.tikz)

      // Update offset for this exercise (we inserted a block)
      insertionOffsets.set(diagram.exerciseIndex, offset + 1)

      metrics.succeeded++
      console.log(`[DiagramPass] Generated TikZ for "${exercise.title}" (confidence: ${result.confidence})`)
    } else {
      metrics.failed++
      console.warn(`[DiagramPass] Failed to generate TikZ for "${exercise.title}"`)
      // Keep original "Diagram:" block - graceful degradation
    }
  }

  metrics.latencyMs = Date.now() - startTime

  console.log(`[DiagramPass] Segment complete: ${metrics.succeeded}/${metrics.attempted} succeeded in ${metrics.latencyMs}ms`)

  return metrics
}
```

---

### Phase 3: Integration into PDF Task

#### Task 3.1: Add Diagram Prompt Fetching

**File**: `src/server/payload/jobs/pdf-to-exercises-task.ts`

Add near top of handler, after extractor/verifier prompt validation:

```typescript
// Fetch diagram generator prompt (optional - skip if not configured)
let diagramPrompt: string | null = null
if (input.promptSnapshot?.diagramGenerator) {
  diagramPrompt = input.promptSnapshot.diagramGenerator
} else {
  // Try to fetch published diagram_generator prompt for tenant
  const diagramPromptDoc = await payload.find({
    collection: 'prompts',
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { status: { equals: 'published' } },
        { usage: { equals: 'diagram_generator' } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  if (diagramPromptDoc.docs.length > 0) {
    diagramPrompt = diagramPromptDoc.docs[0].template
  }
}
```

#### Task 3.2: Integrate Diagram Pass into Segment Processing

**File**: `src/server/payload/jobs/pdf-to-exercises-task.ts`

Modify `processSegmentWithMultimodal` to accept diagram prompt and return diagram metrics:

```typescript
async function processSegmentWithMultimodal(
  payload: any,
  req: any,
  context: {
    attachments: Array<{ data: string; mimeType: string }>
    segment: { pageStart: number; pageEnd: number }
    extractorPrompt: string
    verifierPrompt: string
    diagramPrompt: string | null  // NEW
    output: any
    tenantId: string
  },
): Promise<{ exercises: EnrichedExercise[]; diagramMetrics: DiagramPassMetrics }> {
  // ... existing extraction, validation, verification code ...

  // ========== NEW: Diagram Pass ==========
  let diagramMetrics = createDiagramMetrics()

  if (diagramPrompt && validExercises.length > 0) {
    diagramMetrics = await runDiagramPass(payload, req, {  // Pass req for transaction safety
      attachments,
      segment,
      diagramPrompt,
      exercises: validExercises,
    })
  } else if (!diagramPrompt) {
    diagramMetrics.skipped = validExercises.length  // All skipped - no prompt configured
  }

  return { exercises: validExercises, diagramMetrics }
}
```

#### Task 3.3: Update Job Output Aggregation

**File**: `src/server/payload/jobs/pdf-to-exercises-task.ts`

Update the output initialization and aggregation:

```typescript
const output: PdfToExercisesOutput = {
  // Existing...
  segmentsTotal: 0,
  segmentsDone: 0,
  segmentsFailed: 0,
  exercisesCreated: 0,
  exercisesDeduped: 0,
  exercisesSkipped: 0,
  errors: [],
  segments: [],

  // NEW: Diagram pass aggregates
  diagramsDetected: 0,
  diagramPassAttempted: 0,
  diagramPassSucceeded: 0,
  diagramPassFailed: 0,
  diagramPassSkipped: 0,
  diagramPassLatencyMsTotal: 0,
}

// In segment processing loop, after diagram pass:
output.diagramsDetected += diagramMetrics.detected
output.diagramPassAttempted += diagramMetrics.attempted
output.diagramPassSucceeded += diagramMetrics.succeeded
output.diagramPassFailed += diagramMetrics.failed
output.diagramPassSkipped += diagramMetrics.skipped
output.diagramPassLatencyMsTotal += diagramMetrics.latencyMs

// In segment result:
output.segments.push({
  // existing...
  debug: {
    proposedIdempotencyKeys,
    diagramPass: diagramMetrics,  // NEW
  },
})
```

---

### Phase 4: Prompt Configuration

#### Task 4.1: Create Default Diagram Generator Prompt

**File**: `src/infra/llm/prompts/diagram-generator.ts` (NEW)

```typescript
/**
 * Default system prompt for diagram-to-TikZ generation
 *
 * Used when no custom prompt is configured in the Prompts collection.
 * Optimized for schematic, minimal TikZ output.
 */

export const DEFAULT_DIAGRAM_GENERATOR_PROMPT = `You are an expert at converting diagram descriptions into TikZ/LaTeX code for educational materials.

## Your Task

Convert the provided diagram description into clean, schematic TikZ code that accurately represents the visual elements described.

## Critical Rules

1. **Schematic Only**: Create simple geometric representations, not photorealistic drawings
2. **No Inference**: Only include elements explicitly described - never add assumed details
3. **No Solutions**: Do not solve, interpret, or add calculations to the diagram
4. **Omit When Uncertain**: If a described element is unclear, omit it rather than guess
5. **Hebrew Support**: Use \\texthebrew{} for Hebrew labels if needed

## TikZ Best Practices

- Use basic primitives: \\draw, \\node, \\filldraw, \\coordinate
- Keep coordinates simple (integers when possible)
- Use named styles for repeated elements
- Add clear comments for complex sections
- Ensure the output compiles with standard TikZ packages

## Common Patterns

**Coordinate System**:
\\begin{tikzpicture}
  \\draw[->] (0,0) -- (5,0) node[right] {$x$};
  \\draw[->] (0,0) -- (0,4) node[above] {$y$};
\\end{tikzpicture}

**Labeled Points**:
\\node[circle, fill, inner sep=1.5pt, label=above:{$A$}] at (1,2) {};

**Geometric Shapes**:
\\draw (0,0) rectangle (3,2);
\\draw (2,2) circle (1);
\\draw (0,0) -- (3,0) -- (1.5,2.5) -- cycle;

**Angles**:
\\draw pic["$\\theta$", draw, angle radius=0.5cm] {angle=B--A--C};`
```

#### Task 4.2: Update Conversion Queue to Include Diagram Prompt

**File**: `src/server/payload/services/exercise-conversion-service.ts`

Add diagram prompt to the job input:

```typescript
async queueConversion(params: QueueConversionParams): Promise<ConversionResult> {
  // ... existing validation ...

  // Fetch diagram generator prompt (optional)
  const diagramPromptDoc = await this.payload.find({
    collection: 'prompts',
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { status: { equals: 'published' } },
        { usage: { equals: 'diagram_generator' } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const diagramPromptTemplate = diagramPromptDoc.docs.length > 0
    ? diagramPromptDoc.docs[0].template
    : null

  // Take a snapshot of all prompts
  const promptSnapshot = {
    extractor: extractorPrompt.template,
    verifier: verifierPrompt.template,
    diagramGenerator: diagramPromptTemplate,  // NEW (nullable)
  }

  // ... rest of job queuing ...
}
```

---

### Phase 5: Testing

#### Task 5.1: Unit Tests for Diagram Detection

**File**: `tests/int/diagram-pass.int.spec.ts` (NEW - flat structure per existing test patterns)

```typescript
import { describe, expect, it } from 'vitest'
import {
  detectDiagramBlocks,
  parseDiagramResponse,
  insertTikzBlock,
  buildDiagramPrompt,
} from '@/server/services/exercise-conversion/diagram-pass'

describe('Diagram Pass', () => {
  describe('detectDiagramBlocks', () => {
    it('should detect blocks starting with "Diagram:"', () => {
      const exercises = [
        {
          title: 'Test Exercise',
          orderInSegment: 1,
          blocks: [
            { id: 'b1', type: 'rich_text', value: 'Some intro text' },
            { id: 'b2', type: 'rich_text', value: 'Diagram: A triangle with vertices A, B, C' },
            { id: 'b3', type: 'latex', latex: '\\frac{1}{2}' },
          ],
        },
      ]

      const diagrams = detectDiagramBlocks(exercises)

      expect(diagrams).toHaveLength(1)
      expect(diagrams[0]).toEqual({
        exerciseIndex: 0,
        blockIndex: 1,
        blockId: 'b2',
        description: 'A triangle with vertices A, B, C',
      })
    })

    it('should return empty array when no diagrams', () => {
      const exercises = [
        {
          title: 'No Diagram',
          orderInSegment: 1,
          blocks: [
            { id: 'b1', type: 'rich_text', value: 'Just text' },
          ],
        },
      ]

      expect(detectDiagramBlocks(exercises)).toHaveLength(0)
    })

    it('should detect multiple diagrams across exercises', () => {
      const exercises = [
        {
          title: 'Ex1',
          orderInSegment: 1,
          blocks: [
            { id: 'b1', type: 'rich_text', value: 'Diagram: Circle' },
          ],
        },
        {
          title: 'Ex2',
          orderInSegment: 2,
          blocks: [
            { id: 'b2', type: 'rich_text', value: 'Diagram: Square' },
            { id: 'b3', type: 'rich_text', value: 'Diagram: Triangle' },
          ],
        },
      ]

      const diagrams = detectDiagramBlocks(exercises)

      expect(diagrams).toHaveLength(3)
    })
  })

  describe('parseDiagramResponse', () => {
    it('should parse valid JSON response', () => {
      const response = '{"tikz":"\\\\begin{tikzpicture}\\\\end{tikzpicture}","confidence":"high"}'
      const result = parseDiagramResponse(response)

      expect(result).toEqual({
        tikz: '\\begin{tikzpicture}\\end{tikzpicture}',
        confidence: 'high',
        notes: undefined,
      })
    })

    it('should return null for invalid JSON', () => {
      expect(parseDiagramResponse('not json')).toBeNull()
    })

    it('should return null when tikz field missing', () => {
      expect(parseDiagramResponse('{"confidence":"high"}')).toBeNull()
    })

    it('should default confidence to low when invalid', () => {
      const response = '{"tikz":"code","confidence":"invalid"}'
      const result = parseDiagramResponse(response)

      expect(result?.confidence).toBe('low')
    })
  })

  describe('insertTikzBlock', () => {
    it('should insert latex block after specified index', () => {
      const exercise = {
        title: 'Test',
        orderInSegment: 1,
        blocks: [
          { id: 'b1', type: 'rich_text', value: 'Diagram: Circle' },
          { id: 'b2', type: 'rich_text', value: 'Question text' },
        ],
      }

      insertTikzBlock(exercise, 0, '\\begin{tikzpicture}\\end{tikzpicture}')

      expect(exercise.blocks).toHaveLength(3)
      expect(exercise.blocks[1].type).toBe('latex')
      expect(exercise.blocks[1].latex).toBe('\\begin{tikzpicture}\\end{tikzpicture}')
      expect(exercise.blocks[2].id).toBe('b2')  // Original block shifted
    })
  })
})
```

#### Task 5.2: Integration Test with Mock LLM

**File**: `tests/int/diagram-pass-integration.int.spec.ts` (NEW - flat structure per existing test patterns)

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { runDiagramPass, createDiagramMetrics } from '@/server/services/exercise-conversion/diagram-pass'

// Mock LLM provider
vi.mock('@/infra/llm/providers/factory', () => ({
  getLLMProvider: vi.fn().mockResolvedValue({
    generateMultimodalCompletion: vi.fn().mockResolvedValue({
      text: '{"tikz":"\\\\begin{tikzpicture}\\\\draw (0,0) circle (1);\\\\end{tikzpicture}","confidence":"medium"}',
    }),
  }),
  getProviderTypeFromEnv: vi.fn().mockResolvedValue('GEMINI'),
  getProviderModelConfig: vi.fn().mockReturnValue({ name: 'test', temperature: 0.1, maxOutputTokens: 8192 }),
}))

describe('Diagram Pass Integration', () => {
  const mockPayload = {} as any
  const mockReq = {} as any  // Transaction safety
  const mockAttachments = [{ data: 'base64pdf', mimeType: 'application/pdf' }]
  const mockSegment = { pageStart: 1, pageEnd: 2 }
  const mockPrompt = 'Generate TikZ'

  it('should process exercises with diagram blocks', async () => {
    const exercises = [
      {
        title: 'Geometry Problem',
        orderInSegment: 1,
        blocks: [
          { id: 'b1', type: 'rich_text', value: 'Diagram: A circle with radius r' },
          { id: 'b2', type: 'rich_text', value: 'Find the area.' },
        ],
      },
    ]

    const metrics = await runDiagramPass(mockPayload, mockReq, {
      attachments: mockAttachments,
      segment: mockSegment,
      diagramPrompt: mockPrompt,
      exercises,
    })

    expect(metrics.detected).toBe(1)
    expect(metrics.attempted).toBe(1)
    expect(metrics.succeeded).toBe(1)
    expect(metrics.failed).toBe(0)

    // Verify TikZ was inserted
    expect(exercises[0].blocks).toHaveLength(3)
    expect(exercises[0].blocks[1].type).toBe('latex')
  })

  it('should skip segment with no diagrams', async () => {
    const exercises = [
      {
        title: 'Text Only',
        orderInSegment: 1,
        blocks: [
          { id: 'b1', type: 'rich_text', value: 'Just some text' },
        ],
      },
    ]

    const metrics = await runDiagramPass(mockPayload, mockReq, {
      attachments: mockAttachments,
      segment: mockSegment,
      diagramPrompt: mockPrompt,
      exercises,
    })

    expect(metrics.detected).toBe(0)
    expect(metrics.skipped).toBe(1)
    expect(exercises[0].blocks).toHaveLength(1)  // Unchanged
  })
})
```

---

### Phase 6: Documentation & Cleanup

#### Task 6.1: Update AGENTS.md

Add section on Diagram Pass architecture and configuration.

#### Task 6.2: Add Admin Documentation

Document how to create/configure diagram generator prompts in the Prompts collection.

---

## File Change Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `src/server/payload/collections/Prompts.ts` | MODIFY | Add `diagram_generator` usage option |
| `src/server/services/exercise-conversion/diagram-pass.types.ts` | NEW | Type definitions |
| `src/server/services/exercise-conversion/diagram-pass.ts` | NEW | Core implementation (with `req` param) |
| `src/server/payload/jobs/types.ts` | MODIFY | Extend output types |
| `src/server/payload/jobs/pdf-to-exercises-task.ts` | MODIFY | Integrate diagram pass |
| `src/server/payload/services/exercise-conversion-service.ts` | MODIFY | Include diagram prompt in queue |
| `src/infra/llm/prompts/diagram-generator.ts` | NEW | Default prompt |
| `tests/int/diagram-pass.int.spec.ts` | NEW | Unit tests |
| `tests/int/diagram-pass-integration.int.spec.ts` | NEW | Integration tests |

---

## Rollout Plan

### Step 1: Feature Flag (Optional)

If desired, add to SystemParams:
```typescript
pdf_conversion_diagram_pass_enabled: boolean (default: false)
```

### Step 2: Seed Diagram Prompt

Create initial `diagram_generator` prompt in Prompts collection for test tenant.

### Step 3: Test on Single Tenant

Run conversion on test PDF with diagrams, verify:
- Diagrams detected correctly
- TikZ generated and inserted
- Metrics recorded in job output
- Failures don't break pipeline

### Step 4: Enable for All

Remove feature flag or enable for all tenants.

---

## Metrics & Observability

### Job Output Metrics

```json
{
  "diagramsDetected": 5,
  "diagramPassAttempted": 5,
  "diagramPassSucceeded": 4,
  "diagramPassFailed": 1,
  "diagramPassSkipped": 0,
  "diagramPassLatencyMsTotal": 3250
}
```

### Per-Segment Debug

```json
{
  "segments": [{
    "debug": {
      "diagramPass": {
        "detected": 2,
        "attempted": 2,
        "succeeded": 2,
        "failed": 0,
        "latencyMs": 1500
      }
    }
  }]
}
```

### Log Messages

```
[DiagramPass] Segment 1-2: Found 2 diagram(s)
[DiagramPass] Generated TikZ for "Geometry Problem" (confidence: medium)
[DiagramPass] Failed to generate TikZ for "Physics Diagram"
[DiagramPass] Segment complete: 1/2 succeeded in 1250ms
```

---

## Definition of Done

- [ ] Exercises without diagrams remain unchanged
- [ ] Exercises with "Diagram:" blocks get TikZ latex block inserted after
- [ ] Diagram Pass failures don't fail the job
- [ ] Metrics visible in job output
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Works with existing extractor prompts (no breaking changes)
- [ ] Documentation updated
- [ ] `req` parameter passed through all operations (transaction safety)

---

## V1.1 Deferred Items

The following items are intentionally deferred to V1.1 for simplicity:

### 1. Parallel LLM Batching

**Current**: Sequential processing per diagram
**Deferred**: Parallel `Promise.all()` for diagrams within same exercise

**Rationale**:
- Sequential is simpler to debug
- LLM rate limits could cause parallel failures
- Insertion offset tracking is complex with parallel mutations
- Can optimize later if latency is a problem

### 2. Confidence Threshold Gating

**Current**: Always insert TikZ regardless of confidence
**Deferred**: Optional `pdf_conversion_diagram_min_confidence` SystemParam

**Future implementation**:
```typescript
// In system-params.ts (V1.1)
pdf_conversion_diagram_min_confidence: 'low' | 'medium' | 'high' | null  // null = always insert

// In diagram-pass.ts (V1.1)
if (minConfidence && confidenceLevel < minConfidence) {
  metrics.skippedLowConfidence++
  continue  // Don't insert
}
```

**Rationale**: Ship V1 with always-insert, gather confidence distribution data, then tune threshold based on real usage.
