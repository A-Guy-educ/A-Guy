#!/usr/bin/env npx tsx
/**
 * Strategic Compact Suggester
 *
 * @fileType utility
 * @domain workflow, automation
 * @ai-summary Track tool calls and suggest manual compaction at strategic intervals
 *
 * Why manual over auto-compact:
 * - Auto-compact happens at arbitrary points, often mid-task
 * - Strategic compacting preserves context through logical phases
 * - Compact after exploration, before execution
 * - Compact after completing a milestone, before starting next
 *
 * Hook config (in ~/.claude/settings.json):
 * {
 *   "hooks": {
 *     "PreToolUse": [{
 *       "matcher": "Edit|Write",
 *       "hooks": [{
 *         "type": "command",
 *         "command": "npx tsx ~/.claude/skills/strategic-compact/scripts/suggest-compact.ts"
 *       }]
 *     }]
 *   }
 * }
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { parseArgs } from 'util'

// ─────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────

const COUNTER_FILE = '/tmp/claude-tool-count'
const DEFAULT_THRESHOLD = 50
const DEFAULT_INTERVAL = 25

// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────

function log(message: string) {
  // Output to stderr ( Claude Code hooks can capture this )
  console.error(message)
}

function getThreshold(): number {
  const env = process.env.COMPACT_THRESHOLD
  if (env) {
    const parsed = parseInt(env, 10)
    if (!isNaN(parsed) && parsed > 0) {
      return parsed
    }
  }
  return DEFAULT_THRESHOLD
}

function getInterval(): number {
  const env = process.env.COMPACT_INTERVAL
  if (env) {
    const parsed = parseInt(env, 10)
    if (!isNaN(parsed) && parsed > 0) {
      return parsed
    }
  }
  return DEFAULT_INTERVAL
}

// ─────────────────────────────────────────────
// Counter Management
// ─────────────────────────────────────────────

function getCounter(): number {
  if (!existsSync(COUNTER_FILE)) {
    return 0
  }
  try {
    const content = readFileSync(COUNTER_FILE, 'utf-8').trim()
    const count = parseInt(content, 10)
    return isNaN(count) ? 0 : count
  } catch {
    return 0
  }
}

function setCounter(count: number): void {
  writeFileSync(COUNTER_FILE, count.toString(), 'utf-8')
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

function main() {
  const { values } = parseArgs({
    options: {
      threshold: { type: 'string', short: 't' },
      interval: { type: 'string', short: 'i' },
      reset: { type: 'boolean', short: 'r', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    allowPositionals: true,
  })

  if (values.help) {
    console.log(`
Strategic Compact Suggester

Usage: npx tsx .agents/skills/strategic-compact/scripts/suggest-compact.ts [options]

Options:
  --threshold, -t <n>  Tool call threshold (default: ${DEFAULT_THRESHOLD})
  --interval, -i <n>  Interval after threshold (default: ${DEFAULT_INTERVAL})
  --reset, -r         Reset counter to 0
  --help, -h          Show this help message

Environment Variables:
  COMPACT_THRESHOLD   Tool call threshold (default: ${DEFAULT_THRESHOLD})
  COMPACT_INTERVAL    Interval after threshold (default: ${DEFAULT_INTERVAL})

The script tracks tool call count and suggests /compact at strategic points.
`)
    process.exit(0)
  }

  const threshold = values.threshold ? parseInt(values.threshold, 10) : getThreshold()
  const interval = values.interval ? parseInt(values.interval, 10) : getInterval()

  // Reset if requested
  if (values.reset) {
    setCounter(0)
    log(`[StrategicCompact] Counter reset to 0`)
    process.exit(0)
  }

  // Increment counter
  const count = getCounter() + 1
  setCounter(count)

  // Suggest at threshold
  if (count === threshold) {
    log(
      `[StrategicCompact] ${threshold} tool calls reached - consider /compact if transitioning phases`,
    )
  }

  // Suggest at regular intervals after threshold
  if (count > threshold && count % interval === 0) {
    log(`[StrategicCompact] ${count} tool calls - good checkpoint for /compact if context is stale`)
  }
}

main()
