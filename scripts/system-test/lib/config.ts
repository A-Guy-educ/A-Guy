/**
 * @fileType utility
 * @domain cody | system-test
 * @pattern config
 * @ai-summary Shared constants for the Cody system test
 */

export const SYSTEM_TEST_LABEL = 'system-test'

export const ISSUE_TITLE_PREFIX = '[SYSTEM-TEST]'

export const POLL_INTERVAL_MS = 30_000 // 30 seconds

export const MAX_POLL_MS = 90 * 60_000 // 90 minutes

export const GATE_WAIT_MS = 60_000 // 60 seconds

export const CLEANUP_DELAY_MS = 5_000 // 5 seconds

export const CODY_WORKFLOW = 'cody.yml'

export const SYSTEM_TEST_WORKFLOW = 'cody-system-test.yml'
