/**
 * Admin User Email display in sidebar nav
 *
 * @fileType component
 * @domain admin
 * @pattern admin-nav
 * @ai-summary Displays the current logged-in user's email in the admin sidebar
 */
'use client'

import { useAuth } from '@payloadcms/ui'
import React from 'react'

export const UserEmail: React.FC = () => {
  const { user } = useAuth()

  if (!user?.email) return null

  return (
    <div
      style={{
        padding: 'var(--base)',
        fontSize: '12px',
        color: 'var(--theme-elevation-400)',
        textAlign: 'center',
        borderTop: '1px solid var(--theme-elevation-100)',
        wordBreak: 'break-all',
      }}
    >
      {user.email}
    </div>
  )
}

export default UserEmail
