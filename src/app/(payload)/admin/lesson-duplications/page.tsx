/**
 * Lesson Duplications Index — Admin Page
 *
 * @fileType page
 * @domain admin
 * @pattern admin-page
 * @ai-summary Redirects to the Payload collection list for lesson duplications.
 */
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LessonDuplicationsIndexPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/admin/collections/lesson-duplications')
  }, [router])
  return null
}
