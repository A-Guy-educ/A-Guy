/**
 * Payment error serialization for structured logging.
 *
 * Background: pino's default error serializer only fires for the log object
 * key `err`. We've been logging under `error` across the payment routes, so
 * pino fell back to plain JSON serialization on Error instances — which
 * produces `{}` because Error's `message` and `stack` are non-enumerable.
 *
 * `serializePaymentError` always returns an object with the fields we want
 * to see in production logs, regardless of which provider SDK threw and
 * regardless of which pino key the caller chose. Use it as
 * `{ err: serializePaymentError(error), ...context }`.
 */

interface SerializedPaymentError {
  message: string
  name?: string
  stack?: string
  code?: string | number
  statusCode?: number
  type?: string
  raw?: unknown
}

export function serializePaymentError(error: unknown): SerializedPaymentError {
  if (error instanceof Error) {
    const e = error as Error & {
      code?: string | number
      statusCode?: number
      type?: string
      raw?: unknown
    }
    return {
      message: e.message,
      name: e.name,
      stack: e.stack,
      code: e.code,
      statusCode: e.statusCode,
      type: e.type,
      raw: e.raw,
    }
  }
  if (typeof error === 'string') {
    return { message: error }
  }
  if (error && typeof error === 'object') {
    return { message: 'Non-Error object thrown', raw: error }
  }
  return { message: String(error ?? 'unknown error') }
}
