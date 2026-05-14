/**
 * TransactionRefundAction — manual refund action for the Transaction edit view.
 *
 * @fileType component
 * @domain admin
 * @ai-summary Admin action button to issue refunds for succeeded transactions.
 */

'use client'

import React, { useState } from 'react'
import { useDocumentInfo, useFormFields } from '@payloadcms/ui'

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
