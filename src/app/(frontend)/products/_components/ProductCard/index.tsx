'use client'

import type { Product } from '@/payload-types'
import { UnifiedCard } from '@/ui/web/components/UnifiedCard'
import { useTranslations } from '@/ui/web/providers/I18n'

const BILLING_TYPE_COLORS: Record<string, string> = {
  one_time: 'hsl(142 71% 45%)',
  subscription: 'hsl(217 91% 60%)',
}

function formatPrice(price: number, currency: string): string {
  const formatter = new Intl.NumberFormat(currency === 'ILS' ? 'he-IL' : 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
  return formatter.format(price)
}

interface ProductCardProps {
  product: Product
}

export function ProductCard({ product }: ProductCardProps) {
  const t = useTranslations('products')
  const currency = (product.currency as string) ?? 'ILS'
  const price = typeof product.price === 'number' ? product.price : 0
  const billingType = (product.billingType as string) ?? 'one_time'
  const accentColor = BILLING_TYPE_COLORS[billingType] ?? BILLING_TYPE_COLORS.one_time

  const priceLabel = formatPrice(price, currency)
  const billingLabel = billingType === 'subscription' ? t('subscriptionLabel') : t('oneTimeLabel')

  return (
    <UnifiedCard
      title={product.name ?? 'Product'}
      description={billingLabel}
      label={priceLabel}
      accentColor={accentColor}
      variant="lesson"
      cardHref={`/products/${product.slug}`}
    />
  )
}
