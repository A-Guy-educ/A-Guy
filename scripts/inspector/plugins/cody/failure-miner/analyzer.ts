/**
 * @fileType utility
 * @domain inspector
 * @pattern failure-miner-analyzer
 * @ai-summary Analyzes failed task records to detect systemic patterns
 */

import type { FailedTaskRecord } from './collector'

export interface StageHotspot {
  stage: string
  failureCount: number
  /** Fraction of all failures at this stage (0-1) */
  fraction: number
}

export interface ErrorPattern {
  /** Short normalized label */
  label: string
  /** Regex pattern used to detect this error */
  pattern: string
  occurrences: number
  affectedTaskIds: string[]
}

export interface MinerAnalysis {
  totalFailures: number
  /** Stages with ≥2 failures */
  stageHotspots: StageHotspot[]
  /** Error patterns with ≥2 occurrences */
  errorPatterns: ErrorPattern[]
  analysisDate: string
}

// -------------------------------------------------------------------
// Error pattern definitions (deterministic, no LLM)
// -------------------------------------------------------------------

interface PatternDef {
  label: string
  pattern: RegExp
}

const ERROR_PATTERNS: PatternDef[] = [
  { label: 'type-error', pattern: /typescript|tsc|type error/i },
  { label: 'lint-failure', pattern: /eslint|lint failed|no-unused/i },
  { label: 'test-failure', pattern: /test failed|vitest|jest|expect\(/i },
  { label: 'build-error', pattern: /build failed|compilation error|webpack|esbuild/i },
  { label: 'api-key-missing', pattern: /api[_\s]?key|secret missing|env.*not set/i },
  { label: 'rate-limit', pattern: /rate limit|429|too many requests/i },
  { label: 'timeout', pattern: /timeout|timed out|exceeded.*time/i },
  { label: 'permission-denied', pattern: /permission denied|eacces|unauthorized/i },
  { label: 'disk-full', pattern: /no space left|enospc|disk full|out of disk/i },
  { label: 'merge-conflict', pattern: /merge conflict|conflict.*merge|cannot.*rebase/i },
  { label: 'import-error', pattern: /cannot find module|module not found|import.*error/i },
  { label: 'network-error', pattern: /econnrefused|econnreset|network error|fetch failed/i },
]

/**
 * Analyze a list of failed task records and detect systemic patterns.
 */
export function analyzeFailures(records: FailedTaskRecord[]): MinerAnalysis {
  const total = records.length

  // Stage hotspot detection
  const stageCount = new Map<string, number>()
  for (const rec of records) {
    stageCount.set(rec.failedStage, (stageCount.get(rec.failedStage) ?? 0) + 1)
  }

  const stageHotspots: StageHotspot[] = []
  for (const [stage, count] of stageCount.entries()) {
    if (count >= 2) {
      stageHotspots.push({
        stage,
        failureCount: count,
        fraction: total > 0 ? Math.round((count / total) * 100) / 100 : 0,
      })
    }
  }
  stageHotspots.sort((a, b) => b.failureCount - a.failureCount)

  // Error pattern detection
  const patternMatches = new Map<string, { occurrences: number; taskIds: Set<string> }>()

  for (const rec of records) {
    if (!rec.error) continue
    for (const def of ERROR_PATTERNS) {
      if (def.pattern.test(rec.error)) {
        const existing = patternMatches.get(def.label) ?? { occurrences: 0, taskIds: new Set() }
        existing.occurrences++
        existing.taskIds.add(rec.taskId)
        patternMatches.set(def.label, existing)
      }
    }
  }

  const errorPatterns: ErrorPattern[] = []
  for (const [label, data] of patternMatches.entries()) {
    if (data.occurrences >= 2) {
      const def = ERROR_PATTERNS.find((d) => d.label === label)!
      errorPatterns.push({
        label,
        pattern: def.pattern.toString(),
        occurrences: data.occurrences,
        affectedTaskIds: Array.from(data.taskIds),
      })
    }
  }
  errorPatterns.sort((a, b) => b.occurrences - a.occurrences)

  return {
    totalFailures: total,
    stageHotspots,
    errorPatterns,
    analysisDate: new Date().toISOString(),
  }
}
