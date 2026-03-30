import type { Metadata } from 'next/types'

import { searchPosts } from '@/server/repos/queries/posts'
import { searchCourseContent } from '@/server/repos/queries/course-search'
import { CollectionArchive } from '@/ui/web/CollectionArchive'
import { Search } from '@/ui/web/search/Component'
import { SystemLink } from '@/infra/loading/components/SystemLink'
import { BookOpen, FileText } from 'lucide-react'
import PageClient from './page.client'

type Args = {
  searchParams: Promise<{
    q: string
  }>
}

export default async function Page({ searchParams: searchParamsPromise }: Args) {
  const { q: query } = await searchParamsPromise

  const [postResult, courseResults] = await Promise.all([
    query ? searchPosts({ query }) : null,
    query ? searchCourseContent({ query }) : null,
  ])

  const posts = postResult?.docs || []
  const hasResults = posts.length > 0 || (courseResults && courseResults.length > 0)

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

      {!query ? null : !hasResults ? (
        <div className="container">No results found.</div>
      ) : (
        <>
          {/* Course Content Results */}
          {courseResults && courseResults.length > 0 && (
            <div className="container mb-16">
              <h2 className="text-display-xs font-bold mb-6">Courses & Lessons</h2>
              <div className="grid gap-3">
                {courseResults.map((result) => (
                  <SystemLink
                    key={result.id}
                    href={result.url}
                    className="flex items-center gap-content-gap p-card-padding-sm rounded-lg border border-border bg-card hover:bg-muted transition-colors"
                  >
                    {result.type === 'lesson' ? (
                      <BookOpen className="w-5 h-5 text-primary shrink-0" />
                    ) : (
                      <FileText className="w-5 h-5 text-primary shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-body-md font-semibold text-foreground truncate">
                        {result.title}
                      </p>
                      <p className="text-body-sm text-muted-foreground truncate">
                        {result.subtitle}
                      </p>
                    </div>
                  </SystemLink>
                ))}
              </div>
            </div>
          )}

          {/* Blog Post Results */}
          {posts.length > 0 && <CollectionArchive posts={posts} />}
        </>
      )}
    </div>
  )
}

export function generateMetadata(): Metadata {
  return {
    title: `Search - A-Guy`,
  }
}
