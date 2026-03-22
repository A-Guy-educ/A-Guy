/**
 * @fileType schema
 * @domain qa
 * @pattern fixture-schema
 * @ai-summary Zod schemas for test fixtures
 */
import { z } from 'zod'

/**
 * Entity reference in a fixture
 */
export const FixtureEntitySchema = z.object({
  type: z.string().min(1).describe('Entity type (e.g., user, course, lesson)'),
  ref: z.string().min(1).describe('Reference name (e.g., $student, $course)'),
  data: z.record(z.string(), z.unknown()).describe('Entity data'),
})
export type FixtureEntity = z.infer<typeof FixtureEntitySchema>

/**
 * A test fixture - data for scenarios
 */
export const FixtureSchema = z.object({
  id: z.string().min(1).describe('Unique identifier'),
  name: z.string().min(1).describe('Human-readable name'),
  description: z.string().optional().describe('Description of this fixture'),
  entities: z.array(FixtureEntitySchema).describe('Entities to seed'),
  setup: z
    .object({
      steps: z.array(z.string()).optional().describe('Setup steps'),
      cleanup: z.array(z.string()).optional().describe('Cleanup steps'),
    })
    .optional(),
})
export type Fixture = z.infer<typeof FixtureSchema>

/**
 * Collection of fixtures
 */
export const FixtureCollectionSchema = z.object({
  version: z.string().default('1.0'),
  fixtures: z.array(FixtureSchema),
})
export type FixtureCollection = z.infer<typeof FixtureCollectionSchema>

/**
 * Validate a fixture
 */
export function validateFixture(data: unknown) {
  return FixtureSchema.safeParse(data)
}
