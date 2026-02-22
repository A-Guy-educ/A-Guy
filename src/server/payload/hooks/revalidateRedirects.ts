import { logger } from '@/infra/utils/logger'
import type { CollectionAfterChangeHook } from 'payload'

const log = logger.child({ hook: 'revalidateRedirects' })

// Dynamic import to avoid module resolution issues in production
async function revalidateRedirectsTag(tag: string) {
  try {
    const { revalidateTag } = await import('next/cache')
    revalidateTag(tag)
  } catch (error) {
    // Silently fail if next/cache is not available (e.g., in non-Next.js contexts)
    log.warn({ err: error }, 'Failed to revalidate')
  }
}

export const revalidateRedirects: CollectionAfterChangeHook = async ({ doc, req: { payload } }) => {
  payload.logger.info(`Revalidating redirects`)

  await revalidateRedirectsTag('redirects')

  return doc
}
