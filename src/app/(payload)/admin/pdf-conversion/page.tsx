/**
 * PDF Conversion Admin Page
 *
 * @fileType page
 * @domain admin
 * @pattern admin-page
 * @ai-summary Dedicated admin page for PDF-to-exercise conversion
 *
 * Access: Admins only (enforced by role check)
 */
'use client'

import { useCurrentUser } from '@/client/hooks/useCurrentUser'
import { PdfConversionPage } from '@/ui/admin/PdfConversion/PdfConversionPage'

export default function AdminPdfConversionPage() {
  const { user, isLoading } = useCurrentUser()

  if (isLoading) {
    return <div style={{ padding: 20 }}>Loading...</div>
  }

  if (!user) {
    return <div style={{ padding: 20 }}>Please log in to access PDF conversion</div>
  }

  // Check for admin role (handles both string role and array role)
  const isAdmin = Array.isArray(user.role) ? user.role.includes('admin') : user.role === 'admin'

  if (!isAdmin) {
    return <div style={{ padding: 20 }}>Admin access required</div>
  }

  return <PdfConversionPage />
}
