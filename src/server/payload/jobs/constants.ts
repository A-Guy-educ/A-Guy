/**
 * PDF → Exercises Conversion Configuration
 */
interface EnvParseOptions {
  min?: number
  max?: number
}

// Export for unit tests
export function readIntEnv(
  name: string,
  defaultValue: number,
  options: EnvParseOptions = {},
): number {
  const envValue = process.env[name]

  if (envValue === undefined || envValue === '') {
    return defaultValue
  }

  const parsed = parseInt(envValue, 10)

  if (isNaN(parsed)) {
    throw new Error(`Invalid ${name}: "${envValue}" is not a valid integer`)
  }

  if (options.min !== undefined && parsed < options.min) {
    throw new Error(`Invalid ${name}: ${parsed} is below minimum ${options.min}`)
  }

  if (options.max !== undefined && parsed > options.max) {
    throw new Error(`Invalid ${name}: ${parsed} exceeds maximum ${options.max}`)
  }

  return parsed
}

export const PDF_MAX_BYTES = 10 * 1024 * 1024

export const JOBS_COLLECTION = 'payload-jobs' as const

export const JOB_STATUS = {
  QUEUED: 'queued',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const

export type JobStatusValue = (typeof JOB_STATUS)[keyof typeof JOB_STATUS]

export const JOB_FIELDS = {
  PROCESSING: 'processing',
  HAS_ERROR: 'hasError',
  COMPLETED_AT: 'completedAt',
  STARTED_AT: 'startedAt',
  LOCK_EXPIRES_AT: 'lockExpiresAt',
} as const

export const TASK_SLUGS = {
  PDF_TO_EXERCISES: 'pdf_to_exercises' as const,
} as const

export const LOCK_TIMEOUT_MS = readIntEnv('LOCK_TIMEOUT_MS', 5 * 60 * 1000, { min: 1000 })
export const HEARTBEAT_INTERVAL_MS = readIntEnv('HEARTBEAT_INTERVAL_MS', 30 * 1000, { min: 1000 })
export const LOCK_RECLAIM_THRESHOLD_MS = 0
