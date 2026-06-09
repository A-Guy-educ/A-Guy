/**
 * CategoriesCell — displays category names as comma-separated list in courses list view.
 *
 * @fileType component
 * @domain admin
 * @ai-summary Renders hasMany categories relationship as text in list column
 */

'use client'

import React from 'react'

interface Category {
  id: string
  title: string
  [key: string]: unknown
}

interface CategoriesCellProps {
  cellData?: (string | Category)[]
  fieldData?: (string | Category)[]
}

export const CategoriesCell: React.FC<CategoriesCellProps> = ({ cellData, fieldData }) => {
  const categories = cellData || fieldData

  if (!categories || !Array.isArray(categories) || categories.length === 0) {
    return <span className="text-muted-foreground">—</span>
  }

  // Extract titles from category objects or use strings directly
  const labels = categories.map((cat) => {
    if (typeof cat === 'string') return cat
    return cat.title || cat.id
  })

  return <span className="text-body-sm text-card-foreground">{labels.join(', ')}</span>
}

export default CategoriesCell
