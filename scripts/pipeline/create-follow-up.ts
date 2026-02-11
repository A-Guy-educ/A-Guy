import fs from 'fs'
import path from 'path'
import type { AuditorOutput } from './auditor-output.schema'

const TASKS_DIR = '.tasks'

export function createFollowUpTask(auditorOutput: AuditorOutput): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const slug = auditorOutput.chosenImprovement.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 40)
    .replace(/-$/, '')

  const taskId = `${date}-followup-${slug}`
  const taskDir = path.join(TASKS_DIR, taskId)
  fs.mkdirSync(taskDir, { recursive: true })

  const improvement = auditorOutput.chosenImprovement
  const fa = auditorOutput.failureAnalysis

  const content = `# Follow-Up: ${improvement.title}

## Origin

- Source task: ${auditorOutput.taskId}
- Source run: ${auditorOutput.runId}
- Run state: ${auditorOutput.runState}
- Classification: ${auditorOutput.classification}

## Objective

${improvement.rationale}

## Type

${improvement.type}

## Target Files

${improvement.whereItLives.map((f) => `- ${f}`).join('\n')}

## Acceptance Criteria

${improvement.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}
${
  fa
    ? `
## Failure Context

- Root cause: ${fa.rootCause}
- Missed signal: ${fa.earliestMissedSignal}
- Responsibility: ${fa.responsibilityBoundary}
- Retry safe: ${auditorOutput.retrySafe}
`
    : ''
}
## Notes

${auditorOutput.notes?.join('\n') || '(none)'}
`

  const specPath = path.join(taskDir, 'spec.md')
  fs.writeFileSync(specPath, content.trim(), 'utf-8')

  return taskDir
}
