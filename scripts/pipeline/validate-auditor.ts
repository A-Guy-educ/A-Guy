#!/usr/bin/env tsx
import { readAuditorOutput } from './auditor-persistence'
import { AuditorOutputSchema } from './auditor-output.schema'

const args = process.argv.slice(2)
const taskId = args.find((a) => a.startsWith('--task-id='))?.split('=')[1]
const runId = args.find((a) => a.startsWith('--run-id='))?.split('=')[1]

if (!taskId || !runId) {
  console.error('Usage: --task-id=<id> --run-id=<id>')
  process.exit(1)
}

const output = readAuditorOutput(taskId, runId)

if (!output) {
  console.error(`❌ Auditor output missing for ${taskId}/runs/${runId}`)
  process.exit(1)
}

const result = AuditorOutputSchema.safeParse(output)
if (!result.success) {
  console.error('❌ Auditor output schema invalid:')
  console.error(result.error.format())
  process.exit(1)
}

const data = result.data

if (!data.chosenImprovement) {
  console.error('❌ Missing chosenImprovement')
  process.exit(1)
}

if (data.chosenImprovement.whereItLives.length === 0) {
  console.error('❌ whereItLives is empty')
  process.exit(1)
}

if ((data.runState === 'FAILURE' || data.runState === 'ABORTED') && !data.failureAnalysis) {
  console.error('❌ Failure run missing failureAnalysis')
  process.exit(1)
}

if (
  (data.runState === 'FAILURE' || data.runState === 'ABORTED') &&
  data.classification === 'UNKNOWN' &&
  !data.notes?.some((n) => n.toLowerCase().includes('insufficient logs'))
) {
  console.error('❌ UNKNOWN classification on failure without justification in notes')
  process.exit(1)
}

if (!data.canClose) {
  console.log('⚠️  Auditor output valid but canClose=false')
  console.log(`   Follow-up required: ${data.followUpRequired}`)
  console.log(`   Retry safe: ${data.retrySafe}`)
  process.exit(1)
}

console.log('✅ Auditor output valid and canClose=true')
console.log(`   Improvement: [${data.chosenImprovement.type}] ${data.chosenImprovement.title}`)
console.log(`   Where: ${data.chosenImprovement.whereItLives.join(', ')}`)
process.exit(0)
