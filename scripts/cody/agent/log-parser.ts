/**
 * @fileType utility
 * @domain ci | cody | agent-execution
 * @pattern log-parser
 * @ai-summary Parses JSON event lines from opencode into human-readable log output
 */

/**
 * Format a JSON event line from opencode into a human-readable log line.
 * Returns the formatted string, or null to skip (for noisy/unimportant events).
 * Also extracts sessionID from events when found.
 */
export function formatJsonEvent(line: string): {
  display: string | null
  sessionId?: string
  stepTokens?: { input: number; output: number; cacheRead: number }
  stepCost?: number
  completed?: boolean
} {
  try {
    const event = JSON.parse(line)
    const type: string = event.type
    const sessionId: string | undefined = event.sessionID

    switch (type) {
      case 'session_start':
        return { display: `🎯 Session started: ${sessionId?.slice(0, 16) || 'unknown'}`, sessionId }

      case 'step_start':
        return { display: null, sessionId } // Quiet — step_finish is more useful

      case 'step_finish': {
        const tokens = event.part?.tokens?.total || 0
        const cost = event.part?.cost ?? 0
        const reason = event.part?.reason || ''
        const cached = event.part?.tokens?.cache?.read || 0
        const inputTokens = event.part?.tokens?.input || 0
        const outputTokens = event.part?.tokens?.output || 0
        const costStr = typeof cost === 'number' && cost > 0 ? ` · $${cost.toFixed(4)}` : ''
        const cacheStr = cached > 0 ? ` · ${cached} cached` : ''
        const isCompletion = reason === 'stop'
        return {
          display: `  ✅ Step done (${tokens} tok${cacheStr}${costStr}) [${reason}]`,
          sessionId,
          stepTokens: { input: inputTokens, output: outputTokens, cacheRead: cached },
          stepCost: typeof cost === 'number' ? cost : 0,
          completed: isCompletion,
        }
      }

      case 'tool_use': {
        const tool = event.part?.tool || 'unknown'
        const status = event.part?.state?.status || ''
        const title = event.part?.state?.title || event.part?.state?.input?.description || ''
        const exit = event.part?.state?.metadata?.exit
        const exitStr = exit !== undefined && exit !== 0 ? ` exit=${exit}` : ''
        const titleStr = title ? `: ${title}` : ''
        if (status === 'completed') {
          return { display: `  🔧 ${tool}${titleStr}${exitStr}`, sessionId }
        }
        return { display: null, sessionId } // Skip pending/running states
      }

      case 'text': {
        // Agent reasoning — complete thought blocks (not char-by-char deltas)
        // Typically 6-17 per stage, ~100-200 chars each — not noisy
        const text = (event.part?.text || '').trim()
        if (!text) return { display: null, sessionId }
        const truncated = text.length > 300 ? text.slice(0, 297) + '...' : text
        return { display: `  💭 ${truncated}`, sessionId }
      }

      case 'text_delta':
      case 'content':
        return { display: null, sessionId } // Skip streaming text deltas (too noisy)

      case 'error': {
        const msg = event.part?.message || event.message || JSON.stringify(event.part)
        return { display: `  🔴 Error: ${msg}`, sessionId }
      }

      default:
        return { display: null, sessionId } // Skip unknown event types
    }
  } catch {
    // Not valid JSON — might be a plain log line from pino/logger
    // Show it as-is if it looks meaningful
    const trimmed = line.trim()
    if (!trimmed) return { display: null }
    return { display: trimmed }
  }
}

/**
 * Format a timestamp as HH:MM:SS for log prefixing.
 */
export function formatTimestamp(): string {
  const now = new Date()
  return [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map((n) => String(n).padStart(2, '0'))
    .join(':')
}

/**
 * Prefix a display line with [stage HH:MM:SS] for log context.
 */
export function prefixLogLine(stage: string, display: string): string {
  return `[${stage} ${formatTimestamp()}] ${display.trimStart()}`
}
