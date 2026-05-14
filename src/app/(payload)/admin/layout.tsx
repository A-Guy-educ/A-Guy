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
import { I18nProvider } from '@/ui/web/providers/I18n'
import enMessages from '@/i18n/en.json'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <I18nProvider locale="en" messages={enMessages}>
        <AdminChatLauncher />
      </I18nProvider>
    </>
  )
}
