'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { useCurrentUser } from '@/client/hooks/useCurrentUser'
import { useTranslations } from '@/ui/web/providers/I18n'
import { Button } from '@/ui/web/components/button'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface BuyButtonProps {
  productId: string
  productName: string
  couponCode?: string
  discountedAmount?: number
}

export function BuyButton({ productId, productName: _productName, couponCode }: BuyButtonProps) {
  const t = useTranslations('products')
  const router = useRouter()
  const { user, isLoading: isAuthLoading } = useCurrentUser()
  const [isLoading, setIsLoading] = useState(false)

  if (isAuthLoading) {
    return (
      <Button disabled className="w-full h-14 text-body-md font-bold rounded-xl" size="lg">
        <Loader2 className="w-5 h-5 animate-spin me-2" />
      </Button>
    )
  }

  if (!user) {
    return (
      <Button
        onClick={() => {
          const returnTo = encodeURIComponent(`/products/${productId}`)
          router.push(`/login?returnTo=${returnTo}`)
        }}
        className="w-full h-14 text-body-md font-bold rounded-xl"
        size="lg"
      >
        {t('loginToBuy')}
      </Button>
    )
  }

  const handleBuy = async () => {
    setIsLoading(true)
    try {
      const body: Record<string, string> = { productId }
      if (couponCode) {
        body.couponCode = couponCode
      }

      const res = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        const errorKey = data.error ?? 'checkout_failed'
        const errorMessages: Record<string, string> = {
          authentication_required: t('errors.authRequired'),
          product_not_found: t('errors.productNotFound'),
          product_not_active: t('errors.productNotActive'),
          invalid_coupon: t('errors.invalidCoupon'),
          checkout_failed: t('errors.checkoutFailed'),
        }
        toast.error(errorMessages[errorKey] ?? t('errors.checkoutFailed'))
        setIsLoading(false)
        return
      }

      window.location.href = data.checkoutUrl
    } catch {
      toast.error(t('errors.checkoutFailed'))
      setIsLoading(false)
    }
  }

  return (
    <Button
      onClick={handleBuy}
      disabled={isLoading}
      className="w-full h-14 text-body-md font-bold rounded-xl"
      size="lg"
    >
      {isLoading ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin me-2" />
          {t('redirecting')}
        </>
      ) : (
        t('buyButton')
      )}
    </Button>
  )
}
