import { getServerSideSitemap } from 'next-sitemap'
import { unstable_cache } from 'next/cache'

// Force dynamic rendering to avoid build-time tracing issues
export const dynamic = 'force-dynamic'

const getPostsSitemap = unstable_cache(
  async () => {
    // Return empty sitemap if DATABASE_URL is not available (e.g., during build)
    if (!process.env.DATABASE_URL) {
      return []
    }

    try {
      // Dynamically import to avoid module-level errors during build
      const { getPayload } = await import('payload')
      const config = await import('@payload-config')
      const payload = await getPayload({ config: config.default })
      const SITE_URL =
        process.env.NEXT_PUBLIC_SERVER_URL ||
        process.env.VERCEL_PROJECT_PRODUCTION_URL ||
        'https://example.com'

      const results = await payload.find({
        collection: 'posts',
        overrideAccess: false,
        draft: false,
        depth: 0,
        limit: 1000,
        pagination: false,
        where: {
          _status: {
            equals: 'published',
          },
        },
        select: {
          slug: true,
          updatedAt: true,
        },
      })

      const dateFallback = new Date().toISOString()

      const sitemap = results.docs
        ? results.docs
            .filter((post) => Boolean(post?.slug))
            .map((post) => ({
              loc: `${SITE_URL}/posts/${post?.slug}`,
              lastmod: post.updatedAt || dateFallback,
            }))
        : []

      return sitemap
    } catch (error) {
      // Return empty sitemap if database access fails (e.g., during build)
      console.warn('Failed to generate posts sitemap:', error)
      return []
    }
  },
  ['posts-sitemap'],
  {
    tags: ['posts-sitemap'],
  },
)

export async function GET() {
  const sitemap = await getPostsSitemap()

  return getServerSideSitemap(sitemap)
}
