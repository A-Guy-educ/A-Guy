// Rate limiting store (in-memory - use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(identifier: string): boolean {
  const now = Date.now()
  const limit = rateLimitStore.get(identifier)

  if (!limit || now > limit.resetAt) {
    // Reset or create new limit
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt: now + 15 * 60 * 1000, // 15 minutes
    })
    return true
  }

  if (limit.count >= 5) {
    // Exceeded limit: 5 attempts per 15 minutes
    return false
  }

  limit.count++
  return true
}
