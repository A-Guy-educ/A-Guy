import type { Post } from '@/payload-types'
import type { Metadata } from 'next'

import { RelatedPosts } from '@/server/payload/blocks/RelatedPosts/Component'
import { PayloadRedirects } from '@/ui/web/PayloadRedirects'
import RichText from '@/ui/web/RichText'

import { generateMeta } from '@/infra/utils/generateMeta'
import { queryAllPostSlugs, queryPostBySlug } from '@/server/repos/queries/posts'
import { PostHero } from '@/ui/web/heros/PostHero'
import PageClient from './page.client'

// Helper to filter valid related posts (remove null/non-object entries)
function getValidRelatedPosts(posts: Array<null | object | string>): Post[] {
  return posts.filter((p): p is Post => p !== null && typeof p === 'object') as Post[]
}

export async function generateStaticParams() {
  try {
    const params = await queryAllPostSlugs()
    return params
  } catch (error) {
    // Gracefully handle MongoDB connection failures during build
    // Return empty array to allow build to continue
    console.warn('Failed to generate static params for posts:', error)
    return []
  }
}

type Args = {
  params: Promise<{
    slug?: string
  }>
}

export default async function Post({ params: paramsPromise }: Args) {
  const { slug = '' } = await paramsPromise
  // Decode to support slugs with special characters
  const decodedSlug = decodeURIComponent(slug)
  const url = '/posts/' + decodedSlug
  const post = await queryPostBySlug({ slug: decodedSlug })

  if (!post) return <PayloadRedirects url={url} />

  return (
    <article className="pt-16 pb-16">
      <PageClient />

      {/* Allows redirects for valid pages too */}
      <PayloadRedirects disableNotFound url={url} />

      <PostHero post={post} />

      <div className="flex flex-col items-center gap-4 pt-8">
        <div className="container">
          <RichText className="max-w-[48rem] mx-auto" data={post.content} enableGutter={false} />
          {post.relatedPosts && post.relatedPosts.length > 0 && (
            <RelatedPosts
              className="mt-12 max-w-[52rem] lg:grid lg:grid-cols-subgrid col-start-1 col-span-3 grid-rows-[2fr]"
              docs={getValidRelatedPosts(post.relatedPosts)}
            />
          )}
        </div>
      </div>
    </article>
  )
}

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const { slug = '' } = await paramsPromise
  // Decode to support slugs with special characters
  const decodedSlug = decodeURIComponent(slug)
  const post = await queryPostBySlug({ slug: decodedSlug })

  return generateMeta({ doc: post })
}
