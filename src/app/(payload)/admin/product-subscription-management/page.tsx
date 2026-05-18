/**
 * Product & Subscription Management Admin Page
 *
 * @fileType page
 * @domain admin
 * @pattern admin-page
 * @ai-summary Unified admin page for product and subscription management
 *
 * Access: Admins only (enforced by role check)
 */

'use client'

import { useCurrentUser } from '@/client/hooks/useCurrentUser'
import { ProductSubscriptionManagementPage } from '@/ui/admin/ProductSubscriptionManagement/page'

const loadingStyle: React.CSSProperties = {
  padding: 20,
  color: 'var(--theme-elevation-500)',
  fontSize: 13,
}

const errorStyle: React.CSSProperties = {
  padding: 20,
  color: 'var(--theme-error)',
  fontSize: 13,
}

export default function AdminProductSubscriptionManagementPage() {
  const { user, isLoading } = useCurrentUser()

  if (isLoading) {
    return <div style={loadingStyle}>Loading...</div>
  }

  if (!user) {
    return <div style={errorStyle}>Please log in to access product management</div>
  }

  // Check for admin role (handles both string role and array role)
  const isAdmin = Array.isArray(user.role) ? user.role.includes('admin') : user.role === 'admin'

  if (!isAdmin) {
    return <div style={errorStyle}>Admin access required</div>
  }

  return <ProductSubscriptionManagementPage />
}
