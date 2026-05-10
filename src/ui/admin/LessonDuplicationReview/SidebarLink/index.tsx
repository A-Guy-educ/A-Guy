/**
 * Lesson Duplication Review Sidebar Link
 *
 * @fileType component
 * @domain admin
 * @pattern admin-sidebar-link
 * @ai-summary Navigation link for lesson duplication review in the admin sidebar
 */
'use client'

import Link from 'next/link'
import React from 'react'

export const LessonDuplicationReviewSidebarLink: React.FC = () => {
  return (
    <li className="nav__item">
      <Link href="/admin/lesson-duplications" className="nav__link">
        <span className="nav__label">Lesson Duplications</span>
      </Link>
    </li>
  )
}

export default LessonDuplicationReviewSidebarLink
