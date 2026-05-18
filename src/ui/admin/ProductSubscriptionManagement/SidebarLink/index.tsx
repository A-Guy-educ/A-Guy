/**
 * Product & Subscription Management Sidebar Link
 *
 * @fileType component
 * @domain admin
 * @pattern admin-sidebar-link
 * @ai-summary Navigation link for product & subscription management in the admin sidebar
 */

'use client'

import Link from 'next/link'
import React from 'react'

export const ProductSubscriptionManagementSidebarLink: React.FC = () => {
  return (
    <li className="nav__item">
      <Link href="/admin/product-subscription-management" className="nav__link">
        <span className="nav__label">Product & Subscription Management</span>
      </Link>
    </li>
  )
}

export default ProductSubscriptionManagementSidebarLink
