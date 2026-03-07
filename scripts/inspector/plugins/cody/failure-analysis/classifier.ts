/**
 * @fileType utility
 * @domain inspector
 * @pattern retry-classification
 * @ai-summary Deterministic pre-classification of retryability before LLM analysis
 */

export interface RetryClassification {
  canRetry: boolean
  reason?: string
  category: 'infrastructure' | 'format-only' | 'unknown'
}

/**
 * Determine if a failure is retryable without calling the LLM.
 * This saves MiniMax tokens + pipeline runs for clearly non-retryable failures.
 */
export function classifyRetryability(failedStage: string, error: string): RetryClassification {
  const lowerError = error.toLowerCase()

  // Infrastructure failures — never retry
  if (
    lowerError.includes('api key') ||
    lowerError.includes('secret') ||
    lowerError.includes('minimax_api_key') ||
    lowerError.includes('gemini_api_key') ||
    lowerError.includes('openai_api_key') ||
    lowerError.includes('anthropic_api_key')
  ) {
    return {
      canRetry: false,
      reason: 'Missing credentials — fix credentials before retrying',
      category: 'infrastructure',
    }
  }

  if (
    lowerError.includes('rate limit') ||
    lowerError.includes('429') ||
    lowerError.includes('too many requests')
  ) {
    return {
      canRetry: false,
      reason: 'Rate limited — wait before retrying',
      category: 'infrastructure',
    }
  }

  if (
    lowerError.includes('out of disk') ||
    lowerError.includes('no space left') ||
    lowerError.includes('enospc') ||
    lowerError.includes('disk full')
  ) {
    return {
      canRetry: false,
      reason: 'Disk space exhaustion — clean up runner before retrying',
      category: 'infrastructure',
    }
  }

  if (
    lowerError.includes('permission denied') &&
    !lowerError.includes('access control') &&
    !lowerError.includes('payload')
  ) {
    return {
      canRetry: false,
      reason: 'Permission denied — check runner configuration',
      category: 'infrastructure',
    }
  }

  if (
    lowerError.includes('workflow run') &&
    (lowerError.includes('cancelled') || lowerError.includes('aborted'))
  ) {
    return {
      canRetry: false,
      reason: 'Workflow was cancelled — investigate why before retrying',
      category: 'infrastructure',
    }
  }

  if (
    lowerError.includes('timeout') &&
    (lowerError.includes('actions timeout') ||
      lowerError.includes('github hosted') ||
      lowerError.includes('runner'))
  ) {
    return {
      canRetry: false,
      reason: 'Actions timeout — runner may be constrained',
      category: 'infrastructure',
    }
  }

  // Format-only failures at verify stage — can auto-fix without full LLM analysis
  if (failedStage === 'verify' && isFormatOnlyFailure(error)) {
    return {
      canRetry: true,
      reason: 'Format-only failure — can be auto-fixed',
      category: 'format-only',
    }
  }

  // Default — let LLM decide
  return {
    canRetry: true,
    category: 'unknown',
  }
}

/**
 * Check if the error is a format-only failure (prettier/eslint)
 * that can be auto-fixed without LLM intervention.
 */
function isFormatOnlyFailure(error: string): boolean {
  const lower = error.toLowerCase()

  const lintFormatOnly =
    (lower.includes('lint') || lower.includes('format')) &&
    !lower.includes('error') &&
    !lower.includes('tsc') &&
    !lower.includes('typescript')

  const prettierOnly =
    lower.includes('src/') && (lower.includes('should format') || lower.includes('must format'))

  const hasTypeError =
    lower.includes('ts') && (lower.includes('error ts') || lower.includes('typeerror'))
  const hasTestFailure = lower.includes('test') || lower.includes('expect')

  if (hasTypeError || hasTestFailure) {
    return false
  }

  return lintFormatOnly || prettierOnly
}
