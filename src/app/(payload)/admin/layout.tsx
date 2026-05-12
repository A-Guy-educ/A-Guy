/**
 * Admin Layout
 *
 * Wraps all admin pages to inject the floating chat launcher globally.
 *
 * @fileType layout
 * @domain admin
 * @pattern admin-layout
 * @ai-summary Admin layout wrapper for floating chat button
 */
import React from 'react'

import { AdminChatLauncher } from '@/ui/admin/AdminChatLauncher'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <AdminChatLauncher />
    </>
  )
}
