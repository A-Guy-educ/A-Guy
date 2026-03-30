import type { Metadata } from 'next/types'

import { queryPublishedPosts } from '@/server/repos/queries/posts'
import { CollectionArchive } from '@/ui/web/CollectionArchive'
import { PageRange } from '@/ui/web/PageRange'
import { Pagination } from '@/ui/web/Pagination'
import PageClient from './page.client'

// Note: Cannot use 'force-static' because the layout uses dynamic APIs (headers, cookies)
// The page will still be statically generated at build time, but can be revalidated
export const revalidate = 600

export default async function Page() {
  const result = await queryPublishedPosts({ limit: 12 })

  return (
    <div className="pt-section-lg pb-section-lg">
      <PageClient />
      <div className="container mb-section-md">
        <h1 className="text-display-md text-foreground">Posts</h1>
      </div>

      <div className="container mb-content-gap-lg">
        <PageRange
          collection="posts"
          currentPage={result.page}
          limit={12}
          totalDocs={result.totalDocs}
        />
      </div>

      <CollectionArchive posts={result.docs} />

      <div className="container">
        {result.totalPages > 1 && result.page && (
          <Pagination page={result.page} totalPages={result.totalPages} />
        )}
      </div>
    </div>
  )
}

export function generateMetadata(): Metadata {
  return {
    title: `Payload Website Template Posts`,
  }
}
