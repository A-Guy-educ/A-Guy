/**
 * @fileType utility
 * @domain cody | pipeline
 * @pattern task-io
 * @ai-summary Task file I/O — reads and normalizes task.json from disk
 */

import * as fs from 'fs'
import * as path from 'path'

import type { TaskDefinition } from './task-schema'
import { normalizeTask, validateTask } from './task-schema'

export function readTask(taskDir: string): TaskDefinition | null {
  const taskFile = path.join(taskDir, 'task.json')
  if (!fs.existsSync(taskFile)) {
    return null
  }

  const content = fs.readFileSync(taskFile, 'utf-8')

  let raw: unknown
  try {
    raw = JSON.parse(content)
  } catch {
    const preview = content.slice(0, 200).replace(/\n/g, '\\n')
    throw new Error(
      `task.json is not valid JSON.\n` +
        `  File: ${taskFile}\n` +
        `  Preview: ${preview}\n` +
        `  Common causes:\n` +
        `    • Agent wrapped JSON in markdown code fences\n` +
        `    • Trailing comma in JSON\n` +
        `    • Agent wrote commentary outside the JSON object\n` +
        `  Fix task.json and re-run, or delete it to re-classify:\n` +
        `    rm ${taskFile}`,
    )
  }

  // Normalize common LLM mistakes before validation
  if (typeof raw === 'object' && raw !== null) {
    raw = normalizeTask(raw as Record<string, unknown>)

    // Write back normalized values so subsequent reads are consistent
    fs.writeFileSync(taskFile, JSON.stringify(raw, null, 2) + '\n')
  }

  const result = validateTask(raw)

  if (!result.valid) {
    throw new Error(
      `task.json validation failed:\n${result.errors.map((e) => `  • ${e}`).join('\n')}`,
    )
  }

  return raw as TaskDefinition
}
