/**
 * @fileType configuration
 * @domain cody | pipeline
 * @pattern named-constants
 * @ai-summary Centralized named constants for the Cody pipeline — replaces scattered magic numbers
 */

// --- Loop & Retry Limits ---

/** Max iterations of the main state-machine loop before circuit-breaking */
export const MAX_PIPELINE_LOOP_ITERATIONS = 200

/** Default max verify→fix loop iterations */
export const DEFAULT_MAX_FIX_ATTEMPTS = 2

/** Max build→quality-gate feedback loops */
export const MAX_BUILD_FEEDBACK_LOOPS = 2

/** State recovery check frequency (every N loop iterations) */
export const RECOVERY_CHECK_INTERVAL = 10

// --- Output Truncation ---

/** Max chars for gate output in verify-failures.md */
export const MAX_GATE_OUTPUT_CHARS = 5000

/** Max chars for passed gate output in verify report */
export const MAX_PASSED_GATE_OUTPUT_CHARS = 1000

/** Max chars for failed gate output in verify report */
export const MAX_FAILED_GATE_OUTPUT_CHARS = 5000

/** Max chars for gate output written to file */
export const MAX_GATE_FILE_OUTPUT_CHARS = 10_000

/** Max chars for tsc/test error output in build feedback */
export const MAX_QUALITY_ERROR_OUTPUT_CHARS = 3000

/** Max chars for agent text display in logs */
export const MAX_AGENT_DISPLAY_TEXT_CHARS = 300

// --- Process Lifecycle ---

/** Grace period (ms) before SIGKILL after SIGTERM */
export const SIGKILL_GRACE_MS = 5000

/** Delay (ms) between agent retries */
export const AGENT_RETRY_DELAY_MS = 2000

/** Number of stderr tail lines to capture */
export const STDERR_TAIL_LINES = 50

// --- Git & PR ---

/** Max PR title length */
export const MAX_PR_TITLE_LENGTH = 72

/** Max spec summary length in PR body */
export const MAX_SPEC_SUMMARY_LENGTH = 500

// --- Actor History ---

/** Max entries in the actorHistory audit trail */
export const MAX_ACTOR_HISTORY_ENTRIES = 50
