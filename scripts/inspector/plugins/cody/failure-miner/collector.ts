/**
 * @fileType utility
 * @domain inspector
 * @pattern failure-miner-collector
 * @ai-summary Scans all task status.json files and extracts failed task records
 */

import * as fs from 'fs'
import * as path from 'path'

export interface FailedTaskRecord {
  taskId: string
  failedStage: string
  error: string
  /** ISO date when the failure was recorded */
  failedAt: string
  /** v1 or v2 format */
  statusVersion: 1 | 2
}

interface StageEntry {
  state?: string
  error?: string
  completedAt?: string
  startedAt?: string
}

interface StatusJson {
  version?: number
  taskId?: string
  state?: string
  /** v2 */
  cursor?: string
  /** v1 */
  currentStage?: string
  updatedAt?: string
  stages?: Record<string, StageEntry>
}

/**
 * Scan a status.json file and return a FailedTaskRecord if the task failed.
 * Returns null for non-failed tasks or unparseable files.
 */
export function extractFailure(statusJson: StatusJson): FailedTaskRecord | null {
  if (!statusJson || statusJson.state !== 'failed') return null

  const taskId = statusJson.taskId ?? 'unknown'
  const version = typeof statusJson.version === 'number' ? statusJson.version : 1

  // Determine the failed stage
  let failedStage = 'unknown'
  let error = ''
  let failedAt = statusJson.updatedAt ?? new Date().toISOString()

  const stages = statusJson.stages ?? {}

  // Find the stage with state === 'failed'
  for (const [stageName, stageData] of Object.entries(stages)) {
    if (stageData.state === 'failed') {
      failedStage = stageName
      error = stageData.error ?? ''
      failedAt = stageData.completedAt ?? stageData.startedAt ?? failedAt
      break
    }
  }

  // Fallback: use cursor/currentStage if no explicit failed stage found
  if (failedStage === 'unknown') {
    failedStage =
      version === 1 ? (statusJson.currentStage ?? 'unknown') : (statusJson.cursor ?? 'unknown')
  }

  return {
    taskId,
    failedStage,
    error,
    failedAt,
    statusVersion: version === 2 ? 2 : 1,
  }
}

/**
 * Collect all failed task records from `.tasks/` directory.
 * Skips `_archive` subdirectory.
 */
export function collectFailures(tasksDir: string, maxAgeDays: number = 30): FailedTaskRecord[] {
  if (!fs.existsSync(tasksDir)) return []

  const entries = fs.readdirSync(tasksDir, { withFileTypes: true })
  const records: FailedTaskRecord[] = []

  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (entry.name === '_archive') continue
    if (entry.name.startsWith('.')) continue

    const statusPath = path.join(tasksDir, entry.name, 'status.json')
    if (!fs.existsSync(statusPath)) continue

    let raw: string
    try {
      raw = fs.readFileSync(statusPath, 'utf-8')
    } catch {
      continue
    }

    let parsed: StatusJson
    try {
      parsed = JSON.parse(raw) as StatusJson
    } catch {
      continue
    }

    const record = extractFailure(parsed)
    if (!record) continue

    // Filter by age
    const failedTime = new Date(record.failedAt).getTime()
    if (!isNaN(failedTime) && failedTime < cutoff) continue

    records.push(record)
  }

  return records
}
