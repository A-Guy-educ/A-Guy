/**
 * @fileType constants
 * @domain cody
 * @pattern constants
 * @ai-summary Constants for Cody dashboard pipeline and configuration
 */

// ============ Pipeline Stages ============

export const SPEC_STAGES = ['taskify', 'spec', 'clarify'] as const
export const IMPL_STAGES = [
  'architect',
  'plan-gap',
  'build',
  'commit',
  'review',
  'fix',
  'commit-fix',
  'verify',
  'pr',
] as const
export const AUTOFIX_STAGE = 'autofix' as const

export type SpecStage = (typeof SPEC_STAGES)[number]
export type ImplStage = (typeof IMPL_STAGES)[number]
export type AllStage = SpecStage | ImplStage | typeof AUTOFIX_STAGE

export const ALL_STAGES = [...SPEC_STAGES, ...IMPL_STAGES, AUTOFIX_STAGE] as const

// ============ Kanban Columns ============

export type ColumnId =
  | 'open'
  | 'building'
  | 'review'
  | 'failed'
  | 'gate-waiting'
  | 'retrying'
  | 'done'

export interface ColumnDef {
  id: ColumnId
  label: string
  color: string
  order: number
}

export const COLUMN_DEFS: Record<ColumnId, ColumnDef> = {
  open: { id: 'open', label: 'Open', color: 'gray', order: 0 },
  building: { id: 'building', label: 'Building', color: 'blue', order: 1 },
  review: { id: 'review', label: 'Review', color: 'purple', order: 2 },
  failed: { id: 'failed', label: 'Failed', color: 'red', order: 3 },
  'gate-waiting': { id: 'gate-waiting', label: 'Gate Waiting', color: 'yellow', order: 4 },
  retrying: { id: 'retrying', label: 'Retrying', color: 'orange', order: 5 },
  done: { id: 'done', label: 'Done', color: 'green', order: 6 },
}

// ============ Polling Intervals ============

export const POLLING_INTERVALS = {
  idle: 60_000, // 60s - no running tasks
  board: 30_000, // 30s - has running tasks
  active: 15_000, // 15s - selected task is running
  backlog: 120_000, // 120s - backlog view, tasks change rarely
} as const

// ============ Branch Prefixes ============

export const BRANCH_PREFIXES = ['feat', 'fix', 'refactor', 'docs', 'chore'] as const

// ============ GitHub Configuration ============

export const GITHUB_OWNER = process.env.GITHUB_OWNER ?? 'A-Guy-educ'
export const GITHUB_REPO = process.env.GITHUB_REPO ?? 'A-Guy'

/**
 * Generate a GitHub issue URL from an issue number
 */
export function getGitHubIssueUrl(issueNumber: number): string {
  return `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/issues/${issueNumber}`
}

/**
 * Generate a GitHub PR URL from a PR number
 */
export function getGitHubPrUrl(prNumber: number): string {
  return `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/pull/${prNumber}`
}

export const WORKFLOW_ID = 'cody.yml'

// ============ Task ID ============

export const TASK_ID_REGEX = /^[0-9]{6}-[a-zA-Z0-9-]+$/

// ============ Status Icons ============

export const STAGE_ICONS = {
  completed: '✅',
  failed: '❌',
  running: '🔄',
  pending: '⏳',
  skipped: '⚪',
  'gate-waiting': '🚫',
  paused: '⏸️',
  timeout: '⏰',
} as const

// ============ Cache TTL ============

export const BRANCH_CACHE_TTL = 600000 // 10min - branches rarely change

export const CACHE_TTL = {
  tasks: 120000, // 2min - reduced API calls while staying fresh
  pipeline: 60000, // 30s - increased from 5s to reduce calls
  boards: 900000, // 5min - labels/milestones rarely change
  prs: 300000, // 2min - increased from 30s
} as const

// ============ Emoji List ============

export const EMOJI_LIST = [
  '😀',
  '😃',
  '😄',
  '😁',
  '😆',
  '😅',
  '🤣',
  '😂',
  '🙂',
  '🙃',
  '😉',
  '😊',
  '😇',
  '🥰',
  '😍',
  '🤩',
  '😘',
  '😗',
  '😚',
  '😙',
  '🥲',
  '😋',
  '😛',
  '😜',
  '🤪',
  '😝',
  '🤑',
  '🤗',
  '🤭',
  '🤫',
  '🤔',
  '🤐',
  '🤨',
  '😐',
  '😑',
  '😶',
  '😏',
  '😒',
  '🙄',
  '😬',
  '😮‍💨',
  '🤥',
  '😌',
  '😔',
  '😪',
  '🤤',
  '😴',
  '😷',
  '👍',
  '👎',
  '👌',
  '✌️',
  '🤞',
  '🤟',
  '🤘',
  '🤙',
  '👈',
  '👉',
  '👆',
  '👇',
  '☝️',
  '👋',
  '🤚',
  '🖐️',
  '✋',
  '🖖',
  '👏',
  '🙌',
  '🤲',
  '🤝',
  '🙏',
  '✍️',
  '❤️',
  '🧡',
  '💛',
  '💚',
  '💙',
  '💜',
  '🖤',
  '🤍',
  '💔',
  '❣️',
  '💕',
  '💞',
  '💓',
  '💗',
  '💖',
  '💘',
  '🚀',
  '⭐',
  '🌟',
  '✨',
  '💫',
  '🔥',
  '💥',
  '💯',
  '✅',
  '❌',
  '⚠️',
  '❓',
  '❗',
  '💡',
  '🔔',
  '🎉',
] as const

// ============ Risk Level Colors ============

export const RISK_COLORS = {
  low: 'green',
  medium: 'yellow',
  high: 'red',
} as const

// ============ Task Type Prefixes ============

export const TASK_TYPE_PREFIX: Record<string, string> = {
  implement_feature: 'feat',
  fix_bug: 'fix',
  refactor: 'refactor',
  docs: 'docs',
  ops: 'chore',
  research: 'chore',
  spec_only: 'feat',
}

// ============ Site URLs ============

export const SITE_URLS = {
  dev: process.env.NEXT_PUBLIC_DEV_SITE_URL ?? 'https://dev.aguy.co.il',
  prod: process.env.NEXT_PUBLIC_PROD_SITE_URL ?? 'https://aguy.co.il',
}

// ============ Branch Names ============

export const DEV_BRANCH = 'dev'
export const PROD_BRANCH = 'main'
