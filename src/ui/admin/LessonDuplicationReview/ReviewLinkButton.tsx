'use client'

/**
 * ReviewLinkButton — sits at the top of the LessonDuplications edit page and
 * links the admin to the proper review screen (the K6 custom page), so they
 * don't try to skip/regenerate failures by editing the raw collection record.
 *
 * @fileType component
 * @domain admin
 * @pattern admin-action-link
 * @ai-summary Renders a button that navigates to /admin/lesson-duplications/<id>.
 */
import React from 'react'
import Link from 'next/link'
import { useDocumentInfo } from '@payloadcms/ui'

export const LessonDuplicationReviewLink: React.FC = () => {
  const { id } = useDocumentInfo()
  if (!id) return null

  return (
    <Link
      href={`/admin/lesson-duplications/${id}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        fontSize: 13,
        fontWeight: 500,
        border: '1px solid var(--theme-success-500)',
        borderRadius: 4,
        backgroundColor: 'var(--theme-success-500)',
        color: '#fff',
        textDecoration: 'none',
      }}
      title="Open the failures-review screen with skip/regenerate/keep actions"
    >
      Open review screen →
    </Link>
  )
}
