import { z } from 'zod'

/**
 * Environment variable validation schema
 * Required vars throw on missing, optional/public vars warn but don't throw
 */
const envSchema = z.object({
  // Required - throw if missing
  DATABASE_URL: z.string().min(1),
  PAYLOAD_SECRET: z.string().min(1),
  BLOB_READ_WRITE_TOKEN: z.string().min(1),

  // Optional - warn if missing
  SENTRY_DSN: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GITHUB_TOKEN: z.string().optional(),

  // Public - warn if missing
  NEXT_PUBLIC_SERVER_URL: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
})

/**
 * Validates required environment variables and warns about missing optional ones.
 * Throws if any required variables are missing.
 */
export function validateEnv(): void {
  // Validate required variables - throw on error
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    const missingVars = result.error.issues.map((issue) => issue.path.join('.')).join(', ')

    throw new Error(
      `Missing required environment variables: ${missingVars}. Please set them in your .env file.`,
    )
  }

  // Warn about missing optional variables
  const optionalVars = ['SENTRY_DSN', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'GITHUB_TOKEN']
  for (const varName of optionalVars) {
    if (!process.env[varName]) {
      console.warn(`[Env] Optional variable ${varName} is not set. Some features may be limited.`)
    }
  }

  // Warn about missing public variables
  const publicVars = ['NEXT_PUBLIC_SERVER_URL', 'NEXT_PUBLIC_SENTRY_DSN']
  for (const varName of publicVars) {
    if (!process.env[varName]) {
      console.warn(`[Env] Public variable ${varName} is not set. Some features may be limited.`)
    }
  }
}
