'use client'

import { useState } from 'react'
import Link from 'next/link'

import type { Product } from '@/payload-types'
import { BuyButton } from './BuyButton'
import { CouponInput } from './CouponInput'
import { useTranslations } from '@/ui/web/providers/I18n'

interface ProductDetailContentProps {
  product: Product
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

export function ProductDetailContent({ product }: ProductDetailContentProps) {
  const t = useTranslations('products')
  const currency = (product.currency as string) ?? 'ILS'
  const price = typeof product.price === 'number' ? product.price : 0
  const billingType = (product.billingType as string) ?? 'one_time'

  const billingLabel = billingType === 'subscription' ? t('subscriptionLabel') : t('oneTimeLabel')

  const interval = (product.interval as string) ?? 'month'
  const intervalLabel = interval === 'year' ? t('perYear') : t('perMonth')

  const priceDisplay = formatPrice(price, currency)
  const periodDisplay = billingType === 'subscription' ? ` / ${intervalLabel}` : ''

  const [couponCode, setCouponCode] = useState<string>('')
  const [discountedAmount, setDiscountedAmount] = useState<number | null>(null)

  return (
    <div className="max-w-3xl mx-auto px-6 py-section-md">
      {/* Breadcrumb */}
      <nav className="mb-8" aria-label="breadcrumb">
        <ol className="flex items-center gap-content-gap-xs text-body-sm text-muted-foreground">
          <li>
            <Link
              href="/products"
              className="hover:text-foreground transition-colors duration-normal"
            >
              {t('catalogTitle')}
            </Link>
          </li>
          <li className="text-muted-foreground/50">/</li>
          <li className="text-foreground font-medium" aria-current="page">
            {product.name}
          </li>
        </ol>
      </nav>

      {/* Product Card */}
      <div className="bg-card rounded-2xl border border-border/60 shadow-card overflow-hidden">
        {/* Header */}
        <div className="p-card-padding-lg border-b border-border/40">
          <div className="flex items-start justify-between gap-content-gap">
            <div className="flex-1">
              <h1 className="text-heading-xl font-black text-card-foreground">{product.name}</h1>
              <p className="text-body-lg text-muted-foreground mt-2">{billingLabel}</p>
            </div>
            <div className="text-end">
              {discountedAmount !== null && discountedAmount < price * 100 ? (
                <>
                  <span className="text-display-sm font-black text-primary">
                    {formatPrice(discountedAmount, currency)}
                  </span>
                  <span className="text-body-sm text-muted-foreground line-through ms-2">
                    {priceDisplay}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-display-sm font-black text-primary">{priceDisplay}</span>
                  <span className="text-body-md text-muted-foreground">{periodDisplay}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Product Items */}
        {Array.isArray(product.items) && product.items.length > 0 && (
          <div className="p-card-padding-lg border-b border-border/40">
            <h2 className="text-heading-sm font-bold text-card-foreground mb-4">
              {t('includedItems')}
            </h2>
            <ul className="space-y-2">
              {product.items.map((item, index) => {
                const itemObj = item as { lesson?: { title?: string }; featureKey?: string }
                return (
                  <li
                    key={index}
                    className="flex items-center gap-content-gap-xs text-body-sm text-muted-foreground"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    {itemObj.lesson?.title ?? itemObj.featureKey ?? t('items.unnamed')}
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* Actions: Coupon + Buy */}
        <div className="p-card-padding-lg">
          <CouponInput
            productId={product.id}
            currency={currency}
            onCouponValidated={(code, _orig, discounted) => {
              setCouponCode(code)
              setDiscountedAmount(discounted)
            }}
            onCouponCleared={() => {
              setCouponCode('')
              setDiscountedAmount(null)
            }}
          />
          <div className="mt-6">
            <BuyButton
              productId={product.id}
              productSlug={product.slug ?? ''}
              productName={product.name ?? ''}
              couponCode={couponCode || undefined}
              discountedAmount={discountedAmount ?? undefined}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
