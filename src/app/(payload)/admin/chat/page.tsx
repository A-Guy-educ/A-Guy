/**
 * Admin Chat Page
 *
 * @fileType page
 * @domain admin
 * @pattern admin-page
 * @ai-summary Dedicated admin chat interface for querying content via MCP tools
 *
 * Access: Admins only (enforced by endpoint)
 */
'use client'

import { useCurrentUser } from '@/client/hooks/useCurrentUser'
import enMessages from '@/i18n/en.json'
import { ChatInterface } from '@/ui/web/chat/ChatInterface'
import { I18nProvider } from '@/ui/web/providers/I18n'

export default function AdminChatPage() {
  const { user, isLoading } = useCurrentUser()

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="loading">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="p-4">
        <div className="error">Please log in to access admin chat</div>
      </div>
    )
  }

  return (
    <I18nProvider locale="en" messages={enMessages}>
      <div className="chat-scope" style={{ height: 'calc(100vh - 64px)' }}>
        <ChatInterface adminMode userId={user.id} translationNamespace="admin.chat" />
      </div>
    </I18nProvider>
  )
}
