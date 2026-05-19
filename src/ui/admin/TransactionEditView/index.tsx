/**
 * TransactionPaymentDetail — comprehensive payment detail view for transaction edit sidebar.
 *
 * Displays transaction summary, user info, product info, webhook/metadata,
 * refund history, and preserves the existing refund action button.
 *
 * @fileType component
 * @domain admin
 * @ai-summary Full payment timeline view replacing Payload's default table layout
 */

'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useDocumentInfo, useFormFields, useTranslation } from '@payloadcms/ui'
import { ExternalLink, ChevronDown } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

type TransactionStatus = 'pending' | 'succeeded' | 'failed' | 'refunded'
type BillingType = 'one_time' | 'subscription'
type Interval = 'month' | 'year'
type Provider = 'stripe' | 'paypal'

interface TransactionDoc {
  id: string
  status: TransactionStatus
  provider: Provider
  providerTransactionId: string
  amount: number
  currency: string
  metadata: Record<string, unknown> | null
  successUrl: string | null
  cancelUrl: string | null
  errorMessage: string | null
  createdAt: string
  updatedAt: string
  user: { id: string; email?: string; name?: string } | string
  product:
    | {
        id: string
        name: string
        slug: string
        billingType: BillingType
        interval: Interval | null
        price: number
        currency: string
      }
    | string
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const cardStyle = {
  padding: 16,
  backgroundColor: 'var(--theme-elevation-50)',
  border: '1px solid var(--theme-elevation-200)',
  borderRadius: 4,
}

const sectionTitleStyle = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  color: 'var(--theme-elevation-600)',
  marginBottom: 8,
}

const detailRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '4px 0',
}

const detailLabelStyle = {
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--theme-elevation-500)',
  minWidth: 100,
}

const detailValueStyle = {
  fontSize: 13,
  color: 'var(--theme-elevation-1000)',
}

const detailLinkStyle = {
  fontSize: 13,
  color: 'var(--theme-primary)',
  textDecoration: 'underline',
  cursor: 'pointer',
}

const loadingStyle = {
  padding: '16px 0',
  fontSize: 13,
  color: 'var(--theme-elevation-500)',
  fontStyle: 'italic',
}

const errorBannerStyle = {
  padding: '8px 12px',
  marginBottom: 12,
  fontSize: 13,
  color: 'var(--theme-error)',
  backgroundColor: 'var(--theme-error-100)',
  borderRadius: 4,
}

const metadataPreStyle = {
  fontSize: 12,
  fontFamily: 'monospace',
  background: 'var(--theme-elevation-0)',
  padding: 12,
  borderRadius: 4,
  overflowX: 'auto' as const,
  maxHeight: 300,
  whiteSpace: 'pre-wrap' as const,
  wordBreak: 'break-word' as const,
}

// ── Strings ───────────────────────────────────────────────────────────────────

interface TransactionStrings {
  paymentDetail: string
  userInfo: string
  productInfo: string
  webhookMetadata: string
  refundHistory: string
  status: string
  provider: string
  amount: string
  createdAt: string
  updatedAt: string
  userEmail: string
  userName: string
  userId: string
  productName: string
  productSlug: string
  billingType: string
  interval: string
  price: string
  providerTransactionId: string
  successUrl: string
  cancelUrl: string
  metadata: string
  errorMessage: string
  loading: string
  noUser: string
  noProduct: string
  noMetadata: string
  billingOneTime: string
  billingSubscription: string
  intervalMonth: string
  intervalYear: string
}

const he: TransactionStrings = {
  paymentDetail: 'פרטי תשלום',
  userInfo: 'מידע על המשתמש',
  productInfo: 'מידע על המוצר',
  webhookMetadata: 'נתוני Webhook',
  refundHistory: 'היסטוריית החזרים',
  status: 'סטטוס',
  provider: 'ספק',
  amount: 'סכום',
  createdAt: 'נוצר ב',
  updatedAt: 'עודכן ב',
  userEmail: 'אימייל',
  userName: 'שם',
  userId: 'מזהה משתמש',
  productName: 'שם המוצר',
  productSlug: 'Slug',
  billingType: 'סוג חיוב',
  interval: 'מרווח זמן',
  price: 'מחיר',
  providerTransactionId: 'מזהה עסקה של הספק',
  successUrl: 'URL הצלחה',
  cancelUrl: 'URL ביטול',
  metadata: 'metadata',
  errorMessage: 'הודעת שגיאה',
  loading: 'טוען...',
  noUser: 'אין משתמש',
  noProduct: 'אין מוצר',
  noMetadata: 'אין מטאדאטה',
  billingOneTime: 'חד-פעמי',
  billingSubscription: 'מנוי',
  intervalMonth: 'חודשי',
  intervalYear: 'שנתי',
}

const en: TransactionStrings = {
  paymentDetail: 'Payment Details',
  userInfo: 'User Information',
  productInfo: 'Product Information',
  webhookMetadata: 'Webhook / Metadata',
  refundHistory: 'Refund History',
  status: 'Status',
  provider: 'Provider',
  amount: 'Amount',
  createdAt: 'Created',
  updatedAt: 'Updated',
  userEmail: 'Email',
  userName: 'Name',
  userId: 'User ID',
  productName: 'Product Name',
  productSlug: 'Slug',
  billingType: 'Billing Type',
  interval: 'Interval',
  price: 'Price',
  providerTransactionId: 'Provider Transaction ID',
  successUrl: 'Success URL',
  cancelUrl: 'Cancel URL',
  metadata: 'Metadata',
  errorMessage: 'Error Message',
  loading: 'Loading...',
  noUser: 'No user',
  noProduct: 'No product',
  noMetadata: 'No metadata',
  billingOneTime: 'One-time',
  billingSubscription: 'Subscription',
  intervalMonth: 'Monthly',
  intervalYear: 'Yearly',
}

function getTransactionStrings(lang: string): TransactionStrings {
  return lang === 'he' ? he : en
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function resolveId(val: unknown): string | null {
  if (!val) return null
  if (typeof val === 'string') return val
  if (typeof val === 'object' && val !== null && 'id' in val)
    return String((val as { id: unknown }).id)
  return null
}

function formatAmount(amountAgorot: number, currency: string): string {
  if (currency === 'ILS') {
    const shekels = amountAgorot / 100
    return `₪${shekels.toFixed(2)}`
  }
  return `${amountAgorot} ${currency}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('he-IL', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatUrl(url: string): { display: string; truncated: string } {
  try {
    const u = new URL(url)
    return {
      display: url,
      truncated: u.pathname + u.search.slice(0, 60) + (u.search.length > 60 ? '…' : ''),
    }
  } catch {
    return { display: url, truncated: url.slice(0, 80) }
  }
}

// ── Status badge ───────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<TransactionStatus, { bg: string; color: string; labelHe: string }> = {
  pending: {
    bg: 'var(--theme-warning-100)',
    color: 'var(--theme-warning)',
    labelHe: 'בהמתנה',
  },
  succeeded: {
    bg: 'var(--theme-success-100)',
    color: 'var(--theme-success)',
    labelHe: 'הושלם',
  },
  failed: {
    bg: 'var(--theme-error-100)',
    color: 'var(--theme-error)',
    labelHe: 'נכשל',
  },
  refunded: {
    bg: 'var(--theme-elevation-150)',
    color: 'var(--theme-elevation-600)',
    labelHe: 'הוחזר',
  },
}

function StatusBadge({ status }: { status: TransactionStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 3,
        fontSize: 11,
        fontWeight: 600,
        backgroundColor: cfg.bg,
        color: cfg.color,
      }}
    >
      {cfg.labelHe}
    </span>
  )
}

// ── Section: Transaction Summary ────────────────────────────────────────────────

function TransactionSummarySection({ tx, s }: { tx: TransactionDoc; s: TransactionStrings }) {
  const providerLabel = tx.provider === 'stripe' ? 'Stripe' : 'PayPal'
  const amountDisplay = formatAmount(tx.amount, tx.currency)

  return (
    <div style={cardStyle}>
      <div style={sectionTitleStyle}>{s.paymentDetail}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={detailRowStyle}>
          <span style={detailLabelStyle}>{s.status}</span>
          <StatusBadge status={tx.status} />
        </div>
        <div style={detailRowStyle}>
          <span style={detailLabelStyle}>{s.provider}</span>
          <span style={detailValueStyle}>{providerLabel}</span>
        </div>
        <div style={detailRowStyle}>
          <span style={detailLabelStyle}>{s.amount}</span>
          <span style={{ ...detailValueStyle, fontWeight: 700, fontSize: 15 }}>
            {amountDisplay}
          </span>
        </div>
        <div style={detailRowStyle}>
          <span style={detailLabelStyle}>{s.createdAt}</span>
          <span style={detailValueStyle}>{formatDate(tx.createdAt)}</span>
        </div>
        <div style={detailRowStyle}>
          <span style={detailLabelStyle}>{s.updatedAt}</span>
          <span style={detailValueStyle}>{formatDate(tx.updatedAt)}</span>
        </div>
      </div>
    </div>
  )
}

// ── Section: User Info ─────────────────────────────────────────────────────────

function UserInfoSection({
  userId,
  email,
  name,
  s,
}: {
  userId: string
  email?: string
  name?: string
  s: TransactionStrings
}) {
  return (
    <div style={cardStyle}>
      <div style={sectionTitleStyle}>{s.userInfo}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={detailRowStyle}>
          <span style={detailLabelStyle}>{s.userEmail}</span>
          {email ? (
            <a href={`/admin/collections/users/${userId}`} style={detailLinkStyle}>
              {email}
            </a>
          ) : (
            <span
              style={{
                ...detailValueStyle,
                fontStyle: 'italic',
                color: 'var(--theme-elevation-500)',
              }}
            >
              {s.noUser}
            </span>
          )}
        </div>
        <div style={detailRowStyle}>
          <span style={detailLabelStyle}>{s.userName}</span>
          <span style={detailValueStyle}>{name || '—'}</span>
        </div>
        <div style={detailRowStyle}>
          <span style={detailLabelStyle}>{s.userId}</span>
          <span
            style={{
              ...detailValueStyle,
              fontFamily: 'monospace',
              fontSize: 11,
            }}
          >
            {userId.slice(0, 12)}…
          </span>
        </div>
        <div>
          <a
            href={`/admin/collections/users/${userId}`}
            style={{
              ...detailLinkStyle,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <ExternalLink size={12} /> פתח פרופיל משתמש
          </a>
        </div>
      </div>
    </div>
  )
}

// ── Section: Product Info ──────────────────────────────────────────────────────

function ProductInfoSection({
  product,
  s,
}: {
  product: TransactionDoc['product']
  s: TransactionStrings
}) {
  if (!product || typeof product === 'string') {
    return (
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>{s.productInfo}</div>
        <p
          style={{
            fontSize: 13,
            color: 'var(--theme-elevation-500)',
            fontStyle: 'italic',
          }}
        >
          {s.noProduct}
        </p>
      </div>
    )
  }

  const billingTypeLabel =
    product.billingType === 'subscription' ? s.billingSubscription : s.billingOneTime
  const intervalLabel =
    product.interval === 'month'
      ? s.intervalMonth
      : product.interval === 'year'
        ? s.intervalYear
        : null
  const priceDisplay = formatAmount(product.price, product.currency)

  return (
    <div style={cardStyle}>
      <div style={sectionTitleStyle}>{s.productInfo}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={detailRowStyle}>
          <span style={detailLabelStyle}>{s.productName}</span>
          <span style={detailValueStyle}>{product.name}</span>
        </div>
        <div style={detailRowStyle}>
          <span style={detailLabelStyle}>{s.productSlug}</span>
          <span
            style={{
              ...detailValueStyle,
              fontFamily: 'monospace',
              fontSize: 11,
            }}
          >
            {product.slug}
          </span>
        </div>
        <div style={detailRowStyle}>
          <span style={detailLabelStyle}>{s.billingType}</span>
          <span style={detailValueStyle}>{billingTypeLabel}</span>
        </div>
        {intervalLabel && (
          <div style={detailRowStyle}>
            <span style={detailLabelStyle}>{s.interval}</span>
            <span style={detailValueStyle}>{intervalLabel}</span>
          </div>
        )}
        <div style={detailRowStyle}>
          <span style={detailLabelStyle}>{s.price}</span>
          <span style={{ ...detailValueStyle, fontWeight: 700 }}>{priceDisplay}</span>
        </div>
        <div>
          <a
            href={`/admin/collections/products/${product.id}`}
            style={{
              ...detailLinkStyle,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <ExternalLink size={12} /> פתח מוצר
          </a>
        </div>
      </div>
    </div>
  )
}

// ── Section: Webhook / Metadata ────────────────────────────────────────────────

function MetadataSection({ tx, s }: { tx: TransactionDoc; s: TransactionStrings }) {
  const [expanded, setExpanded] = useState(false)
  const hasContent = tx.metadata || tx.successUrl || tx.cancelUrl || tx.providerTransactionId

  return (
    <div style={cardStyle}>
      <div style={sectionTitleStyle}>{s.webhookMetadata}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tx.providerTransactionId && (
          <div style={detailRowStyle}>
            <span style={detailLabelStyle}>{s.providerTransactionId}</span>
            <span
              style={{
                ...detailValueStyle,
                fontFamily: 'monospace',
                fontSize: 11,
                wordBreak: 'break-all',
              }}
            >
              {tx.providerTransactionId}
            </span>
          </div>
        )}
        {tx.successUrl && (
          <div style={detailRowStyle}>
            <span style={detailLabelStyle}>{s.successUrl}</span>
            <a
              href={tx.successUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                ...detailLinkStyle,
                fontSize: 11,
                maxWidth: 200,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'block',
              }}
              title={tx.successUrl}
            >
              <ExternalLink size={11} /> {formatUrl(tx.successUrl).truncated}
            </a>
          </div>
        )}
        {tx.cancelUrl && (
          <div style={detailRowStyle}>
            <span style={detailLabelStyle}>{s.cancelUrl}</span>
            <a
              href={tx.cancelUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                ...detailLinkStyle,
                fontSize: 11,
                maxWidth: 200,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'block',
              }}
              title={tx.cancelUrl}
            >
              <ExternalLink size={11} /> {formatUrl(tx.cancelUrl).truncated}
            </a>
          </div>
        )}
        {tx.metadata && (
          <div>
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 0',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--theme-elevation-600)',
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              <ChevronDown
                size={13}
                style={{
                  transform: expanded ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s',
                }}
              />
              {s.metadata} ({Object.keys(tx.metadata).length} fields)
            </button>
            {expanded && <pre style={metadataPreStyle}>{JSON.stringify(tx.metadata, null, 2)}</pre>}
          </div>
        )}
        {!hasContent && (
          <p
            style={{
              fontSize: 13,
              color: 'var(--theme-elevation-500)',
              fontStyle: 'italic',
            }}
          >
            {s.noMetadata}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Section: Refund History ────────────────────────────────────────────────────

function RefundHistorySection({ tx, s }: { tx: TransactionDoc; s: TransactionStrings }) {
  if (tx.status !== 'refunded') return null

  return (
    <div style={cardStyle}>
      <div style={sectionTitleStyle}>{s.refundHistory}</div>
      <div
        style={{
          padding: 8,
          backgroundColor: 'var(--theme-elevation-0)',
          border: '1px solid var(--theme-elevation-200)',
          borderRadius: 4,
          fontSize: 13,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={detailRowStyle}>
          <span style={detailLabelStyle}>{s.status}</span>
          <StatusBadge status="refunded" />
        </div>
        <div style={detailRowStyle}>
          <span style={detailLabelStyle}>{s.amount}</span>
          <span style={{ ...detailValueStyle, fontWeight: 700 }}>
            {formatAmount(tx.amount, tx.currency)}
          </span>
        </div>
        {tx.errorMessage && (
          <div
            style={{
              padding: '8px 12px',
              backgroundColor: 'var(--theme-error-100)',
              border: '1px solid var(--theme-error)',
              borderRadius: 4,
              color: 'var(--theme-error)',
              fontSize: 12,
            }}
          >
            <strong>{s.errorMessage}:</strong> {tx.errorMessage}
          </div>
        )}
      </div>
    </div>
  )
}

// ── TransactionPaymentDetail ────────────────────────────────────────────────────

export const TransactionPaymentDetail: React.FC = () => {
  const { id } = useDocumentInfo()
  const { i18n } = useTranslation()
  const s = getTransactionStrings(i18n.language)

  const statusField = useFormFields(([fields]) => fields.status)
  const formStatus = (statusField?.value as TransactionStatus | undefined) ?? 'pending'

  const [tx, setTx] = useState<TransactionDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const fetchTransaction = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setFetchError(null)
    try {
      const res = await fetch(`/api/collections/transactions/${id}?depth=2`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const doc = json.docs?.[0] ?? json
      setTx(doc)
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void fetchTransaction()
  }, [fetchTransaction])

  if (loading) {
    return (
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>{s.paymentDetail}</div>
        <div style={loadingStyle}>{s.loading}</div>
      </div>
    )
  }

  if (fetchError || !tx) {
    return (
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>{s.paymentDetail}</div>
        <div style={errorBannerStyle}>{fetchError ?? s.noMetadata}</div>
        <button
          type="button"
          onClick={() => void fetchTransaction()}
          style={{ padding: '4px 12px', fontSize: 12, cursor: 'pointer' }}
        >
          נסה שוב
        </button>
      </div>
    )
  }

  const userId = resolveId(tx.user) ?? ''
  const userEmail =
    typeof tx.user === 'object' && tx.user !== null
      ? (tx.user as { email?: string }).email
      : undefined
  const userName =
    typeof tx.user === 'object' && tx.user !== null
      ? (tx.user as { name?: string }).name
      : undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <TransactionSummarySection tx={tx} s={s} />
      {userId && <UserInfoSection userId={userId} email={userEmail} name={userName} s={s} />}
      <ProductInfoSection product={tx.product} s={s} />
      <MetadataSection tx={tx} s={s} />
      <RefundHistorySection tx={tx} s={s} />
      {formStatus === 'succeeded' && <TransactionRefundAction />}
    </div>
  )
}

// Alias for test compatibility
export const TransactionDetailView = TransactionPaymentDetail

// ── TransactionRefundAction (existing) ────────────────────────────────────────

export const TransactionRefundAction: React.FC = () => {
  const { id } = useDocumentInfo()
  const statusField = useFormFields(([fields]) => fields.status)
  const status = (statusField?.value as string | undefined) ?? 'pending'

  const [isRefunding, setIsRefunding] = useState(false)
  const [refundError, setRefundError] = useState<string | null>(null)
  const [refundSuccess, setRefundSuccess] = useState(false)

  const canRefund = status === 'succeeded'

  async function handleRefund() {
    if (!id) return
    if (!confirm('האם אתה בטוח שברצונך לבצע החזר כספי?')) return

    setIsRefunding(true)
    setRefundError(null)
    setRefundSuccess(false)

    try {
      const response = await fetch(`/api/admin/transactions/${id}/refund`, {
        method: 'POST',
        credentials: 'include',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Refund failed')
      }

      setRefundSuccess(true)
      window.location.reload()
    } catch (err) {
      setRefundError(err instanceof Error ? err.message : 'Refund failed')
    } finally {
      setIsRefunding(false)
    }
  }

  if (!canRefund) return null

  return (
    <div
      style={{
        padding: 12,
        border: '1px solid var(--theme-elevation-200)',
        borderRadius: 4,
        backgroundColor: 'var(--theme-elevation-0)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <h3
        style={{
          fontSize: 13,
          fontWeight: 600,
          margin: 0,
        }}
      >
        פעולות מנהל
      </h3>

      {refundError && (
        <div
          style={{
            padding: '8px 12px',
            backgroundColor: 'var(--theme-error-100)',
            border: '1px solid var(--theme-error)',
            borderRadius: 4,
            color: 'var(--theme-error)',
            fontSize: 13,
          }}
        >
          {refundError}
        </div>
      )}

      {refundSuccess && (
        <div
          style={{
            padding: '8px 12px',
            backgroundColor: 'var(--theme-success-100)',
            border: '1px solid var(--theme-success)',
            borderRadius: 4,
            color: 'var(--theme-success)',
            fontSize: 13,
          }}
        >
          ההחזר בוצע בהצלחה
        </div>
      )}

      <button
        type="button"
        onClick={handleRefund}
        disabled={isRefunding}
        style={{
          padding: '8px 16px',
          fontSize: 14,
          fontWeight: 500,
          border: '1px solid var(--theme-error)',
          borderRadius: 4,
          backgroundColor: 'var(--theme-error-100)',
          color: 'var(--theme-error)',
          cursor: isRefunding ? 'not-allowed' : 'pointer',
          opacity: isRefunding ? 0.6 : 1,
          alignSelf: 'flex-start',
        }}
      >
        {isRefunding ? 'מבצע החזר...' : 'בצע החזר'}
      </button>
    </div>
  )
}
