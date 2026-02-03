/**
 * Admin Chat Sidebar Link
 *
 * @fileType component
 * @domain admin
 * @pattern admin-sidebar-link
 * @ai-summary Navigation link for admin chat in the sidebar
 */
'use client'

import Link from 'next/link'
import React from 'react'

export const AdminChatSidebarLink: React.FC = () => {
  return (
    <li className="nav__item">
      <Link href="/admin/chat" className="nav__link">
        <span className="nav__label">Admin Chat</span>
      </Link>
    </li>
  )
}

export default AdminChatSidebarLink
