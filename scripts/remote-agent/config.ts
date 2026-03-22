/**
 * @fileType utility
 * @domain remote-agent
 * @pattern config
 * @ai-summary Configuration for the remote dev agent server
 */

export const REMOTE_AGENT_PORT = parseInt(process.env.REMOTE_AGENT_PORT ?? '3456', 10)

/** Secret key for Bearer auth — must be set on the remote Mac */
export const REMOTE_AGENT_KEY = process.env.REMOTE_AGENT_KEY ?? ''

/**
 * Allowed filesystem roots for file operations.
 * Colon-separated list of absolute paths.
 * Example: /Users/aguy/projects:/tmp/workspace
 */
export const REMOTE_AGENT_ALLOWED_ROOTS: string[] = (process.env.REMOTE_AGENT_ALLOWED_ROOTS ?? '')
  .split(':')
  .map((p) => p.trim())
  .filter(Boolean)

/** Max bytes for exec stdout/stderr (512 KB) */
export const EXEC_MAX_BYTES = 512 * 1024

/** Max bytes for file read (1 MB) */
export const READ_MAX_BYTES = 1024 * 1024

/** Max entries for ls operation */
export const LS_MAX_ENTRIES = 500

/** Exec timeout in milliseconds */
export const EXEC_TIMEOUT_MS = 30_000

/** Commands that are explicitly blocked */
export const EXEC_DENY_LIST = ['sudo', 'rm -rf /', 'mkfs', 'dd if=', 'shutdown', 'reboot'] as const
