'use client'

import { useTranslations } from '@/ui/web/providers/I18n'
import { Card, CardContent } from '@/ui/web/components/card'
import { Button } from '@/ui/web/components/button'
import { CheckCircle2, Loader2, AlertTriangle, RefreshCw } from 'lucide-react'

type TransactionStatus = 'pending' | 'succeeded' | 'failed' | 'refunded'

interface TransactionData {
  id: string
  status: TransactionStatus
  entitlementsGrantedAt?: string | null
  product?: { name?: string } | string
}

interface CheckoutSuccessContentProps {
  sessionId?: string
  transaction: TransactionData | null
  productName: string
}

export function CheckoutSuccessContent({
  sessionId,
  transaction,
  productName,
}: CheckoutSuccessContentProps) {
  const t = useTranslations('checkout')

  if (!sessionId) {
    return (
      <Card className="max-w-md mx-auto shadow-elevation-3 border border-border/60">
        <CardContent className="p-card-padding-lg text-center">
          <AlertTriangle className="w-12 h-12 text-warning mx-auto mb-4" />
          <h1 className="text-heading-lg font-black text-card-foreground mb-2">
            {t('success.missingSession')}
          </h1>
          <p className="text-body-md text-muted-foreground mb-6">
            {t('success.noSessionDescription')}
          </p>
          <Button onClick={() => (window.location.href = '/products')} className="w-full">
            {t('success.backToProducts')}
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!transaction) {
    return (
      <Card className="max-w-md mx-auto shadow-elevation-3 border border-border/60">
        <CardContent className="p-card-padding-lg text-center">
          <Loader2 className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
          <h1 className="text-heading-lg font-black text-card-foreground mb-2">
            {t('success.processing')}
          </h1>
          <p className="text-body-md text-muted-foreground mb-6">
            {t('success.processingDescription')}
          </p>
          <Button onClick={() => window.location.reload()} variant="outline" className="w-full">
            <RefreshCw className="w-4 h-4 me-2" />
            {t('success.refresh')}
          </Button>
        </CardContent>
      </Card>
    )
  }

  const isConfirmed = transaction.status === 'succeeded' && !!transaction.entitlementsGrantedAt
  const isFailed = transaction.status === 'failed' || transaction.status === 'refunded'

  if (isFailed) {
    return (
      <Card className="max-w-md mx-auto shadow-elevation-3 border border-border/60">
        <CardContent className="p-card-padding-lg text-center">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h1 className="text-heading-lg font-black text-card-foreground mb-2">
            {t('success.paymentFailed')}
          </h1>
          <p className="text-body-md text-muted-foreground mb-6">
            {t('success.paymentFailedDescription')}
          </p>
          <Button onClick={() => (window.location.href = '/products')} className="w-full">
            {t('success.backToProducts')}
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (isConfirmed) {
    return (
      <Card className="max-w-md mx-auto shadow-elevation-3 border border-border/60">
        <CardContent className="p-card-padding-lg text-center">
          <CheckCircle2 className="w-16 h-16 text-success mx-auto mb-4" />
          <h1 className="text-heading-lg font-black text-card-foreground mb-2">
            {t('success.confirmedTitle')}
          </h1>
          <p className="text-body-md text-muted-foreground mb-2">
            {t('success.confirmedDescription')}
          </p>
          {productName && (
            <p className="text-body-sm text-muted-foreground mb-6">
              {t('success.productLabel').replace('{product}', productName)}
            </p>
          )}
          <Button onClick={() => (window.location.href = '/')} className="w-full">
            {t('success.goHome')}
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Pending
  return (
    <Card className="max-w-md mx-auto shadow-elevation-3 border border-border/60">
      <CardContent className="p-card-padding-lg text-center">
        <Loader2 className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
        <h1 className="text-heading-lg font-black text-card-foreground mb-2">
          {t('success.pendingTitle')}
        </h1>
        <p className="text-body-md text-muted-foreground mb-2">{t('success.pendingDescription')}</p>
        {productName && (
          <p className="text-body-sm text-muted-foreground mb-6">
            {t('success.productLabel').replace('{product}', productName)}
          </p>
        )}
        <Button onClick={() => window.location.reload()} variant="outline" className="w-full">
          <RefreshCw className="w-4 h-4 me-2" />
          {t('success.refresh')}
        </Button>
      </CardContent>
    </Card>
  )
}
