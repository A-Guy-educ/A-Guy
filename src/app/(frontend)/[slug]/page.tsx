import type { Metadata } from 'next'

import { PayloadRedirects } from '@/ui/web/PayloadRedirects'
import { draftMode } from 'next/headers'

import { generateMeta } from '@/infra/utils/generateMeta'
import { RenderBlocks } from '@/server/payload/blocks/RenderBlocks'
import { queryAllPageSlugs, queryPageBySlug } from '@/server/repos/queries/pages'
import { LivePreviewListener } from '@/ui/web/LivePreviewListener'
import { RenderHero } from '@/ui/web/heros/RenderHero'
import PageClient from './page.client'

export async function generateStaticParams() {
  try {
    const pages = await queryAllPageSlugs()
    return pages
  } catch {
    // Gracefully handle MongoDB connection failures during build
    // Return empty array to allow build to continue
    return []
  }
}

type Args = {
  params: Promise<{
    slug?: string
  }>
}

export default async function Page({ params: paramsPromise }: Args) {
  let draft = false
  try {
    const draftModeResult = await draftMode()
    draft = draftModeResult.isEnabled
  } catch {
    // During static generation, draftMode() is not available
    // Default to false (not in draft mode)
  }
  const { slug = 'home' } = await paramsPromise
  // Decode to support slugs with special characters
  const decodedSlug = decodeURIComponent(slug)
  const url = '/' + decodedSlug

  let page
  try {
    page = await queryPageBySlug({
      slug: decodedSlug,
    })
  } catch (error) {
    // Gracefully handle MongoDB connection failures during build
    console.warn('Failed to fetch page:', error)
    return (
      <article className="pt-section-md pb-section-lg">
        <PageClient />
        <PayloadRedirects disableNotFound url={url} />
        <div className="container">
          <p>Page content is temporarily unavailable.</p>
        </div>
      </article>
    )
  }

  if (!page) {
    return <PayloadRedirects url={url} />
  }

  const { hero, layout, defaultBlockSpacing } = page

  return (
    <article className="pt-section-md pb-section-lg">
      <PageClient />
      {/* Allows redirects for valid pages too */}
      <PayloadRedirects disableNotFound url={url} />

      {draft && <LivePreviewListener />}

      <RenderHero {...hero} />
      <RenderBlocks blocks={layout} defaultSpacing={defaultBlockSpacing} />
    </article>
  )
}

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const { slug = 'home' } = await paramsPromise
  // Decode to support slugs with special characters
  const decodedSlug = decodeURIComponent(slug)
  const page = await queryPageBySlug({
    slug: decodedSlug,
  })

  return generateMeta({ doc: page })
}
