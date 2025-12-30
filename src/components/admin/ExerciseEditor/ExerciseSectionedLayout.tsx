'use client'

/**
 * Exercise Sectioned Layout - UI Field component for section controls
 * Note: This component is not currently used as we rely on Payload's native collapsible sections
 */

import React from 'react'
import type { UIFieldClientComponent } from 'payload'

export const ExerciseSectionedLayout: UIFieldClientComponent = () => {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <p style={{ fontSize: '0.875rem', opacity: 0.7 }}>
        Use the collapsible sections below to organize your exercise. Click section headers to
        expand/collapse.
      </p>
    </div>
  )
}
