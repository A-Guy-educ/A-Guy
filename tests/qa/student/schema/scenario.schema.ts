/**
 * Zod schema for scenario validation
 * @fileType schema
 * @domain qa
 * @pattern scenario-validation
 */
import { z } from 'zod'

export const StepInputSchema: z.ZodType<Record<string, unknown>> = z.record(z.string(), z.unknown())

export const StepSchema = z.object({
  action: z.string().min(1),
  input: StepInputSchema.optional(),
  description: z.string().optional(),
})

export const PreconditionSchema = z.object({
  action: z.literal('seed'),
  entity: z.enum(['user', 'course', 'chapter', 'lesson', 'exercise', 'conversation']),
  data: z.record(z.string(), z.unknown()),
  ref: z.string().min(1),
})

export const ScenarioSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  journey: z.string().min(1),
  type: z.enum(['core', 'feature', 'edge']),
  area: z.enum([
    'auth',
    'onboarding',
    'navigation',
    'lessons',
    'exercises',
    'chat',
    'account',
    'study-plan',
    'access-control',
  ]),
  tags: z.array(z.string()).optional(),
  locale: z.enum(['he', 'en']).default('he'),
  preconditions: z.array(PreconditionSchema).optional(),
  steps: z.array(StepSchema).min(1),
  teardown: z.enum(['auto', 'manual']).default('auto'),
})

export type Scenario = z.infer<typeof ScenarioSchema>
export type Step = z.infer<typeof StepSchema>
export type Precondition = z.infer<typeof PreconditionSchema>
