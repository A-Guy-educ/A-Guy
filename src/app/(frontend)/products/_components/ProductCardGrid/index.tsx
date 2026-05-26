'use client'

import type { Product } from '@/payload-types'
import { StaggerGrid, StaggerItem } from '@/ui/web/components/motion'
import { ProductCard } from '../ProductCard'

interface ProductCardGridProps {
  products: Product[]
}

export function ProductCardGrid({ products }: ProductCardGridProps) {
  return (
    <StaggerGrid className="grid gap-content-gap-xl md:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <StaggerItem key={product.id}>
          <ProductCard product={product} />
        </StaggerItem>
      ))}
    </StaggerGrid>
  )
}
