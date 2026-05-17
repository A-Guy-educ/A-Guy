'use client'

/**
 * CouponUsageModal — shows all usages of a coupon with stats header.
 *
 * @fileType component
 * @domain admin
 */

import React, { useState, useEffect } from 'react'
import { useTranslation } from '@payloadcms/ui'

import { getCouponStrings } from '../strings'

interface CouponUsageUser {
  id: string
  email?: string
}

interface CouponUsageTransaction {
  id: string
  providerTransactionId?: string
}

interface CouponUsage {
  id: string
  coupon: string
  transaction: CouponUsageTransaction | string
  user: CouponUsageUser | string
  createdAt: string
}

interface CouponUsageModalProps {
  coupon: {
    id: string
    code: string
  }
  isOpen: boolean
  onClose: () => void
}

/**
 * Extracts email from user field (which can be object or string)
 */
function getUserEmail(user: CouponUsageUser | string): string {
  if (typeof user === 'object' && user?.email) {
    return user.email
  }
  if (typeof user === 'string') return user
  return '—'
}

/**
 * Extracts transaction ID from transaction field
 */
function getTransactionId(transaction: CouponUsageTransaction | string): string {
  if (typeof transaction === 'object' && transaction?.id) {
    return transaction.id
  }
  if (typeof transaction === 'string') return transaction
  return '—'
}

/**
 * Formats a date string to Hebrew locale
 */
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('he-IL', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export const CouponUsageModal: React.FC<CouponUsageModalProps> = ({ coupon, isOpen, onClose }) => {
  const [usages, setUsages] = useState<CouponUsage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { i18n } = useTranslation()
  const s = getCouponStrings(i18n.language)

  // Fetch usages when modal opens
  useEffect(() => {
    if (!isOpen || !coupon?.id) return

    async function fetchUsages() {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(
          `/api/collections/coupon-usages?where[coupon][equals]=${coupon.id}&depth=2`,
          { credentials: 'include' },
        )

        if (!response.ok) {
          throw new Error('Failed to fetch usages')
        }

        const data = await response.json()
        setUsages(data.docs || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setIsLoading(false)
      }
    }

    fetchUsages()
  }, [isOpen, coupon?.id])

  // Compute stats
  const totalUses = usages.length
  const dates = usages
    .map((u) => u.createdAt)
    .filter((d) => d)
    .map((d) => new Date(d).getTime())
    .filter((d) => !isNaN(d))

  const firstUse = dates.length > 0 ? new Date(Math.min(...dates)) : null
  const lastUse = dates.length > 0 ? new Date(Math.max(...dates)) : null

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--theme-elevation-0)',
          borderRadius: 8,
          padding: 24,
          width: '90%',
          maxWidth: 700,
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 600,
              margin: 0,
              color: 'var(--theme-elevation-1000)',
            }}
          >
            {s.couponUsages}: {coupon.code}
          </h2>
        </div>

        {/* Stats Header */}
        {!isLoading && !error && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 16,
              marginBottom: 20,
              padding: 16,
              backgroundColor: 'var(--theme-elevation-100)',
              borderRadius: 8,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--theme-elevation-500)',
                  marginBottom: 4,
                }}
              >
                {s.totalUsages}
              </div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{totalUses}</div>
            </div>
            <div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--theme-elevation-500)',
                  marginBottom: 4,
                }}
              >
                {s.firstUse}
              </div>
              <div style={{ fontSize: 14 }}>
                {firstUse ? formatDate(firstUse.toISOString()) : '—'}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--theme-elevation-500)',
                  marginBottom: 4,
                }}
              >
                {s.lastUse}
              </div>
              <div style={{ fontSize: 14 }}>
                {lastUse ? formatDate(lastUse.toISOString()) : '—'}
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div
            style={{
              padding: 40,
              textAlign: 'center',
              color: 'var(--theme-elevation-500)',
            }}
          >
            {s.loading}
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            style={{
              padding: 16,
              color: 'var(--theme-error)',
              backgroundColor: 'var(--theme-error-100)',
              borderRadius: 4,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && usages.length === 0 && (
          <div
            style={{
              padding: 40,
              textAlign: 'center',
              color: 'var(--theme-elevation-500)',
            }}
          >
            {s.noUsages}
          </div>
        )}

        {/* Usages List */}
        {!isLoading && !error && usages.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--theme-elevation-200)' }}>
                  <th
                    style={{
                      textAlign: 'right',
                      padding: '12px 8px',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--theme-elevation-600)',
                    }}
                  >
                    {s.user}
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      padding: '12px 8px',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--theme-elevation-600)',
                    }}
                  >
                    {s.transaction}
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      padding: '12px 8px',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--theme-elevation-600)',
                    }}
                  >
                    {s.date}
                  </th>
                </tr>
              </thead>
              <tbody>
                {usages.map((usage) => {
                  const userEmail = getUserEmail(usage.user)
                  const transactionId = getTransactionId(usage.transaction)
                  const dateStr = usage.createdAt

                  return (
                    <tr
                      key={usage.id}
                      style={{ borderBottom: '1px solid var(--theme-elevation-100)' }}
                    >
                      <td style={{ padding: '12px 8px', fontSize: 14 }}>{userEmail}</td>
                      <td style={{ padding: '12px 8px', fontSize: 14 }}>
                        {transactionId && transactionId !== '—' ? (
                          <a
                            href={`/admin/collections/transactions/${transactionId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: 'var(--theme-primary)',
                              textDecoration: 'underline',
                            }}
                          >
                            {transactionId.slice(0, 8)}...
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={{ padding: '12px 8px', fontSize: 14 }}>
                        {dateStr ? formatDate(dateStr) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Close Button */}
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 24px',
              fontSize: 14,
              fontWeight: 500,
              border: '1px solid var(--theme-elevation-200)',
              borderRadius: 4,
              backgroundColor: 'var(--theme-elevation-0)',
              color: 'var(--theme-elevation-700)',
              cursor: 'pointer',
            }}
          >
            {s.close}
          </button>
        </div>
      </div>
    </div>
  )
}

export default CouponUsageModal
