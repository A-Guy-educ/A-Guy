/**
 * @fileType schema
 * @domain qa
 * @pattern site-behavior-schema
 * @ai-summary Zod schemas for site behavior specifications
 */
import { z } from 'zod'

// Re-export base schemas from main schema
export {
  LoadingBehaviorSchema,
  ErrorBehaviorSchema,
  AuthBehaviorSchema,
  BehaviorSchema,
  type LoadingBehavior,
  type ErrorBehavior,
  type AuthBehavior,
  type Behavior,
} from '../schema'

/**
 * Animation behavior specification
 */
export const AnimationBehaviorSchema = z.object({
  id: z.string().min(1),
  feature: z.string().min(1),
  type: z.literal('animation'),
  animationType: z.enum(['fade', 'slide', 'scale', 'none']),
  duration: z.number().describe('Duration in ms'),
  easing: z.string().optional(),
  trigger: z.enum(['immediate', 'delayed', 'interaction']).optional(),
})
export type AnimationBehavior = z.infer<typeof AnimationBehaviorSchema>

/**
 * Responsive behavior specification
 */
export const ResponsiveBehaviorSchema = z.object({
  id: z.string().min(1),
  feature: z.string().min(1),
  type: z.literal('responsive'),
  breakpoints: z.record(z.string(), z.string()),
  hideOnMobile: z.array(z.string()).optional(),
  showOnMobile: z.array(z.string()).optional(),
})
export type ResponsiveBehavior = z.infer<typeof ResponsiveBehaviorSchema>

/**
 * Form behavior specification
 */
export const FormBehaviorSchema = z.object({
  id: z.string().min(1),
  feature: z.string().min(1),
  type: z.literal('form'),
  validation: z.enum(['onblur', 'onsubmit', 'realtime']),
  errorDisplay: z.enum(['toast', 'inline', 'modal', 'none']),
  submitButton: z.string().optional(),
  successMessage: z.string().optional(),
  preserveOnError: z.boolean().default(true),
})
export type FormBehavior = z.infer<typeof FormBehaviorSchema>

/**
 * Extended behavior schema with all types
 */
export const SiteBehaviorSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string().min(1),
    feature: z.string().min(1),
    type: z.literal('loading'),
    loadingType: z.enum(['skeleton', 'spinner', 'progress']),
    duration: z.number().optional(),
    transition: z
      .object({
        type: z.enum(['fade', 'slide', 'instant']),
        duration: z.number(),
      })
      .optional(),
  }),
  z.object({
    id: z.string().min(1),
    feature: z.string().min(1),
    type: z.literal('error'),
    errorType: z.enum(['network', 'auth', 'validation', 'server', 'unknown']),
    display: z.enum(['toast', 'modal', 'inline', 'banner']),
    recoverable: z.boolean(),
    retryable: z.boolean(),
    userInputPreserved: z.boolean(),
    message: z.string().optional(),
  }),
  z.object({
    id: z.string().min(1),
    feature: z.string().min(1),
    type: z.literal('auth'),
    flow: z.enum(['login', 'logout', 'session-timeout', 'guest-upgrade']),
    redirectTo: z.string().optional(),
    preserveState: z.boolean().optional(),
  }),
  z.object({
    id: z.string().min(1),
    feature: z.string().min(1),
    type: z.literal('animation'),
    animationType: z.enum(['fade', 'slide', 'scale', 'none']),
    duration: z.number(),
    easing: z.string().optional(),
    trigger: z.enum(['immediate', 'delayed', 'interaction']).optional(),
  }),
  z.object({
    id: z.string().min(1),
    feature: z.string().min(1),
    type: z.literal('responsive'),
    breakpoints: z.record(z.string(), z.string()),
    hideOnMobile: z.array(z.string()).optional(),
    showOnMobile: z.array(z.string()).optional(),
  }),
  z.object({
    id: z.string().min(1),
    feature: z.string().min(1),
    type: z.literal('form'),
    validation: z.enum(['onblur', 'onsubmit', 'realtime']),
    errorDisplay: z.enum(['toast', 'inline', 'modal', 'none']),
    submitButton: z.string().optional(),
    successMessage: z.string().optional(),
    preserveOnError: z.boolean().default(true),
  }),
])
export type SiteBehavior = z.infer<typeof SiteBehaviorSchema>
