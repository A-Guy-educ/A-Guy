'use client'

import { useState } from 'react'

import { validateCouponAction } from '../validate-coupon-action'
import { Button } from '@/ui/web/components/button'
import { Input } from '@/ui/web/components/input'
import { Label } from '@/ui/web/components/label'
import { useTranslations } from '@/ui/web/providers/I18n'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'

interface CouponInputProps {
  productId: string
  currency: string
  onCouponValidated: (couponCode: string, originalAmount: number, discountedAmount: number) => void
  onCouponCleared: () => void
}

function formatPrice(price: number, currency: string): string {
  const formatter = new Intl.NumberFormat(currency === 'ILS' ? 'he-IL' : 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
  return formatter.format(price / 100)
}

export function CouponInput({
  productId,
  currency,
  onCouponValidated,
  onCouponCleared,
}: CouponInputProps) {
  const t = useTranslations('products')
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [validatedCode, setValidatedCode] = useState('')
  const [discountedAmount, setDiscountedAmount] = useState<number | null>(null)

  const handleApply = async () => {
    if (!code.trim()) return

    setStatus('loading')
    setErrorMsg('')

    const result = await validateCouponAction(productId, code)

    if (!result.success) {
      setStatus('error')
      setErrorMsg(t('errors.invalidCoupon'))
      setValidatedCode('')
      setDiscountedAmount(null)
      onCouponCleared()
      return
    }

    setStatus('success')
    setValidatedCode(
      result.discountType === 'percentage'
        ? `${result.discountValue}%`
        : formatPrice(result.discountValue, currency),
    )
    setDiscountedAmount(result.discountedAmount)
    onCouponValidated(code, result.originalAmount, result.discountedAmount)
  }

  const handleClear = () => {
    setCode('')
    setStatus('idle')
    setErrorMsg('')
    setValidatedCode('')
    setDiscountedAmount(null)
    onCouponCleared()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="coupon-code">{t('couponLabel')}</Label>
          <Input
            id="coupon-code"
            value={code}
            onChange={(e) => {
              setCode(e.target.value)
              if (status !== 'idle') {
                setStatus('idle')
                setErrorMsg('')
              }
            }}
            placeholder={t('couponPlaceholder')}
            disabled={status === 'loading'}
            className="h-12"
          />
        </div>
        <Button
          onClick={handleApply}
          disabled={!code.trim() || status === 'loading'}
          variant="outline"
          size="sm"
          className="h-12 px-4 shrink-0"
        >
          {status === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : t('applyCoupon')}
        </Button>
      </div>

      {status === 'success' && (
        <div className="flex items-center gap-2 text-body-sm text-success">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>
            {t('couponApplied')
              .replace('{code}', validatedCode)
              .replace('{amount}', formatPrice(discountedAmount ?? 0, currency))}
          </span>
          <button
            onClick={handleClear}
            className="ms-auto text-muted-foreground hover:text-foreground transition-colors duration-normal text-body-xs underline"
          >
            {t('remove')}
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center gap-2 text-body-sm text-destructive">
          <XCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  )
}
