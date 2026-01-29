import path from 'path'

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
export const LOCK_TIMEOUT_MS = readIntEnv('LOCK_TIMEOUT_MS', 10 * 60 * 1000, { min: 1000 })
export const HEARTBEAT_INTERVAL_MS = readIntEnv('HEARTBEAT_INTERVAL_MS', 5 * 60 * 1000, { min: 50 })
export const LOCK_RECLAIM_THRESHOLD_MS = 0
export const TASK_SLUG = 'pdf_to_exercises' as const
export const MAX_SEGMENT_PAGES = 2
export const MAX_EXERCISES_PER_SEGMENT = 1000
export const MAX_PROMPT_SIZE_BYTES = 50 * 1024

let _uploadDir: string | null = null

export function getUploadDir(): string {
  if (_uploadDir) return _uploadDir

  if (process.env.MEDIA_UPLOAD_DIR) {
    _uploadDir = process.env.MEDIA_UPLOAD_DIR
    return _uploadDir
  }

  _uploadDir = path.join(process.cwd(), 'media')
  return _uploadDir
}

export const ENV = {
  PAYLOAD_SERVER_URL: 'PAYLOAD_PUBLIC_SERVER_URL',
  CRON_SECRET: 'CRON_SECRET',
  TEST_ADMIN_SECRET: 'TEST_ADMIN_SECRET',
  NODE_ENV: 'NODE_ENV',
} as const
