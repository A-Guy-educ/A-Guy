import type { GlobalAfterChangeHook } from 'payload'

// Dynamic import to avoid module resolution issues in production
async function revalidateHeaderTag(tag: string) {
  try {
    const { revalidateTag } = await import('next/cache')
    revalidateTag(tag)
  } catch (error) {
    // Silently fail if next/cache is not available (e.g., in non-Next.js contexts)
    console.warn('Failed to revalidate:', error)
  }
}

export const revalidateHeader: GlobalAfterChangeHook = async ({
  doc,
  req: { payload, context },
}) => {
  if (!context.disableRevalidate) {
    payload.logger.info(`Revalidating header`)

    await revalidateHeaderTag('global_header')
  }

  return doc
}
