/**
 * Conversion Jobs Nav Link
 *
 * @fileType component
 * @domain admin
 * @pattern admin-sidebar-link
 * @ai-summary Navigation link for PDF conversion dashboard in the sidebar
 */
'use client'

import Link from 'next/link'
import React from 'react'

export const ConversionNavLink: React.FC = () => {
  return (
    <li className="nav__item">
      <Link href="/admin/conversion-jobs" className="nav__link">
        <span className="nav__label">PDF Conversions</span>
      </Link>
    </li>
  )
}

export default ConversionNavLink
