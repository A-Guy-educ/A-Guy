/**
 * @fileType utility
 * @domain cody | formatting
 * @pattern status-format
 * @ai-summary Status comment formatting helpers for GitHub issue comments
 */

import type { CodyInput, CodyPipelineStatus } from './cody-utils'

// ============================================================================
// Formatting Helpers
// ============================================================================

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`
  }
  return `${seconds}s`
}

export function formatStatusComment(
  input: CodyInput,
  status: CodyPipelineStatus,
  currentStage?: string,
  _currentState?: string, // Reserved for future use
): string {
  const lines: string[] = []

  if (status.state === 'running') {
    lines.push(`🔄 Cody running for \`${input.taskId}\` (mode: ${input.mode})`)
    lines.push('')

    if (currentStage) {
      const stageList = Object.entries(status.stages)
      for (const [stage, stageStatus] of stageList) {
        const icon =
          stageStatus.state === 'completed'
            ? '✅'
            : stageStatus.state === 'failed'
              ? '❌'
              : stageStatus.state === 'running'
                ? '🔄'
                : '⏳'
        const elapsed = stageStatus.elapsed ? ` (${formatDuration(stageStatus.elapsed)})` : ''
        lines.push(`  ${icon} ${stage}${elapsed}`)
      }
    }
  } else if (status.state === 'completed') {
    lines.push(`✅ Cody completed for \`${input.taskId}\`!`)
    lines.push(`Mode: ${input.mode}`)

    // Add per-stage table with timing and cost
    const completedStages = Object.entries(status.stages)
    const hasCostData = completedStages.some(([, s]) => s.cost !== undefined && s.cost > 0)

    if (completedStages.length > 0) {
      lines.push('')
      if (hasCostData) {
        // Full table with cost column
        lines.push('| Stage | Status | Duration | Cost |')
        lines.push('|-------|--------|----------|------|')
        for (const [stage, stageStatus] of completedStages) {
          const icon =
            stageStatus.state === 'completed' ? '✅' : stageStatus.state === 'skipped' ? '⏭️' : '❌'
          const elapsed = stageStatus.elapsed ? formatDuration(stageStatus.elapsed) : '—'
          const cost =
            stageStatus.cost !== undefined && stageStatus.cost > 0
              ? `$${stageStatus.cost.toFixed(4)}`
              : '—'
          lines.push(`| ${stage} | ${icon} | ${elapsed} | ${cost} |`)
        }
        // Total row
        if (status.totalCost !== undefined && status.totalCost > 0) {
          lines.push(`| **Total** | | | **$${status.totalCost.toFixed(4)}** |`)
        }
      } else {
        // Simple list without cost (backward compat)
        for (const [stage, stageStatus] of completedStages) {
          const icon = stageStatus.state === 'completed' ? '✅' : '❌'
          const elapsed = stageStatus.elapsed ? ` (${formatDuration(stageStatus.elapsed)})` : ''
          lines.push(`  ${icon} ${stage}${elapsed}`)
        }
      }
    }
  } else if (status.state === 'paused') {
    lines.push(`⏸️ Cody paused for \`${input.taskId}\``)
    lines.push(
      'Awaiting approval — reply with `@cody approve` or `/cody approve` to proceed. ' +
        'Reply with `@cody reject` or `/cody reject` to cancel.',
    )
  } else if (status.state === 'failed') {
    lines.push(`❌ Cody failed for \`${input.taskId}\``)
  } else if (status.state === 'timeout') {
    lines.push(`⏰ Cody timed out for \`${input.taskId}\``)
  }

  // Always append run URL regardless of state
  if (input.runUrl) {
    lines.push(`Run: ${input.runUrl}`)
  }

  return lines.join('\n')
}

export async function formatStatusCommentV2(input: CodyInput, stateV2: unknown): Promise<string> {
  if (!stateV2 || typeof stateV2 !== 'object') {
    return `❌ Invalid pipeline state for \`${input.taskId}\``
  }
  const { stateToV1 } = await import('./engine/status')
  return formatStatusComment(input, stateToV1(stateV2 as Parameters<typeof stateToV1>[0]))
}
