'use client'

/**
 * ReviewLinkButton — sits at the top of the ExerciseGenerations edit page and
 * links the admin to the proper review screen.
 *
 * @fileType component
 * @domain admin
 * @pattern admin-action-link
 * @ai-summary Renders a button that navigates to /admin/exercise-generations/<id>.
 */
import React from 'react'
import Link from 'next/link'
import { useDocumentInfo } from '@payloadcms/ui'

export const ExerciseGenerationReviewLink: React.FC = () => {
  const { id } = useDocumentInfo()
  if (!id) return null

  return (
    <Link
      href={`/admin/exercise-generations/${id}`}
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
      title="Open the exercise generation review screen"
    >
      Open review screen →
    </Link>
  )
}
