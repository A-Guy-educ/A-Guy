// eslint-disable @typescript-eslint/no-unused-vars
/**
 * Action handler types and interfaces
 * @fileType types
 * @domain qa
 * @pattern action-types
 */
import type { Page } from '@playwright/test'

export type Locale = 'he' | 'en'

export interface ActionContext {
  page: Page
  locale: Locale
  refs: Record<string, ActionRef>
}

export interface ActionRef {
  id: string
  slug?: string
  _collection: string
  [key: string]: unknown
}

export type ActionHandler = (ctx: ActionContext, input?: Record<string, unknown>) => Promise<void>

export type ActionRegistry = Record<string, ActionHandler>

// User answer types for exercise interactions
export type UserAnswer =
  | { type: 'mcq'; selectedIds: string[] }
  | { type: 'true_false'; value: boolean }
  | { type: 'free_response'; value: string }
  | { type: 'matching'; connections: Array<{ leftId: string; rightId: string }> }
