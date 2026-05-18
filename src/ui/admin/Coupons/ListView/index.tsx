'use client'

/**
 * CouponsListView — custom list view for the Coupons collection.
 * Displays coupon codes with usage stats and action buttons.
 *
 * @fileType component
 * @domain admin
 */

import React, { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { ListViewClientProps } from 'payload'
import { DefaultListView, useTranslation } from '@payloadcms/ui'

import { CreateCouponModal } from '../CreateCouponModal'
import { getCouponStrings } from '../strings'

export const CouponsListView: React.FC<ListViewClientProps> = (props) => {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const { i18n } = useTranslation()
  const router = useRouter()
  const s = getCouponStrings(i18n.language)

  const handleCouponCreated = useCallback(() => {
    setShowCreateModal(false)
    // revalidatePath is server-only; refresh the route from the client
    // to re-fetch the coupons list after creation.
    router.refresh()
  }, [router])

  return (
    <>
      {/* Render default list view with "Add Coupon" button injected */}
      <div className="coupons-list-wrapper">
        {/* Add Coupon Button - rendered before the list */}
        <div
          style={{
            padding: '12px 24px',
            borderBottom: '1px solid var(--theme-elevation-200)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 500,
              border: 'none',
              borderRadius: 4,
              backgroundColor: 'var(--theme-elevation-1000)',
              color: 'var(--theme-elevation-0)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>+</span>
            <span>{s.addCoupon}</span>
          </button>
        </div>

        <DefaultListView {...props} />
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateCouponModal
          key="create-coupon-modal"
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCouponCreated}
        />
      )}
    </>
  )
}

export default CouponsListView
