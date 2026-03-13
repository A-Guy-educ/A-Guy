/**
 * @fileType plugin
 * @domain inspector
 * @pattern zombie-reaper-plugin
 * @ai-summary Cleans up tasks stuck in 'running' state with no active CI workflow
 *
 * Tasks accumulate as zombies when the CI workflow ends (crash, cancel, timeout)
 * but status.json is never updated because the process died. The health-check
 * plugin catches in-flight stalls but can't see across ephemeral CI runs.
 *
 * This plugin scans all .tasks/ directories, finds tasks stale >2h, cross-checks
 * against active GitHub workflow runs, and marks confirmed zombies as failed.
 */

import * as fs from 'fs'
import * as path from 'path'

import type { InspectorPlugin, ActionRequest, InspectorContext } from '../../../core/types'

/** Tasks stale longer than this threshold are candidates for zombie detection. */
const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000 // 2 hours

/** Dedup window: run once per day. */
const DEDUP_WINDOW_MINUTES = 23 * 60

const CODY_WORKFLOW = 'cody.yml'

interface RawStatus {
  state?: string
  updatedAt?: string
  issueNumber?: number
  cursor?: string
  // v1 compat
  currentStage?: string
}

/**
 * Parse a raw status.json (handles both v1 and v2 formats).
 */
function parseRawStatus(raw: unknown): RawStatus {
  if (!raw || typeof raw !== 'object') return {}
  const r = raw as Record<string, unknown>
  return {
    state: typeof r.state === 'string' ? r.state : undefined,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : undefined,
    issueNumber: typeof r.issueNumber === 'number' ? r.issueNumber : undefined,
    cursor:
      typeof r.cursor === 'string'
        ? r.cursor
        : typeof r.currentStage === 'string'
          ? r.currentStage
          : undefined,
  }
}

interface ZombieCandidate {
  taskId: string
  taskDir: string
  statusPath: string
  staleness: number // ms
  issueNumber: number
  raw: unknown
}

/**
 * Scan .tasks/ for candidate zombies: state=running, stale >2h, valid issueNumber.
 */
function findCandidates(tasksDir: string, now: number): ZombieCandidate[] {
  if (!fs.existsSync(tasksDir)) return []

  const candidates: ZombieCandidate[] = []
  const entries = fs.readdirSync(tasksDir, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (entry.name === '_archive') continue

    const taskId = entry.name
    const taskDir = path.join(tasksDir, taskId)
    const statusPath = path.join(taskDir, 'status.json')

    if (!fs.existsSync(statusPath)) continue

    let raw: unknown
    try {
      raw = JSON.parse(fs.readFileSync(statusPath, 'utf-8'))
    } catch {
      continue
    }

    const status = parseRawStatus(raw)

    if (status.state !== 'running') continue

    const updatedAt = status.updatedAt ? new Date(status.updatedAt).getTime() : NaN
    if (isNaN(updatedAt)) continue

    const staleness = now - updatedAt
    if (staleness < STALE_THRESHOLD_MS) continue

    // Need a valid issue number to post the notification
    const issueNumber = status.issueNumber ?? 0
    if (issueNumber <= 0) {
      // Still mark as zombie via status.json update, just skip the GitHub notification
    }

    candidates.push({ taskId, taskDir, statusPath, staleness, issueNumber, raw })
  }

  return candidates
}

/**
 * Format staleness duration as human-readable string.
 */
function formatStaleness(ms: number): string {
  const hours = Math.round(ms / (60 * 60 * 1000))
  if (hours < 48) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}

/**
 * Create the zombie reaper action for a batch of confirmed zombies.
 */
function createReaperAction(zombies: ZombieCandidate[]): ActionRequest {
  return {
    plugin: 'zombie-reaper',
    type: 'reap-zombies',
    urgency: zombies.length > 5 ? 'warning' : 'info',
    title: `Reaping ${zombies.length} zombie task(s)`,
    detail: zombies.map((z) => `${z.taskId} (stale ${formatStaleness(z.staleness)})`).join(', '),
    dedupKey: 'zombie-reaper:daily',
    dedupWindowMinutes: DEDUP_WINDOW_MINUTES,
    async execute(execCtx: InspectorContext): Promise<{ success: boolean; message?: string }> {
      let reaped = 0
      let errors = 0

      for (const zombie of zombies) {
        try {
          // 1. Update status.json: mark as failed
          let raw: Record<string, unknown>
          try {
            raw = JSON.parse(fs.readFileSync(zombie.statusPath, 'utf-8')) as Record<string, unknown>
          } catch {
            continue
          }

          raw.state = 'failed'
          raw.updatedAt = new Date().toISOString()
          if (!raw.completedAt) raw.completedAt = new Date().toISOString()

          // Atomic write
          const tmpPath = zombie.statusPath + '.tmp'
          fs.writeFileSync(tmpPath, JSON.stringify(raw, null, 2), 'utf-8')
          fs.renameSync(tmpPath, zombie.statusPath)

          // 2. GitHub notifications (only when issueNumber is valid)
          if (zombie.issueNumber > 0) {
            const staleStr = formatStaleness(zombie.staleness)
            execCtx.github.postComment(
              zombie.issueNumber,
              `## 🧟 Pipeline Orphaned\n\nThis task has been stuck in \`running\` state for **${staleStr}** with no active workflow.\n\nThe pipeline was likely killed mid-run (timeout, cancellation, or runner crash).\n\n**To restart**: comment \`/cody rerun\` on this issue.\n\n_Detected by Inspector zombie-reaper_`,
            )
            execCtx.github.setLifecycleLabel(zombie.issueNumber, 'cody:failed')
          }

          reaped++
          execCtx.log.info(
            { taskId: zombie.taskId, staleness: formatStaleness(zombie.staleness) },
            'Reaped zombie task',
          )
        } catch (err) {
          errors++
          execCtx.log.error({ taskId: zombie.taskId, err: String(err) }, 'Failed to reap zombie')
        }
      }

      // Slack summary
      if (execCtx.slack?.isConfigured()) {
        await execCtx.slack.postMessage(
          `🧟 Zombie Reaper: reaped ${reaped} orphaned task(s)${errors > 0 ? `, ${errors} errors` : ''}`,
        )
      }

      // Watchdog issue summary
      if (execCtx.watchdogIssue && reaped > 0) {
        const lines = zombies
          .map(
            (z) =>
              `| \`${z.taskId}\` | ${formatStaleness(z.staleness)} | ${z.issueNumber > 0 ? `#${z.issueNumber}` : 'n/a'} |`,
          )
          .join('\n')
        execCtx.github.postComment(
          execCtx.watchdogIssue,
          `## 🧟 Zombie Reaper Report\n\nReaped **${reaped}** orphaned task(s).\n\n| Task | Stale For | Issue |\n|------|-----------|-------|\n${lines}\n\n_Cycle ${execCtx.cycleNumber}_`,
        )
      }

      execCtx.log.info({ reaped, errors }, 'Zombie reaper complete')
      return { success: true, message: `Reaped ${reaped} zombie(s), ${errors} error(s)` }
    },
  }
}

/**
 * Zombie Task Reaper plugin.
 *
 * Runs ~daily (every 6th cycle + 23h dedup).
 * Scans .tasks/ for orphaned running tasks and marks them failed.
 */
export const zombieReaperPlugin: InspectorPlugin = {
  name: 'zombie-reaper',
  description: 'Clean up tasks stuck in running state with no active CI workflow',
  domain: 'cody',
  schedule: { every: 6 },

  async run(ctx): Promise<ActionRequest[]> {
    ctx.log.debug('Running zombie-reaper plugin')

    const tasksDir = path.join(process.cwd(), '.tasks')
    const now = Date.now()

    // Find all stale running candidates
    const candidates = findCandidates(tasksDir, now)

    if (candidates.length === 0) {
      ctx.log.debug('No zombie candidates found')
      return []
    }

    ctx.log.info(
      { candidateCount: candidates.length },
      'Found zombie candidates, checking workflows',
    )

    // Cross-check: filter out tasks that have an active workflow run
    const zombies: ZombieCandidate[] = []

    for (const candidate of candidates) {
      // Check for active workflow run on the task's feature branch
      const branch = `feat/${candidate.taskId}`
      const runs = ctx.github.listWorkflowRuns(CODY_WORKFLOW, {
        branch,
        per_page: 5,
        status: 'in_progress',
      })

      // Also check queued separately since GitHub API status is exact match
      const queuedRuns = ctx.github.listWorkflowRuns(CODY_WORKFLOW, {
        branch,
        per_page: 5,
        status: 'queued',
      })

      const hasActiveRun =
        runs.some((r) => r.status === 'in_progress') ||
        queuedRuns.some((r) => r.status === 'queued')

      if (hasActiveRun) {
        ctx.log.debug({ taskId: candidate.taskId }, 'Skipping — active workflow run found')
        continue
      }

      zombies.push(candidate)
      ctx.log.info(
        { taskId: candidate.taskId, staleness: formatStaleness(candidate.staleness) },
        'Confirmed zombie',
      )
    }

    if (zombies.length === 0) {
      ctx.log.debug('All candidates have active workflow runs — no zombies')
      return []
    }

    return [createReaperAction(zombies)]
  },
}
