/**
 * Admin Chat Dashboard Widget
 *
 * @fileType component
 * @domain admin
 * @pattern admin-dashboard-widget
 * @ai-summary Quick access widget for admin chat on the dashboard
 */
'use client'

import React from 'react'

export const AdminChatDashboardWidget: React.FC = () => {
  return (
    <div className="mb-6">
      <div className="p-4 bg-muted rounded-lg border border-border">
        <div className="mb-3">
          <h3 className="font-medium text-foreground">Admin Chat</h3>
          <p className="text-sm text-muted-foreground">Query content with AI tools</p>
        </div>
        <a href="/admin/chat" className="btn btn--width-full btn--style-primary">
          Open Chat
        </a>
      </div>
    </div>
  )
}

export default AdminChatDashboardWidget
