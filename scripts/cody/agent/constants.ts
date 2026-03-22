/**
 * @fileType configuration
 * @domain ci | cody | agent-execution
 * @pattern constants
 * @ai-summary Agent runner constants — timeouts, retry limits, buffer sizes
 */

import ms from 'ms'

/** Delay between stability checks after process exit (milliseconds) */
export const STABILITY_CHECK_INTERVAL = 500

/** Number of consecutive stable size checks before settling */
export const STABILITY_CHECK_COUNT = 2

/** Additional delay to wait after process exit before checking (filesystem flush) */
export const POST_EXIT_DELAY = 500

/** Timeout for session nudge attempt (seconds) — lightweight continuation before full retry */
export const NUDGE_TIMEOUT = 90

/** Maximum retry attempts for failed stages */
export const MAX_RETRIES = 2

/** Maximum size of stdout buffer to prevent memory leaks (1 MB) */
export const MAX_STDOUT_BUFFER_SIZE = 1_048_576

/** Default timeout for stages (10 minutes) */
export const DEFAULT_TIMEOUT = ms('10m')

/** LLM-specific timeout - max time to wait for LLM API response (3 minutes) */
export const LLM_TIMEOUT = ms('3m')

/** Stall detection: if no stdout events for this many ms, kill and retry the agent.
 *  Prevents wasting the full stage timeout when the LLM API hangs silently. */
export const STALL_TIMEOUT = ms('5m')
