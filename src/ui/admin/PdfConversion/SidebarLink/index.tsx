/**
 * PDF Conversion Sidebar Link
 *
 * @fileType component
 * @domain admin
 * @pattern admin-sidebar-link
 * @ai-summary Navigation link for PDF conversion in the admin sidebar
 */
'use client'

import Link from 'next/link'
import React from 'react'

export const PdfConversionSidebarLink: React.FC = () => {
  return (
    <li className="nav__item">
      <Link href="/admin/pdf-conversion" className="nav__link">
        <span className="nav__label">PDF Conversion</span>
      </Link>
    </li>
  )
}

export default PdfConversionSidebarLink
