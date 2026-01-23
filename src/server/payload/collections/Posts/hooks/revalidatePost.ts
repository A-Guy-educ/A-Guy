import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

import type { Post } from '@/payload-types'

// Dynamic import to avoid module resolution issues in production
async function revalidatePostPath(path: string, tag: string) {
  try {
    const { revalidatePath, revalidateTag } = await import('next/cache')
    revalidatePath(path)
    revalidateTag(tag)
  } catch (error) {
    // Silently fail if next/cache is not available (e.g., in non-Next.js contexts)
    console.warn('Failed to revalidate:', error)
  }
}

export const revalidatePost: CollectionAfterChangeHook<Post> = async ({
  doc,
  previousDoc,
  req: { payload, context },
}) => {
  if (!context.disableRevalidate) {
    if (doc._status === 'published') {
      const path = `/posts/${doc.slug}`

      payload.logger.info(`Revalidating post at path: ${path}`)

      await revalidatePostPath(path, 'posts-sitemap')
    }

    // If the post was previously published, we need to revalidate the old path
    if (previousDoc._status === 'published' && doc._status !== 'published') {
      const oldPath = `/posts/${previousDoc.slug}`

      payload.logger.info(`Revalidating old post at path: ${oldPath}`)

      await revalidatePostPath(oldPath, 'posts-sitemap')
    }
  }
  return doc
}

export const revalidateDelete: CollectionAfterDeleteHook<Post> = async ({
  doc,
  req: { context },
}) => {
  if (!context.disableRevalidate) {
    const path = `/posts/${doc?.slug}`

    await revalidatePostPath(path, 'posts-sitemap')
  }

  return doc
}
