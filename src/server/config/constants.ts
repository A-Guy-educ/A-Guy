// Import job-related constants from centralized location
import {
  HEARTBEAT_INTERVAL_MS,
  LOCK_RECLAIM_THRESHOLD_MS,
  LOCK_TIMEOUT_MS,
  PDF_MAX_BYTES,
  TASK_SLUGS,
  readIntEnv,
} from '@/server/payload/jobs/constants'

export {
  HEARTBEAT_INTERVAL_MS,
  LOCK_RECLAIM_THRESHOLD_MS,
  LOCK_TIMEOUT_MS,
  PDF_MAX_BYTES,
  TASK_SLUGS,
  readIntEnv,
}

export const MAX_SEGMENT_PAGES = 2
export const MAX_EXERCISES_PER_SEGMENT = 1000
export const MAX_PROMPT_SIZE_BYTES = 50 * 1024

// Re-export TASK_SLUG for backward compatibility
export const TASK_SLUG = TASK_SLUGS.PDF_TO_EXERCISES

export const ENV = {
  PAYLOAD_SERVER_URL: 'PAYLOAD_PUBLIC_SERVER_URL',
  CRON_SECRET: 'CRON_SECRET',
  TEST_ADMIN_SECRET: 'TEST_ADMIN_SECRET',
  NODE_ENV: 'NODE_ENV',
} as const
