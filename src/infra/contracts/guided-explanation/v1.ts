/**
 * Guided Explanation v1 — schema for AI-generated step-through explanations.
 *
 * This is the contract between our Gemini-powered explainer pipeline and the
 * trusted React renderer (`GuidedExplanationRunner`). Gemini returns **data**
 * in this shape; it never ships executable code. The renderer owns all
 * animation, timing, and speech-synthesis logic, so there is no author-
 * supplied JavaScript to audit.
 *
 * Security properties:
 * - `scene.svg` is sanitized via the existing SVG sanitizer (strips <script>,
 *   event handlers, foreignObject, external refs).
 * - All textual fields are rendered via `textContent`, not `innerHTML`, so
 *   there is no HTML-injection surface in narration or proof-table rows.
 * - Every element `id` referenced by actions is resolved via a **scoped**
 *   querySelector (component root ref), never via `document.*`. A malformed
 *   or adversarial payload cannot reach out of the component's DOM subtree.
 * - `Action.op` is a closed discriminated union. New operations require a
 *   code change + review — Gemini cannot invent new ones.
 */
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Atomic action primitives
// ---------------------------------------------------------------------------

const ShowActionSchema = z
  .object({
    op: z.literal('show'),
    id: z.string().min(1),
  })
  .strict()

const HideActionSchema = z
  .object({
    op: z.literal('hide'),
    id: z.string().min(1),
  })
  .strict()

const DrawActionSchema = z
  .object({
    op: z.literal('draw'),
    id: z.string().min(1),
  })
  .strict()

const UndrawActionSchema = z
  .object({
    op: z.literal('undraw'),
    id: z.string().min(1),
  })
  .strict()

const HighlightRowActionSchema = z
  .object({
    op: z.literal('highlightRow'),
    rowId: z.string().min(1),
    /** Duration the highlight stays before fading. Default 2000ms. */
    durationMs: z.number().int().positive().max(10_000).optional(),
  })
  .strict()

const SetTextActionSchema = z
  .object({
    op: z.literal('setText'),
    id: z.string().min(1),
    /** Rendered via textContent — no HTML interpretation. */
    text: z.string(),
  })
  .strict()

const WaitActionSchema = z
  .object({
    op: z.literal('wait'),
    ms: z.number().int().nonnegative().max(30_000),
  })
  .strict()

export const ActionSchema = z.discriminatedUnion('op', [
  ShowActionSchema,
  HideActionSchema,
  DrawActionSchema,
  UndrawActionSchema,
  HighlightRowActionSchema,
  SetTextActionSchema,
  WaitActionSchema,
])

export type GuidedExplanationAction = z.infer<typeof ActionSchema>

// ---------------------------------------------------------------------------
// Narration + step
// ---------------------------------------------------------------------------

const NarrationSchema = z
  .object({
    /**
     * Text displayed in the narration box. Niqqud (Hebrew vowel marks) is
     * stripped automatically by the renderer before display.
     */
    display: z.string().min(1),
    /**
     * Optional text sent to speechSynthesis. If omitted, `display` is spoken
     * verbatim. Useful when the TTS engine mispronounces abbreviations or
     * benefits from explicit niqqud.
     */
    speech: z.string().optional(),
    /**
     * Pre-generated MP3 (base64) baked in by the server at lesson generation
     * so subsequent plays don't re-call Google TTS. When present, the client
     * skips the cloud round-trip entirely.
     */
    audioBase64: z.string().optional(),
  })
  .strict()

export const StepSchema = z
  .object({
    id: z.string().min(1),
    /**
     * Short human-readable label for the step (e.g. "Apply SAS"). Surfaced to
     * the chat panel alongside the step index so the tutor AI knows which
     * step the student is asking about. Not rendered inside the scene.
     */
    title: z.string().optional(),
    narrate: NarrationSchema.optional(),
    actions: z.array(ActionSchema).default([]),
    /** Extra delay (ms) after actions + narration complete. Default 0. */
    wait: z.number().int().nonnegative().max(30_000).optional(),
  })
  .strict()

export type GuidedExplanationStep = z.infer<typeof StepSchema>

// ---------------------------------------------------------------------------
// Scene + proof table + chrome
// ---------------------------------------------------------------------------

const SceneSchema = z
  .object({
    /**
     * Raw SVG markup. Passed through the shared SVG sanitizer at render
     * time (strips <script>, event handlers, foreignObject, external refs).
     */
    svg: z.string().min(1),
    /** SVG viewBox attribute, e.g. "0 0 450 300". */
    viewBox: z.string().min(1),
    /** CSS aspect-ratio string, e.g. "16/9". Default "16/9". */
    aspectRatio: z.string().optional(),
  })
  .strict()

const ProofTableRowSchema = z
  .object({
    id: z.string().min(1),
    /** Plain text — rendered via textContent. */
    claim: z.string(),
    /** Plain text — rendered via textContent. */
    reason: z.string(),
    /** Optional visual emphasis hint (e.g. "primary" for the conclusion). */
    emphasis: z.enum(['none', 'primary', 'danger']).optional(),
  })
  .strict()

const ProofTableSchema = z
  .object({
    columns: z.tuple([z.string(), z.string(), z.string()]),
    rows: z.array(ProofTableRowSchema).min(1),
  })
  .strict()

const ControlsSchema = z
  .object({
    playLabel: z.string().min(1),
    resetLabel: z.string().min(1),
    pauseLabel: z.string().min(1).optional(),
    resumeLabel: z.string().min(1).optional(),
  })
  .strict()

const NarrationBoxSchema = z
  .object({
    placeholder: z.string().min(1),
  })
  .strict()

// ---------------------------------------------------------------------------
// Root payload
// ---------------------------------------------------------------------------

export const GuidedExplanationV1Schema = z
  .object({
    version: z.literal('guided-explanation/v1'),
    title: z.string().min(1),
    subtitle: z.string().optional(),
    direction: z.enum(['ltr', 'rtl']),
    locale: z.enum(['he', 'en']),
    scene: SceneSchema,
    proofTable: ProofTableSchema.optional(),
    narrationBox: NarrationBoxSchema,
    controls: ControlsSchema,
    steps: z.array(StepSchema).min(1),
  })
  .strict()

export type GuidedExplanationV1 = z.infer<typeof GuidedExplanationV1Schema>
