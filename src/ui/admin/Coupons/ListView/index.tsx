'use client'

/**
 * CouponsListView — custom list view for the Coupons collection.
 * Displays coupon codes with usage stats and action buttons.
 *
 * @fileType component
 * @domain admin
 */

import React, { useState, useCallback } from 'react'
import type { ListViewClientProps } from 'payload'
import { DefaultListView } from '@payloadcms/ui'

import { CreateCouponModal } from '../CreateCouponModal'

export const CouponsListView: React.FC<ListViewClientProps> = (props) => {
  const [showCreateModal, setShowCreateModal] = useState(false)

  const handleCouponCreated = useCallback(() => {
    setShowCreateModal(false)
    window.location.reload()
  }, [])

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
            <span>הוסף קופון</span>
          </button>
        </div>

        <DefaultListView {...props} />
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateCouponModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCouponCreated}
        />
      )}
    </>
  )
}

export default CouponsListView
