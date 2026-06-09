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
  // Params.id can be string | string[] | undefined (Next.js 15 Params type).
  // Normalize to string: use first element if array, bail if missing.
  const rawId = params?.id
  const duplicationId = Array.isArray(rawId) ? rawId[0] : rawId

  // Auth check must come before any conditional return AND after all hooks.
  const { user, isLoading } = useCurrentUser()

  if (!duplicationId) {
    return <div style={errorStyle}>Invalid or missing duplication ID.</div>
  }
  if (isLoading) return <div style={loadingStyle}>Loading…</div>
  if (!user) return <div style={errorStyle}>Please log in to access this page.</div>

  const isAdmin = Array.isArray(user.role) ? user.role.includes('admin') : user.role === 'admin'
  if (!isAdmin) return <div style={errorStyle}>Admin access required.</div>

  return <LessonDuplicationReview duplicationId={duplicationId} />
}
