import { getServerSideSitemap } from 'next-sitemap'
import { unstable_cache } from 'next/cache'

// Force dynamic rendering to avoid build-time tracing issues
export const dynamic = 'force-dynamic'

const getPagesSitemap = unstable_cache(
  async () => {
    const SITE_URL =
      process.env.NEXT_PUBLIC_SERVER_URL ||
      process.env.VERCEL_PROJECT_PRODUCTION_URL ||
      'https://example.com'

    const dateFallback = new Date().toISOString()

    const defaultSitemap = [
      {
        loc: `${SITE_URL}/search`,
        lastmod: dateFallback,
      },
      {
        loc: `${SITE_URL}/posts`,
        lastmod: dateFallback,
      },
    ]

    // Return default sitemap if DATABASE_URL is not available (e.g., during build)
    if (!process.env.DATABASE_URL) {
      return defaultSitemap
    }

    try {
      // Dynamically import to avoid module-level errors during build
      const { getPayload } = await import('payload')
      const config = await import('@payload-config')
      const payload = await getPayload({ config: config.default })

      const results = await payload.find({
        collection: 'pages',
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

      const sitemap = results.docs
        ? results.docs
            .filter((page) => Boolean(page?.slug))
            .map((page) => {
              return {
                loc: page?.slug === 'home' ? `${SITE_URL}/` : `${SITE_URL}/${page?.slug}`,
                lastmod: page.updatedAt || dateFallback,
              }
            })
        : []

      return [...defaultSitemap, ...sitemap]
    } catch (error) {
      // Return default sitemap if database access fails (e.g., during build)
      console.warn('Failed to generate pages sitemap:', error)
      return defaultSitemap
    }
  },
  ['pages-sitemap'],
  {
    tags: ['pages-sitemap'],
  },
)

export async function GET() {
  const sitemap = await getPagesSitemap()

  return getServerSideSitemap(sitemap)
}
