'use client'

/**
 * Advanced Section Placeholder - UI field component
 */

import React from 'react'
import type { UIFieldClientComponent } from 'payload'

export const AdvancedPlaceholder: UIFieldClientComponent = () => {
  return (
    <div style={{ padding: '1rem', opacity: 0.7 }}>
      <p>
        Advanced JSON editors are available within the Content and Answer sections. Click
        &quot;Advanced: Content JSON&quot; or &quot;Advanced: Answer Spec JSON&quot; to view and
        edit raw JSON.
      </p>
      <p style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
        Future: This section will contain debug readouts, schema versions, and internal IDs.
      </p>
    </div>
  )
}
