/**
 * Product Detail Page
 *
 * Displays product details (name, description, price, items) with a Buy button.
 * Authenticated users proceed to checkout; unauthenticated users are redirected to login.
 *
 * @fileType page
 * @domain billing
 */

import { notFound } from 'next/navigation'
import { getDirection } from '@/i18n/config'
import { getSystemLocale } from '@/i18n/server-locale'
import { pageMetadata } from '@/infra/seo/pageMetadata'
import { queryAllProductSlugs, queryProductBySlug } from '@/server/repos/queries/products'
import { ProductDetailContent } from './ProductDetailContent'

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  try {
    const slugs = await queryAllProductSlugs()
    return slugs
  } catch {
    return []
  }
}

export default async function ProductDetailPage({ params: paramsPromise }: Props) {
  const { slug } = await paramsPromise
  const decodedSlug = decodeURIComponent(slug)
  const product = await queryProductBySlug({ slug: decodedSlug })

  if (!product) {
    notFound()
  }

  const locale = await getSystemLocale()

  return (
    <div className="min-h-screen text-card-foreground antialiased" dir={getDirection(locale)}>
      <ProductDetailContent product={product} />
    </div>
  )
}

export async function generateMetadata({ params: paramsPromise }: Props) {
  const { slug } = await paramsPromise
  const decodedSlug = decodeURIComponent(slug)
  const product = await queryProductBySlug({ slug: decodedSlug })

  if (!product) {
    return {}
  }

  const locale = await getSystemLocale()
  const isHebrew = locale === 'he'

  return pageMetadata({
    title: isHebrew ? product.name : product.name,
    description: isHebrew ? `רכוש את ${product.name} עכשיו` : `Purchase ${product.name} now`,
  })
}
