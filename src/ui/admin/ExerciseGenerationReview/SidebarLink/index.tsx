/**
 * Exercise Generation Review Sidebar Link
 *
 * @fileType component
 * @domain admin
 * @pattern admin-sidebar-link
 * @ai-summary Navigation link for exercise generation review in the admin sidebar
 */
'use client'

import Link from 'next/link'
import React from 'react'

export const ExerciseGenerationReviewSidebarLink: React.FC = () => {
  return (
    <li className="nav__item">
      <Link href="/admin/exercise-generations" className="nav__link">
        <span className="nav__label">Exercise Generations</span>
      </Link>
    </li>
  )
}

export default ExerciseGenerationReviewSidebarLink
