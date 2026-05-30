'use client'

import { useCallback, useState } from 'react'

import { useTranslations } from '@/ui/web/providers/I18n'
import { PageTransition } from '@/ui/web/components/page-transition'
import { SystemLink } from '@/infra/loading/components/SystemLink'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/web/components/card'
import { Button } from '@/ui/web/components/button'
import {
  ArrowLeft,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  Package,
  Key,
} from 'lucide-react'

export type TransactionStatus = 'pending' | 'succeeded' | 'failed' | 'refunded'
export type TransactionProvider = 'stripe' | 'paypal'

export interface TransactionDetailData {
  id: string
  status: TransactionStatus
  amount: number
  currency: string
  createdAt: string
  updatedAt: string
  provider: TransactionProvider
  productName: string | null
  productSlug: string | null
  couponCode: string | null
  refundedAmount: number | null
  refundedAt: string | null
  entitlementsGrantedAt: string | null
}

export interface EntitlementInfo {
  lessons: Array<{ id: string; title: string }>
  features: Array<{ key: string }>
}

interface TransactionDetailContentProps {
  transaction: TransactionDetailData | null
  entitlements: EntitlementInfo
  fetchError: boolean
}

function formatAmount(amountAgorot: number, currency: string): string {
  if (currency === 'ILS') {
    const shekels = amountAgorot / 100
    return `₪${shekels.toFixed(2)}`
  }
  const formatter = new Intl.NumberFormat(currency === 'ILS' ? 'he-IL' : 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
  return formatter.format(amountAgorot)
}

function formatDate(iso: string, locale: string): string {
  const dateLocale = locale === 'he' ? 'he-IL' : 'en-US'
  return new Date(iso).toLocaleDateString(dateLocale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const STATUS_CONFIG: Record<
  TransactionStatus,
  { icon: typeof CheckCircle2; color: string; textColor: string }
> = {
  pending: { icon: Clock, color: 'text-warning', textColor: 'text-warning' },
  succeeded: { icon: CheckCircle2, color: 'text-success', textColor: 'text-success' },
  failed: { icon: XCircle, color: 'text-destructive', textColor: 'text-destructive' },
  refunded: { icon: RotateCcw, color: 'text-muted-foreground', textColor: 'text-muted-foreground' },
}

function StatusDisplay({ status }: { status: TransactionStatus }) {
  const t = useTranslations('account.purchases')
  const cfg = STATUS_CONFIG[status]
  const Icon = cfg.icon
  const label = t(`status.${status}`)

  return (
    <div className="flex items-center gap-2">
      <Icon className={`w-5 h-5 ${cfg.color}`} />
      <span className={`text-body-md font-medium ${cfg.textColor}`}>{label}</span>
    </div>
  )
}

function RefreshButton({ transactionId }: { transactionId: string }) {
  const t = useTranslations('account.purchases')
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const res = await fetch(`/api/account/transactions/${transactionId}`)
      if (res.ok) {
        window.location.reload()
      }
    } finally {
      setRefreshing(false)
    }
  }, [transactionId])

  return (
    <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
      {refreshing ? (
        <Loader2 className="w-4 h-4 animate-spin me-1" />
      ) : (
        <RefreshCw className="w-4 h-4 me-1" />
      )}
      {t('refreshStatus')}
    </Button>
  )
}

function EntitlementsSection({ entitlements }: { entitlements: EntitlementInfo }) {
  const t = useTranslations('account.purchases')

  if (entitlements.lessons.length === 0 && entitlements.features.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-body-lg font-semibold">{t('unlockedItems')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {entitlements.lessons.length > 0 && (
          <div>
            <h4 className="text-body-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
              {t('courses')}
            </h4>
            <ul className="space-y-2">
              {entitlements.lessons.map((lesson) => (
                <li key={lesson.id} className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                  <span className="text-body-sm">{lesson.title}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {entitlements.features.length > 0 && (
          <div>
            <h4 className="text-body-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
              {t('features')}
            </h4>
            <ul className="space-y-2">
              {entitlements.features.map((feature) => (
                <li key={feature.key} className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-body-sm">{feature.key}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function RefundInfo({
  refundedAmount,
  refundedAt,
  currency,
}: {
  refundedAmount: number | null
  refundedAt: string | null
  currency: string
}) {
  const t = useTranslations('account.purchases')

  if (!refundedAmount || !refundedAt) return null

  const amountDisplay = formatAmount(refundedAmount, currency)

  return (
    <div className="rounded-lg bg-muted/50 p-card-padding-sm">
      <div className="flex items-center gap-2 mb-2">
        <RotateCcw className="w-4 h-4 text-muted-foreground" />
        <span className="text-body-sm font-medium text-muted-foreground">{t('refunded')}</span>
      </div>
      <div className="text-body-sm text-muted-foreground">
        <span>
          {t('refundedAmount')}: {amountDisplay}
        </span>
        <span className="mx-2">|</span>
        <span>{refundedAt ? formatDate(refundedAt, 'he') : ''}</span>
      </div>
    </div>
  )
}

export function TransactionDetailContent({
  transaction,
  entitlements,
  fetchError,
}: TransactionDetailContentProps) {
  const t = useTranslations('account.purchases')

  if (fetchError) {
    return (
      <PageTransition>
        <div className="container py-section-md">
          <div className="mx-auto max-w-2xl">
            <Card>
              <CardContent className="p-card-padding-lg text-center">
                <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
                <h2 className="text-heading-md font-bold mb-2">{t('errorLoading')}</h2>
                <Button variant="outline" onClick={() => window.location.reload()}>
                  <RefreshCw className="w-4 h-4 me-1" />
                  {t('tryAgain')}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageTransition>
    )
  }

  if (!transaction) {
    return (
      <PageTransition>
        <div className="container py-section-md">
          <div className="mx-auto max-w-2xl">
            <Card>
              <CardContent className="p-card-padding-lg text-center">
                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-heading-md font-bold mb-2">{t('notFound')}</h2>
                <Button asChild>
                  <SystemLink href="/account/purchases">
                    <ArrowLeft className="w-4 h-4 me-1" />
                    {t('backToPurchases')}
                  </SystemLink>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageTransition>
    )
  }

  const amountDisplay = formatAmount(transaction.amount, transaction.currency)
  const dateDisplay = formatDate(transaction.createdAt, 'he')
  const providerLabel = transaction.provider === 'stripe' ? 'Stripe' : 'PayPal'

  return (
    <PageTransition>
      <div className="container py-section-md">
        <div className="mx-auto max-w-2xl space-y-content-gap">
          {/* Back link */}
          <SystemLink
            href="/account/purchases"
            className="inline-flex items-center gap-1 text-body-sm text-muted-foreground hover:text-foreground transition-colors duration-normal"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('backToPurchases')}
          </SystemLink>

          {/* Header */}
          <div className="flex items-start justify-between gap-content-gap-sm">
            <div>
              <h1 className="text-display-sm font-bold mb-1">
                {transaction.productName || t('unknownProduct')}
              </h1>
              <p className="text-body-sm text-muted-foreground">
                {t('purchasedOn')} {dateDisplay}
              </p>
            </div>
            <StatusDisplay status={transaction.status} />
          </div>

          {/* Transaction details card */}
          <Card>
            <CardContent className="p-card-padding space-y-4">
              <div className="grid grid-cols-2 gap-content-gap-sm">
                <div>
                  <p className="text-body-xs text-muted-foreground mb-1">{t('amount')}</p>
                  <p className="text-body-lg font-bold">{amountDisplay}</p>
                </div>
                <div>
                  <p className="text-body-xs text-muted-foreground mb-1">{t('provider')}</p>
                  <p className="text-body-md">{providerLabel}</p>
                </div>
                <div>
                  <p className="text-body-xs text-muted-foreground mb-1">{t('transactionId')}</p>
                  <p className="text-body-xs font-mono text-muted-foreground">
                    {transaction.id.slice(0, 12)}...
                  </p>
                </div>
                <div>
                  <p className="text-body-xs text-muted-foreground mb-1">{t('status')}</p>
                  <p className="text-body-md">
                    <StatusDisplay status={transaction.status} />
                  </p>
                </div>
              </div>

              {transaction.couponCode && (
                <div className="pt-2 border-t border-border">
                  <p className="text-body-xs text-muted-foreground mb-1">{t('coupon')}</p>
                  <p className="text-body-sm font-medium text-primary">
                    {t('couponApplied').replace('{code}', transaction.couponCode)}
                  </p>
                </div>
              )}

              {transaction.status === 'pending' && (
                <div className="pt-2 border-t border-border flex items-center justify-between">
                  <p className="text-body-sm text-warning">{t('pendingHelpText')}</p>
                  <RefreshButton transactionId={transaction.id} />
                </div>
              )}

              {transaction.status === 'refunded' && (
                <RefundInfo
                  refundedAmount={transaction.refundedAmount}
                  refundedAt={transaction.refundedAt}
                  currency={transaction.currency}
                />
              )}
            </CardContent>
          </Card>

          {/* Entitlements section - only show for succeeded transactions */}
          {transaction.status === 'succeeded' && (
            <EntitlementsSection entitlements={entitlements} />
          )}

          {/* Product link */}
          {transaction.productSlug && transaction.status === 'succeeded' && (
            <div className="flex justify-center">
              <Button asChild variant="outline">
                <SystemLink href={`/products/${transaction.productSlug}`}>
                  {t('viewProduct')}
                </SystemLink>
              </Button>
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  )
}
