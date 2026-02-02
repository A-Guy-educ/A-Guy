/**
 * Admin Chat Dashboard Widget
 *
 * @fileType component
 * @domain admin
 * @pattern admin-dashboard-widget
 * @ai-summary Quick access widget for admin chat on the dashboard
 */
'use client'

import Link from 'next/link'
import React from 'react'

export const AdminChatDashboardWidget: React.FC = () => {
  return (
    <div className="mb-6">
      <div
        className="p-4"
        style={{
          backgroundColor: 'var(--theme-elevation-50)',
          borderRadius: 'var(--border-radius)',
          border: '1px solid var(--theme-elevation-200)',
        }}
      >
        <div className="mb-3">
          <h3
            style={{
              fontSize: 'var(--base)',
              fontWeight: 600,
              color: 'var(--theme-elevation-1000)',
              margin: 0,
            }}
          >
            Admin Chat
          </h3>
          <p
            style={{
              fontSize: 'calc(var(--base) * 0.875)',
              color: 'var(--theme-elevation-500)',
              margin: 'var(--spacing-2) 0 0 0',
            }}
          >
            Query content with AI tools
          </p>
        </div>
        <Link href="/admin/chat" className="btn btn--width-full btn--style-primary">
          Open Chat
        </Link>
      </div>
    </div>
  )
}

export default AdminChatDashboardWidget
