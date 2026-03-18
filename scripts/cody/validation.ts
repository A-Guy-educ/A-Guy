/**
 * @fileType utility
 * @domain cody | validation
 * @pattern shared-validation
 * @ai-summary Shared validation constants and type guards — leaf dependency with no cody imports
 */

import { STAGE_NAMES } from './stages/registry'

export const VALID_MODES = ['spec', 'impl', 'rerun', 'fix', 'full', 'status'] as const

export const VALID_STAGES = [...STAGE_NAMES, 'autofix' as const]

export function isValidMode(mode: string): mode is (typeof VALID_MODES)[number] {
  return (VALID_MODES as readonly string[]).includes(mode)
}

export function isValidStage(stage: string): stage is (typeof VALID_STAGES)[number] {
  return (VALID_STAGES as readonly string[]).includes(stage)
}

export function validateTaskId(taskId: string): boolean {
  return /^\d{6}[a-z0-9-]+$/.test(taskId)
}
