#!/usr/bin/env tsx
import fs from 'fs'
import path from 'path'
import { AuditorOutputSchema, type AuditorOutput } from './auditor-output.schema'

const TASKS_DIR = '.tasks'
const INDEX_PATH = path.join(TASKS_DIR, '_auditor-index.json')

interface AggregateIndex {
  generatedAt: string
  totalRuns: number
  successRuns: number
  failureRuns: number
  abortedRuns: number
  improvementsByType: Record<string, number>
  classificationBreakdown: Record<string, number>
  topFrictions: Array<{ title: string; count: number; taskIds: string[] }>
  recentImprovements: Array<{
    taskId: string
    runId: string
    type: string
    title: string
    whereItLives: string[]
    runState: string
  }>
}

function collectAllOutputs(): Array<AuditorOutput & { _taskId: string; _runId: string }> {
  const results: Array<AuditorOutput & { _taskId: string; _runId: string }> = []

  const taskDirs = fs
    .readdirSync(TASKS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_'))

  for (const taskDir of taskDirs) {
    const runsDir = path.join(TASKS_DIR, taskDir.name, 'runs')
    if (!fs.existsSync(runsDir)) continue

    const runDirs = fs.readdirSync(runsDir, { withFileTypes: true }).filter((d) => d.isDirectory())

    for (const runDir of runDirs) {
      const filePath = path.join(runsDir, runDir.name, 'auditor.json')
      if (!fs.existsSync(filePath)) continue

      try {
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
        const parsed = AuditorOutputSchema.parse(raw)
        results.push({ ...parsed, _taskId: taskDir.name, _runId: runDir.name })
      } catch {
        // Skip invalid entries
      }
    }
  }

  return results.sort((a, b) => a._runId.localeCompare(b._runId))
}

function aggregate(
  outputs: Array<AuditorOutput & { _taskId: string; _runId: string }>,
): AggregateIndex {
  const improvementsByType: Record<string, number> = {}
  const classificationBreakdown: Record<string, number> = {}
  const frictionMap = new Map<string, { count: number; taskIds: Set<string> }>()

  let successRuns = 0
  let failureRuns = 0
  let abortedRuns = 0

  for (const o of outputs) {
    if (o.runState === 'SUCCESS') successRuns++
    else if (o.runState === 'FAILURE') failureRuns++
    else abortedRuns++

    const type = o.chosenImprovement.type
    improvementsByType[type] = (improvementsByType[type] || 0) + 1

    classificationBreakdown[o.classification] = (classificationBreakdown[o.classification] || 0) + 1

    const key = o.chosenImprovement.title.toLowerCase()
    const existing = frictionMap.get(key) || { count: 0, taskIds: new Set<string>() }
    existing.count++
    existing.taskIds.add(o._taskId)
    frictionMap.set(key, existing)
  }

  const topFrictions = [...frictionMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([title, data]) => ({
      title,
      count: data.count,
      taskIds: [...data.taskIds],
    }))

  const recentImprovements = outputs
    .slice(-20)
    .reverse()
    .map((o) => ({
      taskId: o._taskId,
      runId: o._runId,
      type: o.chosenImprovement.type,
      title: o.chosenImprovement.title,
      whereItLives: o.chosenImprovement.whereItLives,
      runState: o.runState,
    }))

  return {
    generatedAt: new Date().toISOString(),
    totalRuns: outputs.length,
    successRuns,
    failureRuns,
    abortedRuns,
    improvementsByType,
    classificationBreakdown,
    topFrictions,
    recentImprovements,
  }
}

const outputs = collectAllOutputs()
const index = aggregate(outputs)
fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2), 'utf-8')

console.log(`✅ Aggregated ${outputs.length} auditor outputs → ${INDEX_PATH}`)
console.log(
  `   Success: ${index.successRuns} | Failure: ${index.failureRuns} | Aborted: ${index.abortedRuns}`,
)
if (index.topFrictions.length > 0) {
  console.log(`   Top friction: "${index.topFrictions[0].title}" (${index.topFrictions[0].count}x)`)
}
