import type { Metadata } from 'next/types'

import { searchPosts } from '@/server/repos/queries/posts'
import { searchCourseContent } from '@/server/repos/queries/course-search'
import { CollectionArchive } from '@/ui/web/CollectionArchive'
import { Search } from '@/ui/web/search/Component'
import { SystemLink } from '@/infra/loading/components/SystemLink'
import { BookOpen, FileText, SearchX } from 'lucide-react'
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
        <div className="container">
          <div className="text-center py-section-lg">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <SearchX className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <p className="text-body-lg font-medium text-muted-foreground">No results found</p>
            <p className="text-body-sm text-muted-foreground/60 mt-1">
              Try a different search term
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Course Content Results */}
          {courseResults && courseResults.length > 0 && (
            <div className="container mb-16">
              <h2 className="text-heading-xl font-bold mb-6">Courses & Lessons</h2>
              <div className="grid gap-3">
                {courseResults.map((result) => (
                  <SystemLink
                    key={result.id}
                    href={result.url}
                    className="flex items-center gap-content-gap p-card-padding-sm rounded-lg border border-border bg-card hover:bg-muted transition-colors duration-normal"
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
