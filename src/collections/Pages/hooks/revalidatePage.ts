import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

import type { Page } from '../../../payload-types'

// Dynamic import to avoid module resolution issues in production
async function revalidatePagePath(path: string, tag: string) {
  try {
    const { revalidatePath, revalidateTag } = await import('next/cache')
    revalidatePath(path)
    revalidateTag(tag)
  } catch (error) {
    // Silently fail if next/cache is not available (e.g., in non-Next.js contexts)
    console.warn('Failed to revalidate:', error)
  }
}

export const revalidatePage: CollectionAfterChangeHook<Page> = async ({
  doc,
  previousDoc,
  req: { payload, context },
}) => {
  if (!context.disableRevalidate) {
    if (doc._status === 'published') {
      const path = doc.slug === 'home' ? '/' : `/${doc.slug}`

      payload.logger.info(`Revalidating page at path: ${path}`)

      await revalidatePagePath(path, 'pages-sitemap')
    }

    // If the page was previously published, we need to revalidate the old path
    if (previousDoc?._status === 'published' && doc._status !== 'published') {
      const oldPath = previousDoc.slug === 'home' ? '/' : `/${previousDoc.slug}`

      payload.logger.info(`Revalidating old page at path: ${oldPath}`)

      await revalidatePagePath(oldPath, 'pages-sitemap')
    }
  }
  return doc
}

export const revalidateDelete: CollectionAfterDeleteHook<Page> = async ({
  doc,
  req: { context },
}) => {
  if (!context.disableRevalidate) {
    const path = doc?.slug === 'home' ? '/' : `/${doc?.slug}`
    await revalidatePagePath(path, 'pages-sitemap')
  }

  return doc
}
