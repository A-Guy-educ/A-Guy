'use client'

import { useTranslations } from '@/ui/web/providers/I18n'
import { Card, CardContent } from '@/ui/web/components/card'
import { Button } from '@/ui/web/components/button'
import { XCircle, ArrowRight } from 'lucide-react'

interface ProductData {
  id: string
  name?: string
  slug?: string
}

interface CheckoutCancelContentProps {
  productId?: string
  product: ProductData | null
}

export function CheckoutCancelContent({ productId, product }: CheckoutCancelContentProps) {
  const t = useTranslations('checkout')

  const productSlug = product?.slug ?? product?.id ?? productId

  return (
    <Card className="max-w-md mx-auto shadow-elevation-3 border border-border/60">
      <CardContent className="p-card-padding-lg text-center">
        <XCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-heading-lg font-black text-card-foreground mb-2">
          {t('cancel.title')}
        </h1>
        <p className="text-body-md text-muted-foreground mb-2">{t('cancel.description')}</p>
        {product?.name && (
          <p className="text-body-sm text-muted-foreground mb-6">
            {t('cancel.productLabel').replace('{product}', product.name)}
          </p>
        )}

        <div className="flex flex-col gap-3">
          {productSlug && (
            <Button
              onClick={() => (window.location.href = `/products/${productSlug}`)}
              className="w-full"
            >
              <ArrowRight className="w-4 h-4 me-2 rtl:rotate-180" />
              {t('cancel.backToProduct')}
            </Button>
          )}
          <Button
            onClick={() => (window.location.href = '/products')}
            variant="outline"
            className="w-full"
          >
            {t('cancel.browseProducts')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
