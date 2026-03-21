/**
 * @fileType schema
 * @domain qa
 * @pattern scenario-schemas
 * @ai-summary Core Zod schemas for scenario-first development system
 */
import { z } from 'zod'

// ============================================================
// STEP SCHEMAS
// ============================================================

export const StepTypeSchema = z.enum(['given', 'when', 'then', 'and', 'but'])
export type StepType = z.infer<typeof StepTypeSchema>

/**
 * A single step in a scenario
 * @example { "type": "when", "action": "click", "target": "submit-button", "component": "Button" }
 */
export const StepSchema = z.object({
  type: StepTypeSchema,
  action: z.string().min(1),
  target: z.string().describe('Selector or element reference from prototype'),
  component: z.string().optional().describe('Design System component (filled by architect)'),
  input: z.record(z.string(), z.unknown()).optional().describe('Action-specific input data'),
  description: z.string().optional().describe('Human-readable description'),
})
export type Step = z.infer<typeof StepSchema>

// ============================================================
// SCENARIO SCHEMAS
// ============================================================

export const ScenarioCategorySchema = z.enum(['core', 'feature', 'edge'])
export type ScenarioCategory = z.infer<typeof ScenarioCategorySchema>

export const ScenarioStatusSchema = z.enum(['draft', 'planned', 'implemented', 'verified'])
export type ScenarioStatus = z.infer<typeof ScenarioStatusSchema>

/**
 * Precondition for setting up test state
 */
export const PreconditionSchema = z.object({
  action: z.string().min(1),
  entity: z.string().min(1),
  data: z.record(z.string(), z.unknown()),
  ref: z.string().optional().describe('Reference name to use in subsequent steps'),
})
export type Precondition = z.infer<typeof PreconditionSchema>

/**
 * A scenario - executable specification for a feature
 */
export const ScenarioSchema = z.object({
  id: z.string().min(1).describe('Unique identifier'),
  name: z.string().min(1).describe('Human-readable name'),
  journey: z.string().optional().describe('Journey this scenario belongs to'),
  type: ScenarioCategorySchema,
  area: z.string().optional().describe('Feature area'),
  tags: z.array(z.string()).optional(),
  locale: z.enum(['he', 'en']).default('he'),
  preconditions: z.array(PreconditionSchema).optional(),
  steps: z.array(StepSchema).min(1),
  siteBehaviors: z.array(z.string()).optional().describe('References to site behavior specs'),
  status: ScenarioStatusSchema.optional().default('draft'),
  prototype: z.string().optional().describe('HTML prototype file name'),
  fixture: z.string().optional().describe('Fixture file name'),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})
export type Scenario = z.infer<typeof ScenarioSchema>

// ============================================================
// DESIGN SYSTEM SCHEMAS
// ============================================================

/**
 * A design system component
 */
export const DSComponentSchema = z.object({
  name: z.string().min(1).describe('Component name (PascalCase)'),
  path: z.string().min(1).describe('Import path'),
  variants: z.array(z.string()).optional().describe('Available variants'),
  sizes: z.array(z.string()).optional().describe('Available sizes'),
  props: z.record(z.string(), z.unknown()).optional().describe('Common props'),
  description: z.string().optional(),
})
export type DSComponent = z.infer<typeof DSComponentSchema>

/**
 * Mapping from prototype element to DS component
 */
export const ElementMappingSchema = z.object({
  prototypeSelector: z.string().describe('CSS selector from prototype'),
  dsComponent: z.string().describe('Design System component name'),
  variant: z.string().optional().describe('Variant to use'),
  props: z.record(z.string(), z.unknown()).optional().describe('Additional props'),
  reason: z.string().optional().describe('Why this mapping was chosen'),
})
export type ElementMapping = z.infer<typeof ElementMappingSchema>

// ============================================================
// PROTOTYPE SCHEMAS
// ============================================================

/**
 * Extracted element from HTML prototype
 */
export const PrototypeElementSchema = z.object({
  id: z.string().describe('Unique ID'),
  tag: z.string().describe('HTML tag name'),
  idAttr: z.string().optional().describe('id attribute'),
  classes: z.array(z.string()).optional().describe('class names'),
  text: z.string().optional().describe('Inner text content'),
  selector: z.string().describe('Generated CSS selector'),
  attributes: z.record(z.string(), z.string()).optional().describe('All attributes'),
  children: z.array(z.string()).optional().describe('Child element IDs'),
  parentId: z.string().optional().describe('Parent element ID'),
})
export type PrototypeElement = z.infer<typeof PrototypeElementSchema>

/**
 * Parsed prototype with extracted elements
 */
export const PrototypeSchema = z.object({
  name: z.string().min(1).describe('Prototype name'),
  filePath: z.string().min(1).describe('Path to HTML file'),
  elements: z.array(PrototypeElementSchema),
  rawHtml: z.string().optional().describe('Raw HTML content'),
  interactions: z
    .array(
      z.object({
        selector: z.string(),
        event: z.string(),
        handler: z.string().optional(),
      }),
    )
    .optional()
    .describe('Detected interactions (onclick, etc)'),
  styles: z
    .array(
      z.object({
        selector: z.string(),
        properties: z.record(z.string(), z.string()),
      }),
    )
    .optional()
    .describe('Inline or detected styles'),
})
export type Prototype = z.infer<typeof PrototypeSchema>

// ============================================================
// SITE BEHAVIOR SCHEMAS
// ============================================================

export const LoadingTypeSchema = z.enum(['skeleton', 'spinner', 'progress'])
export type LoadingType = z.infer<typeof LoadingTypeSchema>

export const ErrorTypeSchema = z.enum(['network', 'auth', 'validation', 'server', 'unknown'])
export type ErrorType = z.infer<typeof ErrorTypeSchema>

export const ErrorDisplaySchema = z.enum(['toast', 'modal', 'inline', 'banner'])
export type ErrorDisplay = z.infer<typeof ErrorDisplaySchema>

export const TransitionTypeSchema = z.enum(['fade', 'slide', 'instant'])
export type TransitionType = z.infer<typeof TransitionTypeSchema>

/**
 * Loading behavior specification
 */
export const LoadingBehaviorSchema = z.object({
  id: z.string().min(1),
  feature: z.string().min(1),
  type: z.literal('loading'),
  loadingType: LoadingTypeSchema,
  duration: z.number().optional().describe('Expected duration in ms'),
  transition: z
    .object({
      type: TransitionTypeSchema,
      duration: z.number(),
    })
    .optional(),
})
export type LoadingBehavior = z.infer<typeof LoadingBehaviorSchema>

/**
 * Error behavior specification
 */
export const ErrorBehaviorSchema = z.object({
  id: z.string().min(1),
  feature: z.string().min(1),
  type: z.literal('error'),
  errorType: ErrorTypeSchema,
  display: ErrorDisplaySchema,
  recoverable: z.boolean(),
  retryable: z.boolean(),
  userInputPreserved: z.boolean(),
  message: z.string().optional(),
})
export type ErrorBehavior = z.infer<typeof ErrorBehaviorSchema>

/**
 * Auth behavior specification
 */
export const AuthBehaviorSchema = z.object({
  id: z.string().min(1),
  feature: z.string().min(1),
  type: z.literal('auth'),
  flow: z.enum(['login', 'logout', 'session-timeout', 'guest-upgrade']),
  redirectTo: z.string().optional(),
  preserveState: z.boolean().optional(),
})
export type AuthBehavior = z.infer<typeof AuthBehaviorSchema>

/**
 * Union of all behavior types
 */
export const BehaviorSchema = z.discriminatedUnion('type', [
  LoadingBehaviorSchema,
  ErrorBehaviorSchema,
  AuthBehaviorSchema,
])
export type Behavior = z.infer<typeof BehaviorSchema>

// ============================================================
// FIXTURE SCHEMAS
// ============================================================

/**
 * Test fixture - data for scenarios
 */
export const FixtureSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  entities: z
    .array(
      z.object({
        type: z.string(),
        ref: z.string(),
        data: z.record(z.string(), z.unknown()),
      }),
    )
    .optional(),
})
export type Fixture = z.infer<typeof FixtureSchema>

// ============================================================
// PRD SCHEMAS
// ============================================================

/**
 * Prototype → DS Translation entry for PRD
 */
export const TranslationEntrySchema = z.object({
  prototypeElement: z.string().describe('Element from prototype'),
  dsComponent: z.string().describe('Design System component'),
  variant: z.string().optional(),
  reason: z.string().describe('Why this mapping was chosen'),
})
export type TranslationEntry = z.infer<typeof TranslationEntrySchema>

/**
 * Component usage entry for PRD
 */
export const ComponentUsageSchema = z.object({
  component: z.string(),
  path: z.string(),
  variant: z.string().optional(),
  notes: z.string().optional(),
})
export type ComponentUsage = z.infer<typeof ComponentUsageSchema>

/**
 * Generated PRD document
 */
export const PRDSchema = z.object({
  title: z.string(),
  overview: z.string().optional(),
  userStory: z.string().optional(),
  scenario: ScenarioSchema,
  prototype: z.string().optional(),
  translations: z.array(TranslationEntrySchema),
  components: z.array(ComponentUsageSchema),
  behaviors: z.array(z.string()).optional(),
  fixture: z.string().optional(),
  implementationNotes: z.string().optional(),
  createdAt: z.string(),
})
export type PRD = z.infer<typeof PRDSchema>

// ============================================================
// REGISTRY / COLLECTION SCHEMAS
// ============================================================

/**
 * Collection of scenarios
 */
export const ScenarioCollectionSchema = z.object({
  version: z.string().default('1.0'),
  scenarios: z.array(ScenarioSchema),
})

/**
 * Collection of behaviors
 */
export const BehaviorCollectionSchema = z.object({
  version: z.string().default('1.0'),
  behaviors: z.array(BehaviorSchema),
})

/**
 * Collection of fixtures
 */
export const FixtureCollectionSchema = z.object({
  version: z.string().default('1.0'),
  fixtures: z.array(FixtureSchema),
})

// ============================================================
// VALIDATION HELPERS
// ============================================================

/**
 * Validate a scenario and return errors or the validated scenario
 */
export function validateScenario(data: unknown) {
  return ScenarioSchema.safeParse(data)
}

/**
 * Validate a prototype and return errors or the validated prototype
 */
export function validatePrototype(data: unknown) {
  return PrototypeSchema.safeParse(data)
}

/**
 * Validate a behavior and return errors or the validated behavior
 */
export function validateBehavior(data: unknown) {
  return BehaviorSchema.safeParse(data)
}

/**
 * Validate a fixture and return errors or the validated fixture
 */
export function validateFixture(data: unknown) {
  return FixtureSchema.safeParse(data)
}
