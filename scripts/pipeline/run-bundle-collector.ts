import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { type RunBundle } from './run-bundle.schema'
import { generateRunId } from './auditor-persistence'

const TASKS_DIR = '.tasks'

interface CollectOptions {
  taskId: string
  finalState: 'SUCCESS' | 'FAILURE' | 'ABORTED'
  agentTimeline: Array<{
    agent: string
    startedAt: string
    completedAt?: string
    state: 'completed' | 'failed' | 'skipped'
    summary: string
    filesModified?: string[]
  }>
}

export function collectRunBundle(opts: CollectOptions): {
  bundle: RunBundle
  runId: string
  bundlePath: string
} {
  const runId = generateRunId()
  const taskDir = path.join(TASKS_DIR, opts.taskId)

  const specPath = path.join(taskDir, 'spec.md')
  const taskTitle = extractTitle(specPath)

  let diffSummary = ''
  let filesChanged: string[] = []
  try {
    diffSummary = execSync('git diff --stat HEAD~5..HEAD', {
      encoding: 'utf-8',
    }).trim()
    filesChanged = execSync('git diff --name-only HEAD~5..HEAD', {
      encoding: 'utf-8',
    })
      .trim()
      .split('\n')
      .filter(Boolean)
  } catch {
    diffSummary = '(git diff unavailable)'
  }

  const verifyReport = findLatestVerifyReport(taskDir)

  const bundle: RunBundle = {
    runId,
    taskId: opts.taskId,
    taskTitle,
    taskSpecPath: specPath,
    orchestratorTimeline: opts.agentTimeline.map((a) => ({
      agent: a.agent,
      startedAt: a.startedAt,
      completedAt: a.completedAt,
      state: a.state,
    })),
    agentOutputs: opts.agentTimeline.map((a) => ({
      agentName: a.agent,
      state: a.state,
      summary: a.summary,
      filesModified: a.filesModified,
    })),
    finalState: opts.finalState,
    primaryArtifacts: {
      diffSummary,
      filesChanged,
      docsChanged: filesChanged.filter((f) => f.endsWith('.md') || f.includes('docs/')),
    },
    ciOutput: verifyReport || undefined,
  }

  const runDir = path.join(taskDir, 'runs', runId)
  fs.mkdirSync(runDir, { recursive: true })
  const bundlePath = path.join(runDir, 'bundle.json')
  fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2), 'utf-8')

  return { bundle, runId, bundlePath }
}

function extractTitle(specPath: string): string {
  if (!fs.existsSync(specPath)) return '(untitled)'
  const content = fs.readFileSync(specPath, 'utf-8')
  const match = content.match(/^#\s+(.+)/m)
  return match?.[1] || '(untitled)'
}

function findLatestVerifyReport(taskDir: string): string | null {
  const files = fs.readdirSync(taskDir).filter((f) => f.startsWith('verify-'))
  if (files.length === 0) return null
  const latest = files.sort().pop()!
  return fs.readFileSync(path.join(taskDir, latest), 'utf-8')
}
