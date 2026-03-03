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

// Re-export TASK_SLUG for backward compatibility
export const TASK_SLUG = TASK_SLUGS.PDF_TO_EXERCISES

export const ENV = {
  PAYLOAD_SERVER_URL: 'NEXT_PUBLIC_SERVER_URL',
  CRON_SECRET: 'CRON_SECRET',
  TEST_ADMIN_SECRET: 'TEST_ADMIN_SECRET',
  NODE_ENV: 'NODE_ENV',
} as const
