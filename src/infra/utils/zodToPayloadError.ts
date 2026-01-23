import { ZodError } from 'zod'
import { ValidationError } from 'payload'

/**
 * Converts a Zod path array to dot notation
 * @example ["stem", 0, "value"] -> "stem.0.value"
 */
export function zodPathToDotPath(path: Array<string | number | symbol>): string {
  return path.map((segment) => String(segment)).join('.')
}

/**
 * Converts ZodError to Payload ValidationError format
 * @param zodError - The ZodError from schema validation
 * @param options - Configuration options
 * @param options.fieldPrefix - Prefix to add to all paths (e.g., "contentJson")
 * @param options.maxIssues - Maximum number of issues to include (default: 50)
 */
export function zodErrorToPayloadErrors(
  zodError: ZodError,
  options: {
    fieldPrefix: string
    maxIssues?: number
  },
): Array<{ path: string; message: string }> {
  const { fieldPrefix, maxIssues = 50 } = options

  return zodError.issues.slice(0, maxIssues).map((issue) => ({
    path: issue.path.length > 0 ? `${fieldPrefix}.${zodPathToDotPath(issue.path)}` : fieldPrefix,
    message: issue.message,
  }))
}

/**
 * Throws a Payload ValidationError with properly formatted Zod errors
 * @param zodError - The ZodError from schema validation
 * @param fieldPrefix - The Payload field name (e.g., "contentJson", "answerSpecJson")
 */
export function throwPayloadValidationError(zodError: ZodError, fieldPrefix: string): never {
  const errors = zodErrorToPayloadErrors(zodError, { fieldPrefix })
  throw new ValidationError({ errors })
}

/**
 * Validates JSON content and throws Payload ValidationError on failure
 * @param fieldName - Name of the field for error messages
 * @param value - Value to validate (can be undefined/null)
 * @param schema - Zod schema to validate against
 */
export function validateJsonField<T>(
  fieldName: string,
  value: unknown,
  schema: { safeParse: (data: unknown) => { success: boolean; error?: ZodError; data?: T } },
): T {
  // Handle missing value
  if (value === undefined || value === null) {
    throw new ValidationError({
      errors: [{ path: fieldName, message: 'Required' }],
    })
  }

  // Validate with Zod
  const result = schema.safeParse(value)

  if (!result.success && result.error) {
    throwPayloadValidationError(result.error, fieldName)
  }

  return result.data as T
}
