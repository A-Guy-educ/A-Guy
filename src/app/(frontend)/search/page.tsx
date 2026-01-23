import type { Metadata } from 'next/types'

import { searchPosts } from '@/server/repos/queries/posts'
import { CollectionArchive } from '@/ui/web/CollectionArchive'
import { Search } from '@/ui/web/search/Component'
import PageClient from './page.client'

type Args = {
  searchParams: Promise<{
    q: string
  }>
}

export default async function Page({ searchParams: searchParamsPromise }: Args) {
  const { q: query } = await searchParamsPromise

  const result = query ? await searchPosts({ query }) : null
  const posts = result?.docs || []

  return (
    <div className="pt-24 pb-24">
      <PageClient />
      <div className="container mb-16">
        <div className="prose dark:prose-invert max-w-none text-center">
          <h1 className="mb-8 lg:mb-16">Search</h1>

          <div className="max-w-[50rem] mx-auto">
            <Search />
          </div>
        </div>
      </div>

      {posts.length > 0 ? (
        <CollectionArchive posts={posts} />
      ) : (
        <div className="container">No results found.</div>
      )}
    </div>
  )
}

export function generateMetadata(): Metadata {
  return {
    title: `Payload Website Template Search`,
  }
}
