import fs from 'fs'
import path from 'path'
import { AuditorOutputSchema, type AuditorOutput } from './auditor-output.schema'

const TASKS_DIR = '.tasks'

export function resolveRunDir(taskId: string, runId: string): string {
  const runDir = path.join(TASKS_DIR, taskId, 'runs', runId)
  fs.mkdirSync(runDir, { recursive: true })
  return runDir
}

export function writeAuditorOutput(taskId: string, runId: string, output: AuditorOutput): string {
  const parsed = AuditorOutputSchema.parse(output)

  const runDir = resolveRunDir(taskId, runId)
  const filePath = path.join(runDir, 'auditor.json')
  fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2), 'utf-8')
  return filePath
}

export function readAuditorOutput(taskId: string, runId: string): AuditorOutput | null {
  const filePath = path.join(TASKS_DIR, taskId, 'runs', runId, 'auditor.json')
  if (!fs.existsSync(filePath)) return null

  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    return AuditorOutputSchema.parse(raw)
  } catch {
    return null
  }
}

export function listRuns(taskId: string): string[] {
  const runsDir = path.join(TASKS_DIR, taskId, 'runs')
  if (!fs.existsSync(runsDir)) return []
  return fs
    .readdirSync(runsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
}

export function generateRunId(): string {
  const now = new Date()
  const ts = now.toISOString().replace(/[-:T]/g, '').slice(0, 14)
  return `run-${ts.slice(0, 8)}-${ts.slice(8, 14)}`
}
