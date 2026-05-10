/**
 * Lesson Duplication Review — Admin Page
 *
 * @fileType page
 * @domain admin
 * @pattern admin-page
 * @ai-summary Dedicated admin page for reviewing and resolving lesson duplication failures.
 *
 * Access: Admins only
 */
'use client'

import { useCurrentUser } from '@/client/hooks/useCurrentUser'
import { LessonDuplicationReview } from '@/ui/admin/LessonDuplicationReview'
import { useParams } from 'next/navigation'

const loadingStyle: React.CSSProperties = {
  padding: 20,
  color: 'var(--theme-elevation-500)',
  fontSize: 13,
}
const errorStyle: React.CSSProperties = {
  padding: 20,
  color: 'var(--theme-error)',
  fontSize: 13,
}

export default function LessonDuplicationReviewPage() {
  const params = useParams()
  const duplicationId = params.id as string
  const { user, isLoading } = useCurrentUser()

  if (isLoading) return <div style={loadingStyle}>Loading…</div>
  if (!user) return <div style={errorStyle}>Please log in to access this page.</div>

  const isAdmin = Array.isArray(user.role) ? user.role.includes('admin') : user.role === 'admin'
  if (!isAdmin) return <div style={errorStyle}>Admin access required.</div>

  return <LessonDuplicationReview duplicationId={duplicationId} />
}
