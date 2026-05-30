/**
 * Products Catalog Page
 *
 * Lists all active products for the user's tenant (or global products if no tenant).
 *
 * @fileType page
 * @domain billing
 */

import { getDirection } from '@/i18n/config'
import { getSystemLocale } from '@/i18n/server-locale'
import { pageMetadata } from '@/infra/seo/pageMetadata'
import { queryActiveProducts } from '@/server/repos/queries/products'
import { ProductCardGrid } from './_components/ProductCardGrid'
import { ProductsHeader } from './_components/ProductsHeader'
import { EmptyProducts } from './_components/EmptyProducts'

export const revalidate = 60

export default async function ProductsPage() {
  const locale = await getSystemLocale()
  const products = await queryActiveProducts()

  return (
    <div className="min-h-screen text-card-foreground antialiased" dir={getDirection(locale)}>
      <ProductsHeader />

      <div className="max-w-7xl mx-auto px-6 py-20">
        {products.length === 0 ? <EmptyProducts /> : <ProductCardGrid products={products} />}
      </div>
    </div>
  )
}

export async function generateMetadata() {
  const locale = await getSystemLocale()
  const isHebrew = locale === 'he'

  return pageMetadata({
    title: isHebrew ? 'חנות המוצרים' : 'Products',
    description: isHebrew ? 'עיין במוצרים הזמינים שלנו' : 'Browse our available products',
  })
}
