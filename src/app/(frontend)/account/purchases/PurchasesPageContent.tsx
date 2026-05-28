'use client'

import { useTranslations } from '@/ui/web/providers/I18n'
import { PageTransition } from '@/ui/web/components/page-transition'
import { SystemLink } from '@/infra/loading/components/SystemLink'
import { Card, CardContent } from '@/ui/web/components/card'
import { Button } from '@/ui/web/components/button'
import { Package, RefreshCw, ExternalLink } from 'lucide-react'

export type TransactionStatus = 'pending' | 'succeeded' | 'failed' | 'refunded'
export type TransactionProvider = 'stripe' | 'paypal'

export interface TransactionWithProduct {
  id: string
  status: TransactionStatus
  amount: number
  currency: string
  createdAt: string
  provider: TransactionProvider
  productName: string | null
  productSlug: string | null
  couponCode: string | null
  refundedAmount: number | null
  refundedAt: string | null
}

interface PurchasesPageContentProps {
  transactions: TransactionWithProduct[]
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
    month: 'short',
    day: 'numeric',
  })
}

const STATUS_COLORS: Record<TransactionStatus, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-warning/10', text: 'text-warning', label: '' },
  succeeded: { bg: 'bg-success/10', text: 'text-success', label: '' },
  failed: { bg: 'bg-destructive/10', text: 'text-destructive', label: '' },
  refunded: { bg: 'bg-muted', text: 'text-muted-foreground', label: '' },
}

function StatusBadge({ status }: { status: TransactionStatus }) {
  const t = useTranslations('account.purchases')
  const colors = STATUS_COLORS[status]
  const label = t(`status.${status}`)

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-label font-medium ${colors.bg} ${colors.text}`}
    >
      {label}
    </span>
  )
}

function PurchaseRow({ transaction }: { transaction: TransactionWithProduct }) {
  const t = useTranslations('account.purchases')
  const locale = useTranslations('auth.account')
  const localeDir = locale('langCode') === 'he' ? 'he' : 'en'

  const amountDisplay = formatAmount(transaction.amount, transaction.currency)
  const dateDisplay = formatDate(transaction.createdAt, localeDir)
  const providerLabel = transaction.provider === 'stripe' ? 'Stripe' : 'PayPal'

  return (
    <SystemLink href={`/account/purchases/${transaction.id}`} className="block group">
      <Card className="transition-all duration-normal hover:shadow-card-hover hover:border-primary/20">
        <CardContent className="p-card-padding-sm flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Left: Product info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-body-md font-semibold text-foreground truncate">
                {transaction.productName || t('unknownProduct')}
              </h3>
              <StatusBadge status={transaction.status} />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-xs text-muted-foreground">
              <span>{amountDisplay}</span>
              <span className="text-border">|</span>
              <span>{providerLabel}</span>
              <span className="text-border">|</span>
              <span>{dateDisplay}</span>
              {transaction.couponCode && (
                <>
                  <span className="text-border">|</span>
                  <span className="text-primary">
                    {t('couponApplied').replace('{code}', transaction.couponCode)}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Right: Arrow */}
          <div className="flex-shrink-0 text-muted-foreground group-hover:text-primary transition-colors duration-normal">
            <ExternalLink className="w-4 h-4" />
          </div>
        </CardContent>
      </Card>
    </SystemLink>
  )
}

function EmptyState() {
  const t = useTranslations('account.purchases')

  return (
    <Card className="border-dashed">
      <CardContent className="p-card-padding-lg flex flex-col items-center text-center">
        <Package className="w-12 h-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-heading-sm font-bold text-foreground mb-2">{t('empty.title')}</h3>
        <p className="text-body-sm text-muted-foreground mb-6 max-w-sm">{t('empty.description')}</p>
        <Button asChild>
          <SystemLink href="/products">{t('empty.cta')}</SystemLink>
        </Button>
      </CardContent>
    </Card>
  )
}

export function PurchasesPageContent({ transactions }: PurchasesPageContentProps) {
  const t = useTranslations('account.purchases')

  return (
    <PageTransition>
      <div className="container py-section-md">
        <div className="mx-auto max-w-2xl space-y-content-gap">
          <div className="flex items-center justify-between">
            <h1 className="text-display-sm font-bold">{t('title')}</h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.location.reload()}
              className="text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="w-4 h-4 me-1" />
              {t('refresh')}
            </Button>
          </div>

          {transactions.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <PurchaseRow key={tx.id} transaction={tx} />
              ))}
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  )
}
